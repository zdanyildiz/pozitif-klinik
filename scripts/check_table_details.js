const sql = require('mssql');

async function getColumns(tableName) {
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

    try {
        let pool = await sql.connect(config);
        let result = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = '${tableName}'
            ORDER BY ORDINAL_POSITION
        `);
        console.log(`\n=== ${tableName} ===`);
        result.recordset.forEach(row => {
            console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE}${row.CHARACTER_MAXIMUM_LENGTH ? '(' + row.CHARACTER_MAXIMUM_LENGTH + ')' : ''})`);
        });
        pool.close();
    } catch (err) {
        console.log(`Error checking ${tableName}: ${err.message}`);
    }
}

async function main() {
    await getColumns('HST_TIBBI_DOSYALAR');
    await getColumns('HST_LAB_RAPOR');
    await getColumns('LAB_TESTLER');
    await getColumns('HST_LAB_BIYOKIMYA');
}

main();
