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
        let result = await pool.request().query("SELECT TOP 5 GELISNO, SIKAYETI, TANI FROM HST_TIBBI_ANAMNEZ");
        console.log(JSON.stringify(result.recordset, null, 2));
        pool.close();
        return true;
    } catch (err) {
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
