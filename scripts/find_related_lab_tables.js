const sql = require('mssql');

async function findRelatedTables() {
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

        let query = `
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE 'Tibbi_Standart_Tetkik_Sablon%'
        `;
        let result = await pool.request().query(query);
        console.log('--- RELATED TABLES ---');
        result.recordset.forEach(row => {
            console.log(row.TABLE_NAME);
        });

        // Also search for anything related to "Sablon" and "Tetkik" together
        query = `
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE '%Tetkik%' AND TABLE_NAME LIKE '%Sablon%'
        `;
        result = await pool.request().query(query);
        console.log('\n--- TETKIK & SABLON TABLES ---');
        result.recordset.forEach(row => {
            console.log(row.TABLE_NAME);
        });

        pool.close();
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

findRelatedTables();
