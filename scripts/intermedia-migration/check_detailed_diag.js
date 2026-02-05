const sql = require('mssql');

async function checkKlinikData(port) {
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

        console.log('--- Columns of UZM_ICHASTALIKLARI_HST_ANAMNEZ ---');
        let cols1 = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'UZM_ICHASTALIKLARI_HST_ANAMNEZ'");
        cols1.recordset.forEach(row => console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE})`));

        console.log('\n--- Sample Data from UZM_ICHASTALIKLARI_HST_ANAMNEZ (Top 3) ---');
        let data1 = await pool.request().query("SELECT TOP 3 * FROM UZM_ICHASTALIKLARI_HST_ANAMNEZ");
        console.log(JSON.stringify(data1.recordset, null, 2));

        console.log('\n--- Columns of HST_TIBBI_EPIKRIZ ---');
        let cols2 = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HST_TIBBI_EPIKRIZ'");
        cols2.recordset.forEach(row => console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE})`));

        console.log('\n--- Sample Data from HST_TIBBI_EPIKRIZ (Top 3) ---');
        let data2 = await pool.request().query("SELECT TOP 3 * FROM HST_TIBBI_EPIKRIZ");
        console.log(JSON.stringify(data2.recordset, null, 2));

        pool.close();
        return true;
    } catch (err) {
        return false;
    }
}

async function main() {
    let success = await checkKlinikData(1433);
    if (!success) {
        success = await checkKlinikData(433);
    }
}

main();
