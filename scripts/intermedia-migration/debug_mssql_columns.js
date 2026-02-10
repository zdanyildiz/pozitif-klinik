const sql = require('mssql');
const { getSourceConfig } = require('./core/db.helper');

const tableName = process.argv[2] || 'HST_GELISLER';

async function debug() {
    try {
        const config = getSourceConfig();
        const pool = await sql.connect(config);

        console.log(`Checking columns for ${tableName}...`);

        const result = await pool.request().query(`
            SELECT TOP 1 * FROM ${tableName}
        `);

        console.log('Columns:', Object.keys(result.recordset[0] || {}));

        await pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

debug();
