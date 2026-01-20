-- Migration: Detail Patient Records & Vitals
-- Created: 2026-01-20
-- Description: Adds birth_date, gender, blood_type, address, notes, status to ptn_cards and creates ptn_vitals table.

-- 1. MEVCUT HASTA KARTINI GENİŞLETME
-- Statik veriler (Doğum tarihi, Cinsiyet, Kan Grubu, Adres, Notlar)
ALTER TABLE `ptn_cards`
ADD COLUMN `birth_date` DATE NULL AFTER `tc_no`,
ADD COLUMN `gender` ENUM('M', 'F', 'U') DEFAULT 'U' COMMENT 'M:Male, F:Female, U:Unknown' AFTER `birth_date`,
ADD COLUMN `blood_type` ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-') NULL AFTER `gender`,
ADD COLUMN `address` TEXT NULL AFTER `email`,
ADD COLUMN `notes` TEXT NULL COMMENT 'Personel özel notları' AFTER `address`,
ADD COLUMN `status` TINYINT(1) DEFAULT 1 COMMENT '1:Aktif, 0:Pasif (Arşiv)' AFTER `notes`;

-- 2. YENİ TABLO: YAŞAM BULGULARI (VITALS)
-- Dinamik veriler (Boy, Kilo, Tansiyon - Zaman damgalı takip)
CREATE TABLE IF NOT EXISTS `ptn_vitals` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `clinic_id` BIGINT UNSIGNED NOT NULL,
    `patient_id` BIGINT UNSIGNED NOT NULL,
    `height` SMALLINT UNSIGNED NULL COMMENT 'cm cinsinden',
    `weight` DECIMAL(5,2) NULL COMMENT 'kg cinsinden',
    `systolic_bp` SMALLINT UNSIGNED NULL COMMENT 'Büyük Tansiyon (mmHg)',
    `diastolic_bp` SMALLINT UNSIGNED NULL COMMENT 'Küçük Tansiyon (mmHg)',
    `heart_rate` SMALLINT UNSIGNED NULL COMMENT 'Nabız (bpm)',
    `measured_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `created_by` BIGINT UNSIGNED NULL COMMENT 'Ölçümü giren personel ID',
    FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`patient_id`) REFERENCES `ptn_cards`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
