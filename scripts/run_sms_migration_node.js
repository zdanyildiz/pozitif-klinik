const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');

async function run() {
    try {
        // 1. .env dosyasını oku
        const envPath = path.resolve(__dirname, '../.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim();
                env[key] = val;
            }
        });

        // 2. Bağlantı Ayarları
        const config = {
            host: env.DB_HOST || 'localhost',
            user: env.DB_USER || 'root',
            password: env.DB_PASS || '',
            database: env.DB_NAME || 'pozitif_klinik',
            multipleStatements: true // SQL dosyasını tek seferde çalıştırmak için
        };

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
