const sql = require('mssql');

const config = {
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

async function main() {
    let pool = await sql.connect(config);

    // 1. Check Tables with Binary Data
    let res = await pool.request().query(`
        SELECT DISTINCT t.TABLE_NAME
        FROM INFORMATION_SCHEMA.COLUMNS c
        JOIN INFORMATION_SCHEMA.TABLES t ON c.TABLE_NAME = t.TABLE_NAME
        WHERE c.DATA_TYPE IN ('image', 'varbinary', 'binary')
        AND t.TABLE_TYPE = 'BASE TABLE'
    `);

    console.log('--- Tables with Binary Columns ---');
    for (const row of res.recordset) {
        const table = row.TABLE_NAME;
        let countRes = await pool.request().query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = countRes.recordset[0].count;
        if (count > 0) {
            console.log(`${table}: ${count} records`);
            // Show columns
            let colRes = await pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' AND DATA_TYPE IN ('image', 'varbinary', 'binary')`);
            colRes.recordset.forEach(c => console.log(`  - ${c.COLUMN_NAME} (${c.DATA_TYPE})`));
        }
    }

    // 2. Check Tables with "DOSYA", "RAPOR", "YOL" in name and have records
    let res2 = await pool.request().query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        AND (TABLE_NAME LIKE '%DOSYA%' OR TABLE_NAME LIKE '%RAPOR%' OR TABLE_NAME LIKE '%PATH%' OR TABLE_NAME LIKE '%YOL%')
    `);

    console.log('\n--- Tables with File/Report/Path in name ---');
    for (const row of res2.recordset) {
        const table = row.TABLE_NAME;
        try {
            let countRes = await pool.request().query(`SELECT COUNT(*) as count FROM ${table}`);
            const count = countRes.recordset[0].count;
            if (count > 0) {
                console.log(`${table}: ${count} records`);
            }
        } catch (e) { }
    }

    pool.close();
}

main().catch(console.error);
