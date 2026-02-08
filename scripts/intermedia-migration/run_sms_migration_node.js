const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');

const { getTargetConfig } = require('./db.helper');

async function run() {
    try {
        // 2. Bağlantı Ayarları
        const config = getTargetConfig({
            multipleStatements: true // SQL dosyasını tek seferde çalıştırmak için
        });

        console.log('Connecting to MySQL...', { ...config, password: '***' });
        const connection = await mysql.createConnection(config);
        console.log('Connected.');

        // 3. SQL Dosyasını Oku
        const sqlPath = path.resolve(__dirname, '../migration/database/migrations/12_sms_module.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // 4. Çalıştır
        console.log('Executing Migration 12...');
        await connection.query(sql);
        console.log('Migration executed successfully.');

        // 5. Seed Data Kontrol
        const [rows] = await connection.query('SELECT * FROM sys_sms_providers');
        console.log('Verifying providers table:', rows.length, 'records found.');

        await connection.end();

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
