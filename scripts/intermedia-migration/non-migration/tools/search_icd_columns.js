const sql = require('mssql');

async function searchColumns(port) {
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

        console.log('--- Tables with TANI or TESHIS columns ---');
        let result = await pool.request().query("SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME LIKE '%TANI%' OR COLUMN_NAME LIKE '%TESHIS%' OR COLUMN_NAME LIKE '%ICD%' ORDER BY TABLE_NAME");

        result.recordset.forEach(row => {
            console.log(`${row.TABLE_NAME} -> ${row.COLUMN_NAME}`);
        });

        pool.close();
        return true;
    } catch (err) {
        return false;
    }
}

async function main() {
    let success = await searchColumns(1433);
    if (!success) {
        success = await searchColumns(433);
    }
}

main();
