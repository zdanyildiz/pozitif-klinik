const sql = require('mssql');
const mysql = require('mysql2/promise');
const { getSourceConfig, getTargetConfig } = require('./core/db.helper');

const dbConfig = getTargetConfig();
const mssqlConfig1 = getSourceConfig();
const mssqlConfig2 = getSourceConfig({ port: 433 });

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

        // CHECK: ICD tablosu dolu mu?
        const [rows] = await mysqlConn.execute('SELECT COUNT(*) as count FROM sys_icd10');
        const count = rows[0].count;

        if (count > 100) {
            console.log(`\n⚠️ SİSTEM UYARISI: sys_icd10 tablosunda zaten ${count} kayıt var.`);
            console.log('   Global ICD kütüphanesi korundu ve üzerine yazılmadı.');
            console.log('   (Yeniden yüklemek istiyorsanız tabloyu manuel boşaltın veya --force kullanın - henüz implemente edilmedi)');

            await mysqlConn.end();
            await pool.close();
            return;
        }

        console.log('Target table looks empty or small. Proceeding with full migration...');

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
        throw err;
    }
}

migrateICD().catch(err => { console.error(err); process.exit(1); });
