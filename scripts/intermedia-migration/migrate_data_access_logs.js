const sql = require('mssql');
const mysql = require('mysql2/promise');
const { getSourceConfig, getTargetConfig } = require('./db.helper');

const BATCH_SIZE = 2000;
const CLINIC_ID = 1;

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

        // 3. Get Last Imported Offset (Legacy ID / RowNum)
        // We are using synthetic RowNum as legacy_record_id for this table since it has no PK.
        const [res] = await mysqlConn.query("SELECT MAX(legacy_record_id) as max_id FROM cln_data_access_logs WHERE legacy_table = 'Kullanici_Log_KayitErisim'");
        let currentOffset = res[0].max_id || 0;

        console.log(`   Detailed: Resuming from Offset ${currentOffset}`);

        let hasMore = true;

        while (hasMore) {
            // MSSQL Query using Window Function for Pagination
            const result = await mssqlPool.request().query(`
                WITH OrderedLogs AS (
                    SELECT 
                        ROW_NUMBER() OVER (ORDER BY TarihSaat, KullaniciID) as RowNum,
                        KullaniciID,
                        HastaNo,
                        GelisNo,
                        KayitTuruTanimID,
                        KayitID,
                        TarihSaat,
                        Notlar,
                        SubeID
                    FROM Kullanici_Log_KayitErisim
                )
                SELECT TOP ${BATCH_SIZE} *
                FROM OrderedLogs
                WHERE RowNum > ${currentOffset}
                ORDER BY RowNum
            `);

            if (result.recordset.length === 0) {
                hasMore = false;
                break;
            }

            const values = [];
            for (const row of result.recordset) {
                const userId = userMap.get(row.KullaniciID) || null;
                const patientId = patientMap.get(row.HastaNo) || null;
                const syntheticId = row.RowNum;

                // Determine Record Type
                // KayitTuruTanimID: 1 -> Patient, 200 -> Appointment (Gelis)
                let recordType = 'Patient';
                let recordId = null;

                if (row.KayitTuruTanimID === 1) { // Patient
                    recordType = 'Patient';
                    recordId = patientId; // Link to new Patient ID
                } else if (row.KayitTuruTanimID === 200) { // Appointment
                    recordType = 'Appointment';
                    // We cannot link to new Appointment ID without map. Leaving NULL.
                    recordId = null;
                }

                values.push([
                    CLINIC_ID,
                    userId,
                    patientId, // patient_id column
                    recordType,
                    recordId, // record_id column (New ID)
                    'DATA_ACCESS',
                    null, // IP
                    row.Notlar || 'Legacy Access Log',
                    row.TarihSaat ? new Date(row.TarihSaat) : new Date(),
                    'Kullanici_Log_KayitErisim',
                    syntheticId // legacy_record_id (Used for offset)
                ]);

                currentOffset = syntheticId;
            }

            if (values.length > 0) {
                await mysqlConn.query(`
                    INSERT IGNORE INTO cln_data_access_logs 
                    (clinic_id, user_id, patient_id, record_type, record_id, action, ip_address, description, accessed_at, legacy_table, legacy_record_id)
                    VALUES ?
                `, [values]);
            }
            if (currentOffset % 10000 === 0) {
                console.log(`Processed up to RowNum ${currentOffset}`);
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
