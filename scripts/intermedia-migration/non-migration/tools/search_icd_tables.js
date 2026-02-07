const sql = require('mssql');

async function searchTables(port) {
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
        let result = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND (TABLE_NAME LIKE '%ICD%' OR TABLE_NAME LIKE '%TANI%' OR TABLE_NAME LIKE '%TESHIS%') ORDER BY TABLE_NAME");

        console.log('--- POTENTIAL ICD/TANI TABLES ---');
        result.recordset.forEach(row => {
            console.log(row.TABLE_NAME);
        });

        pool.close();
        return true;
    } catch (err) {
        return false;
    }
}

async function main() {
    let success = await searchTables(1433);
    if (!success) {
        success = await searchTables(433);
    }
}

main();
