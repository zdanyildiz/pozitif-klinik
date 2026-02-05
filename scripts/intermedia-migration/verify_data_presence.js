const sql = require('mssql');

async function checkNonEmpty(port) {
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

        console.log('--- Non-Empty Diagnosis Columns ---');

        let r1 = await pool.request().query("SELECT COUNT(*) as count FROM UZM_ICHASTALIKLARI_HST_ANAMNEZ WHERE TANI IS NOT NULL AND TANI != ''");
        console.log(`UZM_ICHASTALIKLARI_HST_ANAMNEZ (TANI): ${r1.recordset[0].count} non-empty rows`);

        let r2 = await pool.request().query("SELECT COUNT(*) as count FROM HST_TIBBI_EPIKRIZ WHERE TESHIS IS NOT NULL AND TESHIS != ''");
        console.log(`HST_TIBBI_EPIKRIZ (TESHIS): ${r2.recordset[0].count} non-empty rows`);

        let r3 = await pool.request().query("SELECT COUNT(*) as count FROM HST_TIBBI_ICD WHERE ICD_KODU IS NOT NULL AND ICD_KODU != ''");
        console.log(`HST_TIBBI_ICD (ICD_KODU): ${r3.recordset[0].count} non-empty rows`);

        console.log('\n--- Sample from LST_ICDKODLARI (to verify it is really ICD) ---');
        let r4 = await pool.request().query("SELECT TOP 5 ICD_KODU, ACIKLAMA FROM LST_ICDKODLARI WHERE ICD_KODU LIKE 'E11%'");
        console.log(JSON.stringify(r4.recordset, null, 2));

        pool.close();
        return true;
    } catch (err) {
        return false;
    }
}

async function main() {
    let success = await checkNonEmpty(1433);
    if (!success) {
        success = await checkNonEmpty(433);
    }
}

main();
