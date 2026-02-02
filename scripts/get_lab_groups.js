const sql = require('mssql');

async function checkLabGroups() {
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

        let dataResult = await pool.request().query(`SELECT * FROM Lab_TestGrubu`);
        console.log(`\n--- DATA FROM Lab_TestGrubu ---`);
        console.log(JSON.stringify(dataResult.recordset, null, 2));

        dataResult = await pool.request().query(`SELECT * FROM LAB_AYAR_TANIMLITESTLER`);
        console.log(`\n--- DATA FROM LAB_AYAR_TANIMLITESTLER ---`);
        console.log(JSON.stringify(dataResult.recordset, null, 2));

        pool.close();
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

checkLabGroups();
