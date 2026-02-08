const sql = require('mssql');
const { getSourceConfig } = require('./db.helper');

async function inspectMessageTables() {
    try {
        const config = getSourceConfig();
        const pool = await sql.connect(config);

        console.log('Connected to MSSQL for Message Table Inspection');

        const tables = [
            'ILET_SMS',
            'ILET_EMAIL_GONDERILEN'
        ];

        for (const tableName of tables) {
            console.log(`\n--- Columns for ${tableName} ---`);
            const cols = await pool.request().query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '${tableName}'
                ORDER BY COLUMN_NAME
            `);
            console.log(cols.recordset.map(r => r.COLUMN_NAME));

            // Check PK
            const pk = await pool.request().query(`
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
                AND TABLE_NAME = '${tableName}'
            `);
            const pkName = pk.recordset.length > 0 ? pk.recordset[0].COLUMN_NAME : 'TARIH';

            console.log(`\n--- Data Sample for ${tableName} ---`);
            try {
                const data = await pool.request().query(`
                    SELECT TOP 5 * FROM ${tableName} ORDER BY ${pkName} DESC
                `);
                console.log(data.recordset);
            } catch (e) {
                console.log('Error querying data: ' + e.message);
            }
        }

        await pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

inspectMessageTables();
