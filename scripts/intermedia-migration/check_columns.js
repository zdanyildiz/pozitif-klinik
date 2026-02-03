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

async function getColumns(tableName) {
    let pool = await sql.connect(config);
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
    pool.close();
}

async function main() {
    await getColumns('HST_TIBBI');
}

main().catch(console.error);
