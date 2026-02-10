const sql = require('mssql');
const mysql = require('mysql2/promise');
const { getSourceConfig, getTargetConfig } = require('./core/db.helper');
const { parseClinicId } = require('./core/cli.helper');

const BATCH_SIZE = 2000;
const CLINIC_ID = parseClinicId();

async function migrateDataAccessLogs() {
    console.log('🚀 Starting Data Access Logs Migration...');

    const sourceConfig = getSourceConfig();
    const targetConfig = getTargetConfig();

    let mssqlPool;
    let mysqlConn;

    try {
        mssqlPool = await sql.connect(sourceConfig);
        mysqlConn = await mysql.createConnection(targetConfig);
        console.log('✅ Connected.');

        // 1. Load User Map
        const [users] = await mysqlConn.query('SELECT id, legacy_id FROM sys_users WHERE legacy_id IS NOT NULL');
        const userMap = new Map(users.map(u => [u.legacy_id, u.id]));

        // 2. Load Patient Map
        const [patients] = await mysqlConn.query('SELECT id, legacy_id FROM ptn_cards WHERE legacy_id IS NOT NULL');
        const patientMap = new Map(patients.map(p => [p.legacy_id, p.id]));

        console.log(`Loaded ${userMap.size} users and ${patientMap.size} patients.`);

        // 3. Get Last Imported KayitID (Cursor-based pagination — ROW_NUMBER CTE yerine)
        const [res] = await mysqlConn.query("SELECT MAX(legacy_record_id) as max_id FROM cln_data_access_logs WHERE legacy_table = 'Kullanici_Log_KayitErisim'");
        let lastKayitId = res[0].max_id || 0;

        console.log(`   Resuming from KayitID > ${lastKayitId}`);

        let totalProcessed = 0;
        let hasMore = true;

        while (hasMore) {
            // Cursor tabanlı pagination: ROW_NUMBER yerine KayitID üzerinden ilerle
            // Bu yöntem offset arttıkça yavaşlamaz — her sorgu sabit performansta çalışır
            const result = await mssqlPool.request()
                .input('lastId', sql.Int, lastKayitId)
                .query(`
                    SELECT TOP ${BATCH_SIZE}
                        KayitID,
                        KullaniciID,
                        HastaNo,
                        GelisNo,
                        KayitTuruTanimID,
                        TarihSaat,
                        Notlar,
                        SubeID
                    FROM Kullanici_Log_KayitErisim
                    WHERE KayitID > @lastId
                    ORDER BY KayitID
                `);

            if (result.recordset.length === 0) {
                hasMore = false;
                break;
            }

            const values = [];
            for (const row of result.recordset) {
                const userId = userMap.get(row.KullaniciID) || null;
                const patientId = patientMap.get(row.HastaNo) || null;

                // Determine Record Type
                // KayitTuruTanimID: 1 -> Patient, 200 -> Appointment (Gelis)
                let recordType = 'Patient';
                let recordId = null;

                if (row.KayitTuruTanimID === 1) { // Patient
                    recordType = 'Patient';
                    recordId = patientId; // Link to new Patient ID
                } else if (row.KayitTuruTanimID === 200) { // Appointment
                    recordType = 'Appointment';
                    recordId = null;
                }

                values.push([
                    CLINIC_ID,
                    userId,
                    patientId,
                    recordType,
                    recordId,
                    'DATA_ACCESS',
                    null, // IP
                    row.Notlar || 'Legacy Access Log',
                    row.TarihSaat ? new Date(row.TarihSaat) : new Date(),
                    'Kullanici_Log_KayitErisim',
                    row.KayitID // Gerçek PK — sentetik RowNum yerine
                ]);

                lastKayitId = row.KayitID;
            }

            if (values.length > 0) {
                await mysqlConn.query(`
                    INSERT IGNORE INTO cln_data_access_logs 
                    (clinic_id, user_id, patient_id, record_type, record_id, action, ip_address, description, accessed_at, legacy_table, legacy_record_id)
                    VALUES ?
                `, [values]);
            }

            totalProcessed += result.recordset.length;
            if (totalProcessed % 10000 === 0) {
                console.log(`Processed ${totalProcessed} records (KayitID: ${lastKayitId})`);
            }
        }

        console.log('✅ Data Access Logs Migration Completed.');

    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

migrateDataAccessLogs();
