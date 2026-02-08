const sql = require('mssql');
const { getSourceConfig } = require('./db.helper');

async function inspectGenellog() {
    try {
        const config = getSourceConfig();
        const pool = await sql.connect(config);

        console.log('Connected to MSSQL to inspect GENELLOG');

        const result = await pool.request().query(`
            SELECT TOP 5 * FROM GENELLOG ORDER BY RECORD_ID DESC
        `);

        console.log(result.recordset);

        await pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

inspectGenellog();
