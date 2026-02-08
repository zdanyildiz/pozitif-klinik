const sql = require('mssql');
const mysql = require('mysql2/promise');

const CLINIC_ID = 1;

const { getSourceConfig, getTargetConfig } = require('./db.helper');
const mssqlConfig = getSourceConfig();
const mysqlConfig = getTargetConfig();

async function mergeSpecialtyData() {
    let mssqlPool, mysqlConn;

    try {
        console.log('Veritabanlarına bağlanılıyor...');
        mssqlPool = await sql.connect(mssqlConfig);
        mysqlConn = await mysql.createConnection(mysqlConfig);
        console.log('Bağlantı başarılı.');

        // 1. Yeni sistemdeki randevu eşleşmelerini yükle
        console.log('Randevu eşleşmeleri yükleniyor...');
        const [apptRows] = await mysqlConn.execute(
            'SELECT id, patient_id, doctor_id, legacy_visit_id FROM cln_appointments WHERE legacy_visit_id IS NOT NULL AND clinic_id = ?',
            [CLINIC_ID]
        );
        const apptMap = new Map();
        apptRows.forEach(r => apptMap.set(r.legacy_visit_id, r));
        console.log(`${apptMap.size} adet randevu eşleşmesi yüklendi.`);

        // 2. Mevcut muayene kayıtlarını yükle (Mükerrer insert önlemek için)
        const [examRows] = await mysqlConn.execute(
            'SELECT legacy_visit_id FROM cln_examinations WHERE legacy_visit_id IS NOT NULL AND clinic_id = ?',
            [CLINIC_ID]
        );
        const existingExamSet = new Set(examRows.map(r => r.legacy_visit_id));

        // 3. İç Hastalıkları verilerini çek
        console.log('Eski sistemden İç Hastalıkları notları okunuyor...');
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
        `);

        console.log(`${result.recordset.length} adet dolu klinik not bulundu. İşlem başlıyor...`);

        let updatedCount = 0;
        let insertedCount = 0;
        let skippedCount = 0;

        for (const row of result.recordset) {
            const appt = apptMap.get(row.GELISNO);
            if (!appt) {
                skippedCount++;
                continue;
            }

            if (existingExamSet.has(row.GELISNO)) {
                // Güncelleme
                const [res] = await mysqlConn.execute(
                    `UPDATE cln_examinations 
                     SET complaint = COALESCE(complaint, ?),
                         story = COALESCE(story, ?),
                         diagnosis = COALESCE(diagnosis, ?),
                         treatment = COALESCE(treatment, ?),
                         bulgular = COALESCE(bulgular, ?),
                         lab_result_text = COALESCE(lab_result_text, ?)
                     WHERE legacy_visit_id = ? AND clinic_id = ?`,
                    [
                        row.SIKAYETLER || null,
                        row.HIKAYESI || null,
                        row.TANI || null,
                        row.TEDAVI || null,
                        row.FIZIKMUA || null,
                        (row.LABORATUVAR ? 'LABORATUVAR:\n' + row.LABORATUVAR + '\n\n' : '') +
                        (row.RADYOLOJI ? 'RADYOLOJI:\n' + row.RADYOLOJI : '') || null,
                        row.GELISNO,
                        CLINIC_ID
                    ]
                );
                updatedCount++;
            } else {
                // Yeni kayıt ekleme
                await mysqlConn.execute(
                    `INSERT INTO cln_examinations (
                        clinic_id, patient_id, doctor_user_id, appointment_id, 
                        complaint, story, diagnosis, treatment, bulgular, lab_result_text, legacy_visit_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        CLINIC_ID,
                        appt.patient_id,
                        appt.doctor_id || 1, // Atanmış doktor yoksa sistem admini
                        appt.id,
                        row.SIKAYETLER || null,
                        row.HIKAYESI || null,
                        row.TANI || null,
                        row.TEDAVI || null,
                        row.FIZIKMUA || null,
                        (row.LABORATUVAR ? 'LABORATUVAR:\n' + row.LABORATUVAR + '\n\n' : '') +
                        (row.RADYOLOJI ? 'RADYOLOJI:\n' + row.RADYOLOJI : '') || null,
                        row.GELISNO
                    ]
                );
                insertedCount++;
                existingExamSet.add(row.GELISNO); // Mükerrerliği önle
            }

            if ((updatedCount + insertedCount + skippedCount) % 1000 === 0) {
                process.stdout.write(`\rİşlenen: ${updatedCount + insertedCount + skippedCount}...`);
            }
        }

        console.log('\n--- AKTARIM ÖZETİ ---');
        console.log(`Güncellenen Muayene Kaydı: ${updatedCount}`);
        console.log(`Yeni Eklenen Muayene Kaydı: ${insertedCount}`);
        console.log(`Randevu kaydı bulunamayan (Atlanan): ${skippedCount}`);
        console.log('---------------------');

    } catch (err) {
        console.error('Hata:', err);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

mergeSpecialtyData();
