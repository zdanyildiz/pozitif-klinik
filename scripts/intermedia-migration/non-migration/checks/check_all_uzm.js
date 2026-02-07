const sql = require('mssql');

async function checkUzmTables(port) {
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
        let result = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE 'UZM_%_HST_ANAMNEZ'
        `);

        console.log('--- UZM ANAMNEZ COUNTS ---');
        for (const row of result.recordset) {
            let countRes = await pool.request().query(`SELECT COUNT(*) as count FROM ${row.TABLE_NAME}`);
            console.log(`${row.TABLE_NAME}: ${countRes.recordset[0].count}`);
        }

        pool.close();
        return true;
    } catch (err) {
        return false;
    }
}

async function main() {
    let success = await checkUzmTables(1433);
    if (!success) {
        success = await checkUzmTables(433);
    }
}

main();
