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

async function checkData(pool, tableName) {
    let result = await pool.request().query(`SELECT COUNT(*) as count FROM ${tableName}`);
    console.log(`\nTable ${tableName} has ${result.recordset[0].count} records.`);

    if (result.recordset[0].count > 0) {
        let sample = await pool.request().query(`SELECT TOP 5 * FROM ${tableName}`);
        console.log('Sample rows:');
        console.log(JSON.stringify(sample.recordset, null, 2));
    }
}

async function main() {
    let pool = await sql.connect(config);
    const tables = [
        'HST_TIBBI_DOSYALAR',
        'Sistem_Dosyalar',
        'Hst_Lab_Patoloji_Goruntu',
        'EvrakTakip_GelenGidenEvrak_Dosya'
    ];

    for (const table of tables) {
        await checkData(pool, table);
    }

    pool.close();
}

main().catch(console.error);
