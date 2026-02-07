const sql = require('mssql');

async function checkSablonData() {
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

        const table = 'Tibbi_Standart_Tetkik_Sablon';
        let dataResult = await pool.request().query(`SELECT * FROM ${table}`);
        console.log(`\n--- DATA FROM ${table} ---`);
        console.log(JSON.stringify(dataResult.recordset, null, 2));

        pool.close();
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

checkSablonData();
