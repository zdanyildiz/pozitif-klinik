const sql = require('mssql');

async function checkMoreTables(port) {
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
        'HST_TIBBI_ANAMNEZ',
        'HST_TIBBI_EPIKRIZ',
        'HST_TIBBI_DIABET',
        'UZM_ICHASTALIKLARI_HST_ANAMNEZ',
        'HST_GELISLER_GSS',
        'HST_RAPORLAR_GSS'
    ];

    try {
        let pool = await sql.connect(config);
        console.log('--- ADDITIONAL TABLE COUNTS ---');

        for (const table of tables) {
            try {
                let result = await pool.request().query(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`${table}: ${result.recordset[0].count} records`);
            } catch (e) {
                console.log(`${table}: Error or Table not found`);
            }
        }

        console.log('\n--- SAMPLE DATA FROM HST_TIBBI_ANAMNEZ ---');
        try {
            let data = await pool.request().query(`SELECT TOP 5 TANI, SIKAYETI, TIBBIDOSYA_ID FROM HST_TIBBI_ANAMNEZ WHERE TANI IS NOT NULL AND TANI != ''`);
            console.log(JSON.stringify(data.recordset, null, 2));
        } catch (e) {
            console.log('Failed to fetch sample from HST_TIBBI_ANAMNEZ');
        }

        pool.close();
        return true;
    } catch (err) {
        return false;
    }
}

async function main() {
    let success = await checkMoreTables(1433);
    if (!success) {
        success = await checkMoreTables(433);
    }
}

main();
