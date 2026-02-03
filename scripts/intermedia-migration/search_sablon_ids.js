const sql = require('mssql');

async function searchColumns() {
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
            SELECT TABLE_NAME, COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE COLUMN_NAME LIKE '%SablonID%' OR COLUMN_NAME LIKE '%SABLON_ID%'
            ORDER BY TABLE_NAME
        `;
        let result = await pool.request().query(query);
        console.log('--- TABLES WITH SABLON_ID COLUMN ---');
        result.recordset.forEach(row => {
            console.log(`${row.TABLE_NAME}.${row.COLUMN_NAME}`);
        });

        pool.close();
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

searchColumns();
