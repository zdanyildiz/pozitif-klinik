const sql = require('mssql');

async function checkCounts(port) {
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

    const tables = [
        'LST_ICDKODLARI',
        'HST_TIBBI_ICD',
        'Tmp_MedulaTeshisListesi',
        'Skrs_IcdO',
        'HST_TIBBI_RECETE_ICD',
        'TETKIK_ICD',
        'LST_ICDKODLARI_ANAGRUPLAR',
        'LST_ICDKODLARI_GRUPKODLAR',
        'HST_RAPORLAR_GSS_TANI',
        'TIBBI_EPIKRIZ_SABLON_ICD',
        'Tibbi_Recete_Sablon_ICD'
    ];

    try {
        let pool = await sql.connect(config);
        console.log('--- TABLE RECORD COUNTS ---');

        for (const table of tables) {
            try {
                let result = await pool.request().query(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`${table}: ${result.recordset[0].count} records`);
            } catch (e) {
                console.log(`${table}: Error or Table not found`);
            }
        }

        pool.close();
        return true;
    } catch (err) {
        return false;
    }
}

async function main() {
    let success = await checkCounts(1433);
    if (!success) {
        success = await checkCounts(433);
    }
}

main();
