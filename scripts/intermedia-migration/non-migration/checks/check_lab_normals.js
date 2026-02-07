const sql = require('mssql');

async function checkNormals() {
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

        const table = 'LAB_TESTNORMALLERI';

        console.log(`\n--- SCHEMA OF ${table} ---`);
        let query = `
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${table}'
            ORDER BY ORDINAL_POSITION
        `;
        let result = await pool.request().query(query);
        result.recordset.forEach(row => {
            console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE}${row.CHARACTER_MAXIMUM_LENGTH ? '[' + row.CHARACTER_MAXIMUM_LENGTH + ']' : ''})`);
        });

        console.log(`\n--- SAMPLE DATA FROM ${table} (TOP 20) ---`);
        let dataResult = await pool.request().query(`SELECT TOP 20 * FROM ${table}`);
        console.log(JSON.stringify(dataResult.recordset, null, 2));

        pool.close();
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

checkNormals();
