const sql = require('mssql');
const { getSourceConfig } = require('./db.helper');

async function inspectLogColumns() {
    try {
        const config = getSourceConfig();
        const pool = await sql.connect(config);

        console.log('Connected to MSSQL for Log Inspection');

        const tables = [
            'ILET_SMS_LOG',
            'ILET_EMAIL_LOG',
            'Hst_Anadosya_GizlilikOnamFormu_Log',
            'Kullanici_Log_KayitErisim'
        ];

        for (const tableName of tables) {
            console.log(`\n--- Columns for ${tableName} ---`);
            const result = await pool.request().query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '${tableName}'
                ORDER BY COLUMN_NAME
            `);

            result.recordset.forEach(row => {
                console.log(row.COLUMN_NAME);
            });

            // Check PK
            const pk = await pool.request().query(`
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
                AND TABLE_NAME = '${tableName}'
            `);
            console.log('PK:', pk.recordset);
        }

        await pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

inspectLogColumns();
