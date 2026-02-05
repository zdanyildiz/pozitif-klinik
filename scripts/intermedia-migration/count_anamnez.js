const sql = require('mssql');

async function checkAnamnez(port) {
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
        let result = await pool.request().query("SELECT COUNT(*) as count FROM HST_TIBBI_ANAMNEZ");
        console.log(`Count: ${result.recordset[0].count}`);
        pool.close();
        return true;
    } catch (err) {
        console.log("Error: " + err.message);
        return false;
    }
}

async function main() {
    let success = await checkAnamnez(1433);
    if (!success) {
        success = await checkAnamnez(433);
    }
}

main();
