const sql = require('mssql');

async function checkEpikriz(port) {
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
            SELECT 
                t.GELISNO,
                et.SIKAYETLER
            FROM HST_TIBBI_EPIKRIZ_TAKIP et
            INNER JOIN HST_TIBBI_EPIKRIZ e ON et.EPIKRIZ_ID = e.ID
            INNER JOIN HST_TIBBI t ON e.TIBBIDOSYA_ID = t.RECORD_ID
            WHERE t.GELISNO = 497
        `);
        console.log(JSON.stringify(result.recordset, null, 2));
        pool.close();
        return true;
    } catch (err) {
        return false;
    }
}

async function main() {
    let success = await checkEpikriz(1433);
    if (!success) {
        success = await checkEpikriz(433);
    }
}

main();
