-- Pozitif Klinik Master Schema
-- Bu dosya tüm modülleri bir araya getirir.
-- Modüler dosyalar migration/database/modules/ altındadır.

SET FOREIGN_KEY_CHECKS = 0;

-- ==========================================
-- 1. SYSTEM MODULE (sys_)
-- ==========================================
-- Provinces, Districts, Tenants, Users, PlatformAdmins, SMS Logs

CREATE TABLE IF NOT EXISTS `sys_provinces` (
  `id` int(10) unsigned NOT NULL,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sys_districts` (
  `id` int(10) unsigned NOT NULL,
  `province_id` int(10) unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `province_id` (`province_id`),
  CONSTRAINT `sys_districts_ibfk_1` FOREIGN KEY (`province_id`) REFERENCES `sys_provinces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sys_tenants` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `domain_prefix` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `domain_prefix` (`domain_prefix`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sys_users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `username` varchar(50) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','doctor','secretary') NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_per_clinic` (`clinic_id`,`username`),
  CONSTRAINT `sys_users_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sys_platform_admins` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sys_sms_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `phone` varchar(20) NOT NULL,
  `message` text NOT NULL,
  `provider_response` text DEFAULT NULL,
  `status` enum('pending','sent','failed') DEFAULT 'pending',
  `sent_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  CONSTRAINT `sys_sms_logs_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 2. PATIENT MODULE (ptn_)
-- ==========================================
-- Patient Cards, Vitals, KVKK Consents

CREATE TABLE IF NOT EXISTS `ptn_cards` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `tc_no` varchar(255) NOT NULL,
  `tc_no_hash` varchar(64) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `name_hash` varchar(64) DEFAULT NULL,
  `phone` varchar(255) NOT NULL,
  `phone_hash` varchar(64) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `gender` enum('M','F','U') DEFAULT 'U',
  `blood_type` varchar(10) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `province_id` int(10) unsigned DEFAULT NULL,
  `district_id` int(10) unsigned DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `status` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `province_id` (`province_id`),
  KEY `district_id` (`district_id`),
  KEY `idx_tc_hash` (`clinic_id`,`tc_no_hash`),
  KEY `idx_name_hash` (`clinic_id`,`name_hash`),
  KEY `idx_phone_hash` (`clinic_id`,`phone_hash`),
  CONSTRAINT `ptn_cards_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`),
  CONSTRAINT `ptn_cards_ibfk_2` FOREIGN KEY (`province_id`) REFERENCES `sys_provinces` (`id`),
  CONSTRAINT `ptn_cards_ibfk_3` FOREIGN KEY (`district_id`) REFERENCES `sys_districts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ptn_vitals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `patient_id` bigint(20) unsigned NOT NULL,
  `height` smallint(5) unsigned DEFAULT NULL,
  `weight` decimal(5,2) DEFAULT NULL,
  `systolic_bp` smallint(5) unsigned DEFAULT NULL,
  `diastolic_bp` smallint(5) unsigned DEFAULT NULL,
  `heart_rate` smallint(5) unsigned DEFAULT NULL,
  `measured_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `ptn_vitals_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ptn_vitals_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `ptn_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ptn_kvkk_consents` (
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

-- ==========================================
-- 3. CLINIC MODULE (cln_)
-- ==========================================
-- Services, Appt Types, Appointments, Appt Items, Examinations

CREATE TABLE IF NOT EXISTS `cln_services` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT 0.00,
  `tax_rate` decimal(5,2) DEFAULT 0.00,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  KEY `idx_code` (`clinic_id`, `code`),
  CONSTRAINT `cln_services_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cln_appointment_types` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `service_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `color_code` varchar(10) DEFAULT '#3788d8',
  `duration_minutes` int(11) DEFAULT 30,
  `default_price` decimal(10,2) DEFAULT 0.00,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `cln_appointment_types_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_appointment_types_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `cln_services` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cln_appointments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `patient_id` bigint(20) unsigned NOT NULL,
  `doctor_id` bigint(20) unsigned DEFAULT NULL,
  `type_id` bigint(20) unsigned NOT NULL,
  `appointment_date` datetime NOT NULL,
  `status` enum('pending','confirmed','waiting','completed','cancelled') DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  KEY `patient_id` (`patient_id`),
  KEY `doctor_id` (`doctor_id`),
  KEY `type_id` (`type_id`),
  CONSTRAINT `cln_appointments_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_appointments_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `ptn_cards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_appointments_ibfk_3` FOREIGN KEY (`doctor_id`) REFERENCES `sys_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cln_appointments_ibfk_4` FOREIGN KEY (`type_id`) REFERENCES `cln_appointment_types` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cln_appointment_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `appointment_id` bigint(20) unsigned NOT NULL,
  `service_id` bigint(20) unsigned DEFAULT NULL,
  `item_name` varchar(255) NOT NULL,
  `quantity` int(11) DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `performer_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  KEY `appointment_id` (`appointment_id`),
  KEY `service_id` (`service_id`),
  KEY `performer_id` (`performer_id`),
  CONSTRAINT `cln_appointment_items_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_appointment_items_ibfk_2` FOREIGN KEY (`appointment_id`) REFERENCES `cln_appointments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_appointment_items_ibfk_3` FOREIGN KEY (`service_id`) REFERENCES `cln_services` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cln_appointment_items_ibfk_4` FOREIGN KEY (`performer_id`) REFERENCES `sys_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cln_examinations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `patient_id` bigint(20) unsigned NOT NULL,
  `doctor_user_id` bigint(20) unsigned NOT NULL,
  `anamnez` text DEFAULT NULL,
  `bulgular` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  KEY `patient_id` (`patient_id`),
  KEY `doctor_user_id` (`doctor_user_id`),
  CONSTRAINT `cln_examinations_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`),
  CONSTRAINT `cln_examinations_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `ptn_cards` (`id`),
  CONSTRAINT `cln_examinations_ibfk_3` FOREIGN KEY (`doctor_user_id`) REFERENCES `sys_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- SEED DATA (Lokasyon)
-- ==========================================


