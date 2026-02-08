const sql = require('mssql');
const mysql = require('mysql2/promise');

const CLINIC_ID = 1;
const BATCH_SIZE = 2000;

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

        // 2. Mevcut muayene kayıtlarını yükle (Mükerrer insert önlemek için)
        const [examRows] = await mysqlConn.execute(
            'SELECT id, legacy_visit_id FROM cln_examinations WHERE legacy_visit_id IS NOT NULL AND clinic_id = ?',
            [CLINIC_ID]
        );
        const existingExamMap = new Map();
        examRows.forEach(r => existingExamMap.set(r.legacy_visit_id, r.id));

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

        // Process in batches
        for (let batchStart = 0; batchStart < result.recordset.length; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, result.recordset.length);
            const batch = result.recordset.slice(batchStart, batchEnd);

            const updateCases = {
                complaint: [],
                story: [],
                diagnosis: [],
                treatment: [],
                bulgular: [],
                lab_result_text: [],
                ids: []
            };
            const insertValues = [];

            for (const row of batch) {
                const appt = apptMap.get(row.GELISNO);
                if (!appt) {
                    skippedCount++;
                    continue;
                }

                const labResultText = (row.LABORATUVAR ? 'LABORATUVAR:\n' + row.LABORATUVAR + '\n\n' : '') +
                    (row.RADYOLOJI ? 'RADYOLOJI:\n' + row.RADYOLOJI : '') || null;

                if (existingExamMap.has(row.GELISNO)) {
                    // Collect for bulk update
                    const examId = existingExamMap.get(row.GELISNO);
                    updateCases.ids.push(examId);
                    updateCases.complaint.push({ id: examId, value: row.SIKAYETLER || null });
                    updateCases.story.push({ id: examId, value: row.HIKAYESI || null });
                    updateCases.diagnosis.push({ id: examId, value: row.TANI || null });
                    updateCases.treatment.push({ id: examId, value: row.TEDAVI || null });
                    updateCases.bulgular.push({ id: examId, value: row.FIZIKMUA || null });
                    updateCases.lab_result_text.push({ id: examId, value: labResultText });
                    updatedCount++;
                } else {
                    // Collect for bulk insert
                    insertValues.push([
                        CLINIC_ID,
                        appt.patient_id,
                        appt.doctor_id || 1,
                        appt.id,
                        row.SIKAYETLER || null,
                        row.HIKAYESI || null,
                        row.TANI || null,
                        row.TEDAVI || null,
                        row.FIZIKMUA || null,
                        labResultText,
                        row.GELISNO
                    ]);
                    existingExamMap.set(row.GELISNO, -1); // Prevent duplicate inserts within batch
                    insertedCount++;
                }
            }

            // Execute bulk UPDATE using CASE WHEN (more efficient than individual updates)
            if (updateCases.ids.length > 0) {
                // Build CASE statements for each field
                const buildCaseStatement = (field, cases) => {
                    const whenClauses = cases.map(c => `WHEN ${c.id} THEN ${c.value === null ? 'NULL' : mysqlConn.escape(c.value)}`).join(' ');
                    return `${field} = COALESCE(${field}, CASE id ${whenClauses} ELSE ${field} END)`;
                };

                const idList = updateCases.ids.join(',');
                const updateQuery = `
                    UPDATE cln_examinations SET
                        ${buildCaseStatement('complaint', updateCases.complaint)},
                        ${buildCaseStatement('story', updateCases.story)},
                        ${buildCaseStatement('diagnosis', updateCases.diagnosis)},
                        ${buildCaseStatement('treatment', updateCases.treatment)},
                        ${buildCaseStatement('bulgular', updateCases.bulgular)},
                        ${buildCaseStatement('lab_result_text', updateCases.lab_result_text)}
                    WHERE id IN (${idList}) AND clinic_id = ${CLINIC_ID}
                `;

                try {
                    await mysqlConn.query(updateQuery);
                } catch (err) {
                    console.error('\nBulk update error:', err.message);
                }
            }

            // Execute bulk INSERT
            if (insertValues.length > 0) {
                try {
                    await mysqlConn.query(
                        `INSERT INTO cln_examinations (
                            clinic_id, patient_id, doctor_user_id, appointment_id, 
                            complaint, story, diagnosis, treatment, bulgular, lab_result_text, legacy_visit_id
                        ) VALUES ?`,
                        [insertValues]
                    );
                } catch (err) {
                    console.error('\nBulk insert error:', err.message);
                }
            }

            process.stdout.write(`\rİşlenen: ${batchEnd}/${result.recordset.length}...`);
        }

        console.log('\n--- AKTARIM ÖZETİ ---');
        console.log(`Güncellenen Muayene Kaydı: ${updatedCount}`);
        console.log(`Yeni Eklenen Muayene Kaydı: ${insertedCount}`);
        console.log(`Randevu kaydı bulunamayan (Atlanan): ${skippedCount}`);
        console.log('---------------------');

    } catch (err) {
        console.error('❌ Hata:', err);
        process.exit(1);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

mergeSpecialtyData();
