const sql = require('mssql');

const mssqlConfig = {
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

async function checkSchema() {
    try {
        await sql.connect(mssqlConfig);
        const result = await sql.query`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'HST_ODEMELER'
        `;
        console.log('Columns in HST_ODEMELER:');
        result.recordset.forEach(row => console.log(row.COLUMN_NAME));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

checkSchema();
