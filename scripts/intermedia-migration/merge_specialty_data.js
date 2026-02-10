const sql = require('mssql');
const mysql = require('mysql2/promise');

const { getSourceConfig, getTargetConfig } = require('./core/db.helper');
const { parseClinicId } = require('./core/cli.helper');
const CLINIC_ID = parseClinicId();
const BATCH_SIZE = 1000; // Smaller batch size to prevent ECONNRESET

const mssqlConfig = {
    ...getSourceConfig(),
    requestTimeout: 300000 // 5 minutes
};

const mysqlConfig = {
    ...getTargetConfig(),
    connectTimeout: 60000
};

async function mergeSpecialtyData() {
    let mssqlPool, mysqlConn;

    try {
        console.log('Veritabanlarına bağlanılıyor...');
        mssqlPool = await sql.connect(mssqlConfig);
        mysqlConn = await mysql.createConnection(mysqlConfig);
        console.log('Bağlantı başarılı.');

        // KRITIK: Klinik var mı kontrol et
        const [tenants] = await mysqlConn.execute('SELECT id FROM sys_tenants WHERE id = ?', [CLINIC_ID]);
        if (tenants.length === 0) {
            console.error(`\n❌ HATA: Klinik ID=${CLINIC_ID} bulunamadı!`);
            process.exit(1);
        }

        // 1. Yeni sistemdeki randevu eşleşmelerini yükle
        console.log('Randevu eşleşmeleri yükleniyor...');
        const [apptRows] = await mysqlConn.execute(
            'SELECT id, patient_id, doctor_id, legacy_visit_id FROM cln_appointments WHERE legacy_visit_id IS NOT NULL AND clinic_id = ?',
            [CLINIC_ID]
        );
        const apptMap = new Map();
        apptRows.forEach(r => apptMap.set(r.legacy_visit_id, r));
        console.log(`${apptMap.size} adet randevu eşleşmesi yüklendi.`);

        // 2. Fetch data from MSSQL using pagination (Cursor-based)
        console.log('Eski sistemden İç Hastalıkları notları okunuyor...');

        // Get max ID first to know range (optional, but good for progress)
        // For simplicity, we'll scan by ID or GELISNO ranges if possible, 
        // but GELISNO might not be sequential. We'll use ORDER BY and OFFSET/FETCH.
        // Or better: Use stream if supported, or simple Loop with OFFSET.

        // Let's count total first
        const countResult = await mssqlPool.request().query(`
            SELECT COUNT(*) as Total
            FROM UZM_ICHASTALIKLARI_HST_ANAMNEZ
            WHERE (SIKAYETLER IS NOT NULL AND SIKAYETLER != '') 
               OR (TANI IS NOT NULL AND TANI != '')
               OR (RADYOLOJI IS NOT NULL AND RADYOLOJI != '')
               OR (LABORATUVAR IS NOT NULL AND LABORATUVAR != '')
        `);
        const totalRecords = countResult.recordset[0].Total;
        console.log(`${totalRecords} adet kayıt işlenecek.`);

        let processed = 0;
        let inserted = 0;
        let skipped = 0;

        for (let offset = 0; offset < totalRecords; offset += BATCH_SIZE) {

            const result = await mssqlPool.request().query(`
                SELECT 
                    GELISNO, 
                    SIKAYETLER, 
                    HIKAYESI, 
                    TANI, 
                    TEDAVI, 
                    TAVSIYELER, 
                    FIZIKMUA,
                    RADYOLOJI,
                    LABORATUVAR
                FROM UZM_ICHASTALIKLARI_HST_ANAMNEZ
                WHERE (SIKAYETLER IS NOT NULL AND SIKAYETLER != '') 
                   OR (TANI IS NOT NULL AND TANI != '')
                   OR (RADYOLOJI IS NOT NULL AND RADYOLOJI != '')
                   OR (LABORATUVAR IS NOT NULL AND LABORATUVAR != '')
                ORDER BY GELISNO
                OFFSET ${offset} ROWS FETCH NEXT ${BATCH_SIZE} ROWS ONLY
            `);

            const values = [];

            for (const row of result.recordset) {
                const appt = apptMap.get(row.GELISNO);
                if (!appt) {
                    skipped++;
                    continue;
                }

                // Prepare Data
                const labResultText = [
                    row.LABORATUVAR ? `LABORATUVAR:\n${row.LABORATUVAR}` : null,
                    row.RADYOLOJI ? `RADYOLOJI:\n${row.RADYOLOJI}` : null
                ].filter(Boolean).join('\n\n') || null;

                values.push([
                    CLINIC_ID,
                    appt.patient_id,
                    appt.doctor_id || null,
                    appt.id,
                    row.SIKAYETLER ? String(row.SIKAYETLER).substring(0, 65000) : null,
                    row.HIKAYESI ? String(row.HIKAYESI).substring(0, 65000) : null,
                    row.TANI ? String(row.TANI).substring(0, 65000) : null,
                    row.TEDAVI ? String(row.TEDAVI).substring(0, 65000) : null,
                    row.FIZIKMUA ? String(row.FIZIKMUA).substring(0, 65000) : null,
                    labResultText ? labResultText.substring(0, 65000) : null, // MySQL TEXT limit
                    row.GELISNO
                ]);
            }

            if (values.length > 0) {
                // Bulk Insert with ON DUPLICATE KEY UPDATE
                // This handles both INSERT (if new) and UPDATE (if exists) in one go
                const sql = `
                    INSERT INTO cln_examinations (
                        clinic_id, patient_id, doctor_user_id, appointment_id,
                        complaint, story, diagnosis, treatment, bulgular, lab_result_text, legacy_visit_id
                    ) VALUES ?
                    ON DUPLICATE KEY UPDATE
                        complaint = COALESCE(VALUES(complaint), complaint),
                        story = COALESCE(VALUES(story), story),
                        diagnosis = COALESCE(VALUES(diagnosis), diagnosis),
                        treatment = COALESCE(VALUES(treatment), treatment),
                        bulgular = COALESCE(VALUES(bulgular), bulgular),
                        lab_result_text = COALESCE(VALUES(lab_result_text), lab_result_text)
                `;

                try {
                    await mysqlConn.query(sql, [values]);
                    inserted += values.length;
                } catch (err) {
                    console.error(`\n❌ Batch Error (Offset ${offset}):`, err.message);
                }
            }

            processed += result.recordset.length;
            process.stdout.write(`\rİşlenen: ${processed}/${totalRecords} (Skipped: ${skipped})...`);
        }

        console.log('\n\n✅ Aktarım Tamamlandı.');
        console.log(`Toplam: ${processed}`);
        console.log(`Başarılı (Insert/Update): ${inserted}`);
        console.log(`Atlanan (Randevusu Yok): ${skipped}`);

    } catch (err) {
        console.error('\n❌ Genel Hata:', err);
        process.exit(1);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

mergeSpecialtyData();
