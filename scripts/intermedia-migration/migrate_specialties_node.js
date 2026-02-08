const mysql = require('mysql2/promise');

const { getTargetConfig } = require('./db.helper');
const dbConfig = getTargetConfig();

async function migrateSpecialties() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        console.log("Connected to MySQL");

        // 1. Drop old table
        await conn.query("DROP TABLE IF EXISTS sys_specialty_forms");
        console.log("Dropped sys_specialty_forms");

        // 2. Create new table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS sys_medical_specialties (
              id int(10) unsigned NOT NULL AUTO_INCREMENT,
              code varchar(50) NOT NULL,
              name varchar(100) NOT NULL,
              icd_prefixes varchar(255) DEFAULT NULL COMMENT 'Comma separated ICD-10 prefixes for search boost',
              form_schema LONGTEXT DEFAULT NULL,
              is_active tinyint(1) DEFAULT 1,
              created_at timestamp NOT NULL DEFAULT current_timestamp(),
              PRIMARY KEY (id),
              UNIQUE KEY specialty_code (code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Created sys_medical_specialties");

        // 3. Insert Data
        const defaults = [
            ['INTERNAL_MEDICINE', 'İç Hastalıkları (Dahiliye)', 'A,B,E,J,I,N'],
            ['CARDIOLOGY', 'Kardiyoloji', 'I'],
            ['ENT', 'Kulak Burun Boğaz', 'H,J'],
            ['OPHTHALMOLOGY', 'Göz Hastalıkları', 'H'],
            ['ORTHOPEDICS', 'Ortopedi ve Travmatoloji', 'M'],
            ['DERMATOLOGY', 'Dermatoloji (Cildiye)', 'L'],
            ['NEUROLOGY', 'Nöroloji', 'G'],
            ['PSYCHIATRY', 'Psikiyatri', 'F'],
            ['GYNECOLOGY', 'Kadın Hastalıkları ve Doğum', 'O'],
            ['PEDIATRICS', 'Çocuk Sağlığı ve Hastalıkları', 'A,B,E,J,P,Q'],
            ['UROLOGY', 'Üroloji', 'N'],
            ['GENERAL_SURGERY', 'Genel Cerrahi', 'K,C,D'],
            ['PULMONOLOGY', 'Göğüs Hastalıkları', 'J'],
            ['ENDOCRINOLOGY', 'Endokrinoloji', 'E'],
            ['INFECTIOUS_DISEASES', 'Enfeksiyon Hastalıkları', 'A,B'],
            ['EMERGENCY', 'Acil Tıp', 'R,S,T']
        ];

        for (const [code, name, prefix] of defaults) {
            await conn.query(
                "INSERT IGNORE INTO sys_medical_specialties (code, name, icd_prefixes) VALUES (?, ?, ?)",
                [code, name, prefix]
            );
        }
        console.log("Inserted default specialties");

        conn.end();
    } catch (err) {
        console.error(err);
    }
}

migrateSpecialties();
