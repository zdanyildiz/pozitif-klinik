const sql = require('mssql');

async function searchTables(port, patterns) {
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
        let result = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");

        const tables = result.recordset.map(row => row.TABLE_NAME);

        console.log(`\nFound ${tables.length} total tables.`);
        console.log('--- MATCHING TABLES ---');

        const matches = tables.filter(t => patterns.some(p => t.toUpperCase().includes(p.toUpperCase())));
        matches.forEach(t => console.log(t));

        pool.close();
        return true;
    } catch (err) {
        console.log(`Failed on port ${port}: ${err.message}`);
        return false;
    }
}

async function main() {
    const patterns = ['DOSYA', 'FILE', 'RESIM', 'IMG', 'LAB', 'SONUC', 'TEST', 'TETKIK', 'PATOLOJI', 'RADYOLOJI'];

    // Önce 1433 dene
    let success = await searchTables(1433, patterns);
    if (!success) {
        // Sonra 433 dene
        success = await searchTables(433, patterns);
    }
}

main();
