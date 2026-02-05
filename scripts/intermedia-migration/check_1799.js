const sql = require('mssql');

async function checkOldRecord(port) {
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
        let result = await pool.request().query("SELECT GELISNO, SIKAYETLER, TANI FROM UZM_ICHASTALIKLARI_HST_ANAMNEZ WHERE GELISNO = 1799");
        console.log(JSON.stringify(result.recordset, null, 2));
        pool.close();
        return true;
    } catch (err) {
        return false;
    }
}

async function main() {
    let success = await checkOldRecord(1433);
    if (!success) {
        success = await checkOldRecord(433);
    }
}

main();
