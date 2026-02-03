const sql = require('mssql');

async function listTables(port) {
    const config = {
        user: 'sa',
        password: '#Global2025*', // Şifre güncellendi
        server: 'localhost',
        database: 'ErhanOzel',
        port: port,
        options: {
            encrypt: false, // Local bağlantı için genelde false veya true+trust gerekir
            trustServerCertificate: true
        }
    };

    try {
        console.log(`Trying connection on port ${port}...`);
        let pool = await sql.connect(config);
        console.log('Connected!');
        let result = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");

        console.log('--- TABLES ---');
        result.recordset.forEach(row => {
            console.log(row.TABLE_NAME);
        });

        pool.close();
        return true;
    } catch (err) {
        console.log(`Failed on port ${port}: ${err.message}`);
        return false;
    }
}

async function main() {
    // Önce 1433 dene
    let success = await listTables(1433);
    if (!success) {
        // Sonra 433 dene
        success = await listTables(433);
    }

    if (!success) {
        console.log("Could not connect with empty password on ports 1433 or 433.");
    }
}

main();
