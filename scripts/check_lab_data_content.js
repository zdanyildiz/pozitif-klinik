const sql = require('mssql');

async function checkHighPotentialTables() {
    const config = {
        user: 'sa',
        password: '#Global2025*',
        server: 'localhost',
        database: 'ErhanOzel',
        port: 1433,
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };

    try {
        let pool = await sql.connect(config);
        console.log('Connected!');

        const tables = [
            'Lab_TestGrubu',
            'LAB_AYAR_TANIMLITESTLER',
            'LAB_RAPORTESTGRUBU',
            'TETKIK',
            'TETKIK_FIYATLAR'
        ];

        for (const table of tables) {
            console.log(`\n--- DATA FROM ${table} ---`);
            let dataResult = await pool.request().query(`SELECT TOP 20 * FROM ${table}`);
            console.log(JSON.stringify(dataResult.recordset, null, 2));
        }

        pool.close();
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

checkHighPotentialTables();
