const mysql = require('mysql2/promise');
const { getTargetConfig } = require('./db.helper');

async function test() {
    try {
        const config = getTargetConfig();
        console.log('Config:', config);
        const conn = await mysql.createConnection(config);
        console.log('Successfully connected to MySQL!');
        const [rows] = await conn.query('SHOW DATABASES');
        console.log('Databases:', rows.map(r => r.Database));
        await conn.end();
    } catch (err) {
        console.error('Connection failed:', err);
    }
}

test();
