const sql = require('mssql');

async function checkTaniData(port) {
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

        console.log('\n--- Sample Real Diagnoses (TANI) from UZM_ICHASTALIKLARI_HST_ANAMNEZ ---');
        // Get non-junk looking diagnoses
        // Exclude short strings and common junk placeholders if possible, but distinct is key
        let query = `
            SELECT TOP 50 TANI, COUNT(*) as Count 
            FROM UZM_ICHASTALIKLARI_HST_ANAMNEZ 
            WHERE TANI IS NOT NULL AND LEN(TANI) > 4
            GROUP BY TANI 
            ORDER BY Count DESC
        `;

        let data = await pool.request().query(query);
        console.log(JSON.stringify(data.recordset, null, 2));

        pool.close();
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

async function main() {
    let success = await checkTaniData(1433);
    if (!success) {
        await checkTaniData(433);
    }
}

main();
