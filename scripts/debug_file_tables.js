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

async function getColumns(pool, tableName) {
    let result = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
    `);
    console.log(`\n=== ${tableName} ===`);
    result.recordset.forEach(row => {
        console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE})`);
    });
}

async function main() {
    let pool = await sql.connect(config);
    const tables = [
        'HST_TIBBI_DOSYALAR',
        'KISISEL_HASTADOSYALARI',
        'Sistem_Dosyalar',
        'Hst_Lab_Patoloji_Goruntu',
        'HST_LAB_RAPOR',
        'TETKIK_RAPORLAR',
        'EvrakTakip_GelenGidenEvrak_Dosya'
    ];

    for (const table of tables) {
        await getColumns(pool, table);
    }

    pool.close();
}

main().catch(console.error);
