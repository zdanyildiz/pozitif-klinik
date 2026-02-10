const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// XAMPP Default Config
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // XAMPP default
    multipleStatements: true
};

const DB_NAME = 'test_klinik';
const MIGRATIONS_DIR = path.resolve(__dirname, '../migration/database/migrations');
const SEEDS_DIR = path.resolve(__dirname, '../migration/database');

async function main() {
    let connection;
    try {
        console.log('Connecting to MySQL...');
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected.');

        // 1. Create Database
        console.log(`Creating database: ${DB_NAME}...`);
        await connection.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
        await connection.query(`CREATE DATABASE ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log('Database created.');

        // 2. Select Database
        await connection.changeUser({ database: DB_NAME });
        console.log(`Selected database: ${DB_NAME}`);

        // 3. Run Migrations
        if (fs.existsSync(MIGRATIONS_DIR)) {
            const files = fs.readdirSync(MIGRATIONS_DIR)
                .filter(file => file.endsWith('.sql'))
                .sort(); // Sort alphabetically (01_..., 02_...)

            if (files.length === 0) {
                console.log('No migration files found.');
            } else {
                console.log(`Found ${files.length} migration files.`);
                for (const file of files) {
                    console.log(`Running migration: ${file}`);
                    const filePath = path.join(MIGRATIONS_DIR, file);
                    const sql = fs.readFileSync(filePath, 'utf8');
                    if (sql.trim()) {
                        await connection.query(sql);
                    }
                }
            }
        } else {
            console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
        }

        // 4. Run Seeds
        // Order matters: locations -> platform_admin
        const seedFiles = [
            'seed_locations.sql',
            'seed_platform_admin.sql'
        ];

        // Add other seeds alphabetically if they exist and are not in the predefined list
        if (fs.existsSync(SEEDS_DIR)) {
            const extraSeeds = fs.readdirSync(SEEDS_DIR)
                .filter(file => file.startsWith('seed_') && file.endsWith('.sql') && !seedFiles.includes(file))
                .sort();
            seedFiles.push(...extraSeeds);
        }

        console.log(`Running seed files...`);
        for (const file of seedFiles) {
            const filePath = path.join(SEEDS_DIR, file);
            if (fs.existsSync(filePath)) {
                console.log(`Running seed: ${file}`);
                const sql = fs.readFileSync(filePath, 'utf8');
                if (sql.trim()) {
                    await connection.query(sql);
                }
            } else {
                console.warn(`Seed file not found: ${file} (skipping)`);
            }
        }

        console.log('\n✅ Database setup completed successfully!');

    } catch (err) {
        console.error('\n❌ Error during database setup:', err);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

main();
