const sql = require('mssql');
const mysql = require('mysql2/promise');

const CLINIC_ID = 1;

const mssqlConfig = {
    user: 'sa', password: '#Global2025*', server: 'localhost', database: 'ErhanOzel', port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

const mysqlConfig = {
    host: '127.0.0.1', user: 'root', password: '', database: 'pozitif_klinik'
};

async function checkMissing() {
    let mssqlPool, mysqlConn;
    try {
        mssqlPool = await sql.connect(mssqlConfig);
        mysqlConn = await mysql.createConnection(mysqlConfig);

        console.log('--- Checking Missing Visit IDs ---');

        // Get some sample GELISNOs from MSSQL that have diagnosis but might be missing in MySQL
        const msRes = await mssqlPool.request().query("SELECT TOP 10 GELISNO FROM UZM_ICHASTALIKLARI_HST_ANAMNEZ WHERE TANI IS NOT NULL AND TANI != ''");
        const gelisNos = msRes.recordset.map(r => r.GELISNO);

        for (const g of gelisNos) {
            const [ex] = await mysqlConn.execute("SELECT id FROM cln_examinations WHERE legacy_visit_id = ?", [g]);
            const [app] = await mysqlConn.execute("SELECT id FROM cln_appointments WHERE legacy_visit_id = ?", [g]);
            console.log(`GELISNO ${g}: Exam=${ex.length > 0 ? 'YES' : 'NO'}, Appt=${app.length > 0 ? 'YES' : 'NO'}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

checkMissing();
