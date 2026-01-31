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

    // Check HST_ANADOSYA for common patient fields
    let res = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HST_ANADOSYA'");
    console.log('=== HST_ANADOSYA ===');
    res.recordset.forEach(row => {
        if (row.DATA_TYPE === 'image' || row.DATA_TYPE === 'varbinary' || row.COLUMN_NAME.includes('RESIM') || row.COLUMN_NAME.includes('FOTO')) {
            console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE})`);
        }
    });

    // Check HST_LAB_RAPOR count
    let res2 = await pool.request().query("SELECT COUNT(*) as count FROM HST_LAB_RAPOR");
    console.log(`\nHST_LAB_RAPOR has ${res2.recordset[0].count} records.`);

    // Search for more tables
    let res3 = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
    const tables = res3.recordset.map(r => r.TABLE_NAME);
    const patterns = ['RESIM', 'FOTO', 'IMAGE', 'BINARY', 'BLOB', 'DOSYA', 'EK', 'BELGE'];

    console.log('\n--- Possible File/Image Tables ---');
    const matches = tables.filter(t => patterns.some(p => t.toUpperCase().includes(p)));

    for (const table of matches) {
        let countRes = await pool.request().query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = countRes.recordset[0].count;
        if (count > 0) {
            console.log(`${table}: ${count} records`);
        }
    }

    pool.close();
}

main().catch(console.error);
