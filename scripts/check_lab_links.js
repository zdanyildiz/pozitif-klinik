const sql = require('mssql');

async function checkLabGroupTests() {
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

        const tables = ['Lab_TestGrubu_Test', 'LAB_TESTLER'];

        for (const table of tables) {
            console.log(`\n--- SCHEMA OF ${table} ---`);
            let query = `
                SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}'
            `;
            let result = await pool.request().query(query);
            result.recordset.forEach(row => console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE})`));

            console.log(`\n--- DATA FROM ${table} (TOP 20) ---`);
            let dataResult = await pool.request().query(`SELECT TOP 20 * FROM ${table}`);
            console.log(JSON.stringify(dataResult.recordset, null, 2));
        }

        pool.close();
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

checkLabGroupTests();
