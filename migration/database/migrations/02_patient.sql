-- Pozitif Klinik - Hasta Yönetimi
-- Modül: Patient (ptn_)

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Hasta Kartları (Şifreli veriler)
DROP TABLE IF EXISTS `ptn_cards`;
CREATE TABLE `ptn_cards` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `tc_no` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `birth_place` varchar(100) DEFAULT NULL,
  `nationality` varchar(10) DEFAULT 'TR',
  `father_name` varchar(100) DEFAULT NULL,
  `mother_name` varchar(100) DEFAULT NULL,
  `gender` enum('M','F','U') DEFAULT 'U',
  `blood_type` varchar(10) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `province_id` int(10) unsigned DEFAULT NULL,
  `district_id` int(10) unsigned DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `profession` varchar(100) DEFAULT NULL,
  `medical_info` JSON DEFAULT NULL COMMENT 'Chronic diseases, allergies, medical warnings',
  `work_details` JSON DEFAULT NULL COMMENT 'Company, role, work phone, work address',
  `identity_details` JSON DEFAULT NULL COMMENT 'Marital status, spouse name, tax no, registry details',
  `insurance_info` JSON DEFAULT NULL COMMENT 'Policies, SGK status, green card',
  `legacy_metadata` JSON DEFAULT NULL COMMENT 'Archive no, legacy patient ID, migration notes',
  `legal_consents` JSON DEFAULT NULL COMMENT 'KVKK, ETK, IYS consents and history',
  `legacy_id` bigint(20) DEFAULT NULL COMMENT 'Old System Patient ID',
  `status` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `province_id` (`province_id`),
  KEY `district_id` (`district_id`),
  KEY `idx_legacy_id` (`clinic_id`, `legacy_id`),
  CONSTRAINT `ptn_cards_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`),
  CONSTRAINT `ptn_cards_ibfk_2` FOREIGN KEY (`province_id`) REFERENCES `sys_provinces` (`id`),
  CONSTRAINT `ptn_cards_ibfk_3` FOREIGN KEY (`district_id`) REFERENCES `sys_districts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Yaşam Bulguları (Vitals)
DROP TABLE IF EXISTS `ptn_vitals`;
CREATE TABLE `ptn_vitals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `patient_id` bigint(20) unsigned NOT NULL,
  `height` smallint(5) unsigned DEFAULT NULL COMMENT 'cm cinsinden',
  `weight` decimal(5,2) DEFAULT NULL COMMENT 'kg cinsinden',
  `systolic_bp` smallint(5) unsigned DEFAULT NULL COMMENT 'Büyük Tansiyon (mmHg)',
  `diastolic_bp` smallint(5) unsigned DEFAULT NULL COMMENT 'Küçük Tansiyon (mmHg)',
  `heart_rate` smallint(5) unsigned DEFAULT NULL COMMENT 'Nabız (bpm)',
  `measured_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` bigint(20) unsigned DEFAULT NULL COMMENT 'Ölçümü giren personel ID',
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `ptn_vitals_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ptn_vitals_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `ptn_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. KVKK Onayları
DROP TABLE IF EXISTS `ptn_kvkk_consents`;
CREATE TABLE `ptn_kvkk_consents` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `patient_id` bigint(20) unsigned NOT NULL,
  `otp_code` varchar(6) NOT NULL,
  `otp_expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_verified` tinyint(1) DEFAULT 0,
  `verified_at` timestamp NULL DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `ptn_kvkk_consents_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`),
  CONSTRAINT `ptn_kvkk_consents_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `ptn_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
