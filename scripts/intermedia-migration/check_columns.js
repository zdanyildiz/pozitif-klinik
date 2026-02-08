const sql = require('mssql');
const { getSourceConfig } = require('./db.helper');

async function checkColumns() {
    try {
        const config = getSourceConfig();
        const pool = await sql.connect(config);

        console.log('Connected to MSSQL');

        // Check for SMS/Mail log tables
        const searchPatterns = ['%LOG%', '%SMS%', '%MAIL%', '%MESAJ%'];

        console.log('Searching for log tables...');
        const result = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE' 
            AND (TABLE_NAME LIKE '%LOG%' OR TABLE_NAME LIKE '%SMS%' OR TABLE_NAME LIKE '%MAIL%' OR TABLE_NAME LIKE '%MESAJ%')
            ORDER BY TABLE_NAME
        `);

        console.log('Found tables:', result.recordset.map(r => r.TABLE_NAME));

        // Check columns for GENELLOG specifically to find PK
        const genellogPK = await pool.request().query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
            AND TABLE_NAME = 'GENELLOG'
        `);
        console.log('GENELLOG PK:', genellogPK.recordset);

        await pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkColumns();
