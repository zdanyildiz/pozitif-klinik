const sql = require('mssql');
const mysql = require('mysql2/promise');
// require('dotenv').config({ path: '/home/zafer/htdocs/pozitif-klinik/.env' });

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pozitif_klinik',
    charset: 'utf8mb4'
};

const mssqlConfig1 = {
    user: 'sa',
    password: '#Global2025*',
    server: 'localhost',
    database: 'ErhanOzel',
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const mssqlConfig2 = {
    ...mssqlConfig1,
    port: 433
};

async function migrateICD() {
    let pool;
    try {
        console.log('Connecting to MSSQL...');
        try {
            pool = await sql.connect(mssqlConfig1);
        } catch (err) {
            console.log('Port 1433 failed, trying 433...');
            pool = await sql.connect(mssqlConfig2);
        }

        console.log('Connecting to MySQL...');
        const mysqlConn = await mysql.createConnection(dbConfig);

        console.log('Fetching ICD codes from MSSQL...');
        // We only take distinct codes to avoid duplicate key errors if source has duplicates
        // Also filtering out null codes or empty strings
        const result = await pool.request().query(`
            SELECT DISTINCT
                ICD_KODU as code,
                ACIKLAMA as name
            FROM LST_ICDKODLARI
            WHERE ICD_KODU IS NOT NULL AND LEN(ICD_KODU) > 0
        `);

        const records = result.recordset;
        console.log(`Found ${records.length} ICD codes.`);

        console.log('Truncating target table sys_icd10...');
        await mysqlConn.execute('SET FOREIGN_KEY_CHECKS = 0');
        await mysqlConn.execute('TRUNCATE TABLE sys_icd10');
        await mysqlConn.execute('SET FOREIGN_KEY_CHECKS = 1');

        console.log('Inserting into MySQL...');

        let inserted = 0;
        let errors = 0;
        const batchSize = 1000;

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            const values = batch.map(r => [
                r.code.trim(),
                r.name ? r.name.trim() : 'Tanımsız'
            ]);

            try {
                await mysqlConn.query(
                    'INSERT IGNORE INTO sys_icd10 (code, name) VALUES ?',
                    [values]
                );
                inserted += values.length;
                process.stdout.write(`\rProgress: ${inserted}/${records.length}`);
            } catch (err) {
                console.error(`\nBatch error at index ${i}:`, err.message);
                errors++;
            }
        }

        console.log('\n\n--- Migration Summary ---');
        console.log(`Total Source Records: ${records.length}`);
        console.log(`Successfully Inserted: ${inserted}`);
        console.log(`Errors: ${errors}`);

        await mysqlConn.end();
        await pool.close();

    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrateICD();
