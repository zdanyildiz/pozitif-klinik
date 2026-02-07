const sql = require('mssql');

async function checkTable(port) {
    const config = {
        user: 'sa',
        password: '#Global2025*',
        server: 'localhost',
        database: 'ErhanOzel',
        port: port,
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };

    try {
        let pool = await sql.connect(config);

        console.log('--- Columns of HST_TIBBI_ICD ---');
        let cols = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HST_TIBBI_ICD'");
        cols.recordset.forEach(row => console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE})`));

        console.log('\n--- Sample Data ---');
        let data = await pool.request().query("SELECT TOP 5 * FROM HST_TIBBI_ICD");
        console.log(JSON.stringify(data.recordset, null, 2));

        pool.close();
        return true;
    } catch (err) {
        return false;
    }
}

async function main() {
    let success = await checkTable(1433);
    if (!success) {
        success = await checkTable(433);
    }
}

main();
