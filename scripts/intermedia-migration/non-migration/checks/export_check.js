const sql = require('mssql');
const fs = require('fs');
const path = require('path');

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

async function exportTable(tableName, limit = 20) {
    try {
        let pool = await sql.connect(config);
        let result = await pool.request().query(`SELECT TOP ${limit} * FROM ${tableName}`);

        const outputPath = path.join('/home/zafer/htdocs/pozitif-klinik/docs/tablo-sql', `${tableName}_EXPORT.json`);
        fs.writeFileSync(outputPath, JSON.stringify(result.recordset, null, 2));
        console.log(`Exported ${tableName} to ${outputPath}`);

        pool.close();
    } catch (err) {
        console.log(`Error exporting ${tableName}: ${err.message}`);
    }
}

async function main() {
    await exportTable('HST_TIBBI', 10);
    await exportTable('HST_TIBBI_EPIKRIZ', 10);
    await exportTable('HST_TIBBI_EPIKRIZ_TAKIP', 10);
}

main();
