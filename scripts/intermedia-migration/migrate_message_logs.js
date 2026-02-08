const sql = require('mssql');
const mysql = require('mysql2/promise');
const { getSourceConfig, getTargetConfig } = require('./db.helper');

const BATCH_SIZE = 2000;
const CLINIC_ID = 1;

async function migrateMessageLogs() {
    console.log('🚀 Starting Message Logs Migration...');

    const sourceConfig = getSourceConfig();
    const targetConfig = getTargetConfig();
    let mssqlPool, mysqlConn;

    try {
        mssqlPool = await sql.connect(sourceConfig);
        mysqlConn = await mysql.createConnection(targetConfig);

        // 1. SMS Logs (System Error Logs)
        console.log('👉 Migrating SMS Logs (System Errors found in ILET_SMS_LOG)...');
        const [smsRes] = await mysqlConn.query("SELECT MAX(legacy_record_id) as max_id FROM sys_sms_logs WHERE legacy_table = 'ILET_SMS_LOG'");
        let offset = smsRes[0].max_id || 0;
        let hasMore = true;

        while (hasMore) {
            const result = await mssqlPool.request().query(`
                SELECT TOP ${BATCH_SIZE}
                    RECORD_ID,
                    MESAJ,
                    TARIH,
                    TURU
                FROM ILET_SMS_LOG
                WHERE RECORD_ID > ${offset}
                ORDER BY RECORD_ID
            `);

            if (result.recordset.length === 0) {
                hasMore = false;
                break;
            }

            const values = [];
            for (const row of result.recordset) {
                // ILET_SMS_LOG contains system errors, no recipient.
                // We map them as SYSTEM logs with status 'failed'.

                values.push([
                    CLINIC_ID,
                    'SYSTEM', // Recipient unknown / System
                    row.MESAJ,
                    'failed',
                    row.TARIH ? new Date(row.TARIH) : new Date(),
                    'ILET_SMS_LOG',
                    row.RECORD_ID
                ]);
                offset = row.RECORD_ID;
            }

            if (values.length > 0) {
                await mysqlConn.query(`
                    INSERT IGNORE INTO sys_sms_logs 
                    (clinic_id, phone, message, status, sent_at, legacy_table, legacy_record_id)
                    VALUES ?
                `, [values]);
            }
            console.log(`Processed SMS LogID ${offset}`);
        }

        console.log('👉 Skipping Email Logs (ILET_EMAIL_LOG is empty).');

        console.log('✅ Message Logs Migration Completed.');

    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

migrateMessageLogs();
