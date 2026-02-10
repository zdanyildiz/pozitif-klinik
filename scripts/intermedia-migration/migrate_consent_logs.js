const sql = require('mssql');
const mysql = require('mysql2/promise');
const { getSourceConfig, getTargetConfig } = require('./core/db.helper');
const { parseClinicId } = require('./core/cli.helper');

const BATCH_SIZE = 2000;
const CLINIC_ID = parseClinicId();

async function migrateConsentLogs() {
    console.log('🚀 Starting Consent Logs Migration...');

    const sourceConfig = getSourceConfig();
    const targetConfig = getTargetConfig();
    let mssqlPool, mysqlConn;

    try {
        mssqlPool = await sql.connect(sourceConfig);
        mysqlConn = await mysql.createConnection(targetConfig);

        // Load Patient Map
        const [patients] = await mysqlConn.query('SELECT id, legacy_id FROM ptn_cards WHERE legacy_id IS NOT NULL');
        const patientMap = new Map(patients.map(p => [p.legacy_id, p.id]));

        // Resume
        const [res] = await mysqlConn.query("SELECT MAX(legacy_record_id) as max_id FROM ptn_consent_logs WHERE source = 'legacy'");
        let offset = res[0].max_id || 0;
        console.log(`   Detailed: Resuming from LogID ${offset}`);

        let hasMore = true;

        // Load User Map
        const [users] = await mysqlConn.query('SELECT id, legacy_id FROM sys_users WHERE legacy_id IS NOT NULL');
        const userMap = new Map(users.map(u => [u.legacy_id, u.id]));

        while (hasMore) {
            const result = await mssqlPool.request().query(`
                SELECT TOP ${BATCH_SIZE}
                    ID,
                    HastaNo,
                    Tarih,
                    Islem,   -- 0: Initial ? (Need infer)
                    Kim,     -- User
                    Detay
                FROM Hst_Anadosya_GizlilikOnamFormu_Log
                WHERE ID > ${offset}
                ORDER BY ID
            `);

            if (result.recordset.length === 0) {
                hasMore = false;
                break;
            }

            const values = [];
            let lastId = offset;

            for (const row of result.recordset) {
                lastId = row.ID; // Always update lastId

                const patientId = patientMap.get(row.HastaNo);
                if (!patientId) continue;

                const userId = userMap.get(row.Kim) || null;

                // Infer Type
                let type = 'kvkk';
                const detail = (row.Detay || '').toLowerCase();
                if (detail.includes('etk') || detail.includes('sms') || detail.includes('mail')) type = 'etk';
                else if (detail.includes('iys')) type = 'iys';

                // Infer Status
                let status = 'granted';
                if (detail.includes('iptal') || detail.includes('ret') || detail.includes('kaldır')) status = 'revoked';

                values.push([
                    CLINIC_ID,
                    patientId,
                    type,
                    status,
                    'legacy',
                    null, // IP
                    userId, // Mapped User ID
                    JSON.stringify({ description: row.Detay, legacy_user_id: row.Kim }),
                    row.Tarih ? new Date(row.Tarih) : new Date(),
                    row.ID
                ]);
            }

            offset = lastId; // Update offset for next batch

            if (values.length > 0) {
                await mysqlConn.query(`
                    INSERT IGNORE INTO ptn_consent_logs 
                    (clinic_id, patient_id, consent_type, consent_status, source, ip_address, user_id, details, consented_at, legacy_record_id)
                    VALUES ?
                `, [values]);
            }
            if (offset % 10000 === 0) console.log(`Processed up to LogID ${offset}`);
        }

        console.log('✅ Consent Logs Migration Completed.');

    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

migrateConsentLogs();
