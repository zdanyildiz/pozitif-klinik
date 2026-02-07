const sql = require('mssql');

async function checkTable(port) {
    const config = {
        user: 'sa',
        password: '#Global2025*',
        server: 'localhost',
        database: 'ErhanOzel',
        port: port,
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };

    try {
        let pool = await sql.connect(config);

        const tables = ['UZM_ICHASTALIKLARI_HST_ANAMNEZ', 'HST_TIBBI_EPIKRIZ'];

        for (const tableName of tables) {
            console.log(`\n\n--- Checking ${tableName} ---`);
            try {
                // Get Count
                let countRes = await pool.request().query(`SELECT COUNT(*) as count FROM ${tableName}`);
                console.log(`Row Count: ${countRes.recordset[0].count}`);

                // Get Columns
                let cols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}'`);
                console.log('Columns:', cols.recordset.map(r => r.COLUMN_NAME).join(', '));

                // Get Sample Data
                console.log('Sample Data (First 1 row):');
                let data = await pool.request().query(`SELECT TOP 1 * FROM ${tableName}`);
                console.log(JSON.stringify(data.recordset, null, 2));
            } catch (e) {
                console.log(`Error checking ${tableName}: ${e.message}`);
            }
        }

        pool.close();
        return true;
    } catch (err) {
        // console.error(err);
        return false;
    }
}

async function main() {
    let success = await checkTable(1433);
    if (!success) {
        success = await checkTable(433);
    }
    if (!success) {
        console.error("Failed to connect to DB");
    }
}

main();
