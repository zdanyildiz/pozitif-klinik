const sql = require('mssql');

async function checkCount(port) {
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
        let result = await pool.request().query("SELECT COUNT(*) as count FROM HST_TIBBI_EPIKRIZ_TAKIP");
        console.log(`HST_TIBBI_EPIKRIZ_TAKIP: ${result.recordset[0].count}`);
        pool.close();
        return true;
    } catch (err) {
        return false;
    }
}

async function main() {
    let success = await checkCount(1433);
    if (!success) {
        success = await checkCount(433);
    }
}

main();
