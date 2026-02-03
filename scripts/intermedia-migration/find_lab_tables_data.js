const sql = require('mssql');

async function findTablesWithData() {
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

        let query = `
            SELECT t.name AS TableName, p.rows AS RowCounts
            FROM sys.tables t
            INNER JOIN sys.partitions p ON t.object_id = p.object_id
            WHERE t.name LIKE '%LAB%' OR t.name LIKE '%TETKIK%' OR t.name LIKE '%TEST%' OR t.name LIKE '%SABLON%'
            AND p.index_id IN (0,1)
            ORDER BY p.rows DESC
        `;
        let result = await pool.request().query(query);
        console.log('--- TABLES WITH DATA ---');
        result.recordset.forEach(row => {
            if (row.RowCounts > 0) {
                console.log(`${row.TableName}: ${row.RowCounts} rows`);
            }
        });

        pool.close();
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

findTablesWithData();
