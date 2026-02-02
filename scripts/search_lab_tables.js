const sql = require('mssql');

async function searchTables() {
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
            WHERE TABLE_TYPE = 'BASE TABLE' 
            AND (
                TABLE_NAME LIKE '%TETKIK%' OR 
                TABLE_NAME LIKE '%LAB%' OR 
                TABLE_NAME LIKE '%TEST%' OR 
                TABLE_NAME LIKE '%SABLON%' OR
                TABLE_NAME LIKE '%Grup%' OR
                TABLE_NAME LIKE '%Panel%'
            )
            ORDER BY TABLE_NAME
        `;

        let result = await pool.request().query(query);

        console.log('--- POTENTIAL LAB/TEMPLATE TABLES ---');
        result.recordset.forEach(row => {
            console.log(row.TABLE_NAME);
        });

        pool.close();
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

searchTables();
