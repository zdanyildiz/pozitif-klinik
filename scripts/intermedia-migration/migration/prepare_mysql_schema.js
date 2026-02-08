/**
 * MySQL Şema Hazırlık Scripti
 * Legacy sütunları (legacy_id, legacy_visit_id vb.) ekler
 * 
 * Kullanım: node migration/prepare_mysql_schema.js
 */

const mysql = require('mysql2/promise');
const { getTargetConfig } = require('../db.helper');

async function main() {
    const dbConfig = getTargetConfig();
    console.log(`Hedef veritabanı: ${dbConfig.database}`);

    const conn = await mysql.createConnection(dbConfig);

    console.log('Veritabanına bağlanıldı. Eksik sütunlar ekleniyor...');

    const alters = [
        // Patients
        "ALTER TABLE `ptn_cards` MODIFY COLUMN `tc_no` varchar(255) DEFAULT NULL ",
        "ALTER TABLE `ptn_cards` MODIFY COLUMN `phone` varchar(255) DEFAULT NULL ",
        "ALTER TABLE `cln_appointments` MODIFY COLUMN `appointment_date` datetime DEFAULT NULL ",
        "ALTER TABLE `ptn_cards` ADD COLUMN `father_name` varchar(100) DEFAULT NULL AFTER `name` ",
        "ALTER TABLE `ptn_cards` ADD COLUMN `mother_name` varchar(100) DEFAULT NULL AFTER `father_name` ",
        "ALTER TABLE `ptn_cards` ADD COLUMN `birth_place` varchar(100) DEFAULT NULL AFTER `birth_date` ",
        "ALTER TABLE `ptn_cards` ADD COLUMN `nationality` varchar(10) DEFAULT 'TR' AFTER `birth_place` ",
        "ALTER TABLE `ptn_cards` ADD COLUMN `profession` varchar(100) DEFAULT NULL AFTER `notes` ",
        "ALTER TABLE `ptn_cards` ADD COLUMN `legacy_id` bigint(20) DEFAULT NULL COMMENT 'Old System Patient ID' ",
        "ALTER TABLE `ptn_cards` ADD INDEX `idx_legacy_id` (`clinic_id`, `legacy_id`) ",

        // Users
        "ALTER TABLE `sys_users` ADD COLUMN `legacy_id` bigint(20) DEFAULT NULL COMMENT 'Old System TAKIPNO' ",
        "ALTER TABLE `sys_users` ADD INDEX `idx_user_legacy_id` (`clinic_id`, `legacy_id`) ",

        // Services
        "ALTER TABLE `cln_services` ADD COLUMN `legacy_code` varchar(20) DEFAULT NULL COMMENT 'Old System TETKIK.KOD' AFTER `name` ",
        "ALTER TABLE `cln_services` ADD INDEX `idx_service_legacy_code` (`clinic_id`, `legacy_code`) ",

        // Appointments
        "ALTER TABLE `cln_appointments` ADD COLUMN `protocol_no` varchar(50) DEFAULT NULL AFTER `id` ",
        "ALTER TABLE `cln_appointments` ADD COLUMN `legacy_visit_id` bigint(20) DEFAULT NULL COMMENT 'Old System GELISNO' ",
        "ALTER TABLE `cln_appointments` ADD INDEX `idx_appt_legacy_id` (`clinic_id`, `legacy_visit_id`) ",

        // Examinations
        "ALTER TABLE `cln_examinations` ADD COLUMN `complaint` text DEFAULT NULL AFTER `anamnez` ",
        "ALTER TABLE `cln_examinations` ADD COLUMN `story` text DEFAULT NULL AFTER `complaint` ",
        "ALTER TABLE `cln_examinations` ADD COLUMN `diagnosis` text DEFAULT NULL AFTER `bulgular` ",
        "ALTER TABLE `cln_examinations` ADD COLUMN `treatment` text DEFAULT NULL AFTER `diagnosis` ",
        "ALTER TABLE `cln_examinations` ADD COLUMN `result_note` text DEFAULT NULL AFTER `treatment` ",
        "ALTER TABLE `cln_examinations` ADD COLUMN `legacy_visit_id` bigint(20) DEFAULT NULL "
    ];

    for (const sql of alters) {
        try {
            console.log(`Çalıştırılıyor: ${sql.substring(0, 50)}...`);
            await conn.query(sql);
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') {
                console.log('Sütun veya indeks zaten mevcut, geçiliyor.');
            } else {
                console.error('Hata:', err.message);
            }
        }
    }

    console.log('Şema güncelleme tamamlandı.');
    await conn.end();
}

main().catch(console.error);
