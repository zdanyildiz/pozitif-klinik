-- Pozitif Klinik - Sistem Katmanı (Core)
-- Modül: System (sys_)

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Lokasyon Tabloları
DROP TABLE IF EXISTS `sys_provinces`;
CREATE TABLE `sys_provinces` (
  `id` int(10) unsigned NOT NULL,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `sys_districts`;
CREATE TABLE `sys_districts` (
  `id` int(10) unsigned NOT NULL,
  `province_id` int(10) unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `province_id` (`province_id`),
  CONSTRAINT `sys_districts_ibfk_1` FOREIGN KEY (`province_id`) REFERENCES `sys_provinces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tenancy
DROP TABLE IF EXISTS `sys_tenants`;
CREATE TABLE `sys_tenants` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `domain_prefix` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `province_id` int(10) unsigned DEFAULT NULL,
  `district_id` int(10) unsigned DEFAULT NULL,
  `tax_office` varchar(100) DEFAULT NULL,
  `tax_number` varchar(20) DEFAULT NULL,
  `working_hours` JSON DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `domain_prefix` (`domain_prefix`),
  KEY `fk_tenant_province` (`province_id`),
  KEY `fk_tenant_district` (`district_id`),
  CONSTRAINT `fk_tenant_province` FOREIGN KEY (`province_id`) REFERENCES `sys_provinces` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tenant_district` FOREIGN KEY (`district_id`) REFERENCES `sys_districts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Kullanıcılar
DROP TABLE IF EXISTS `sys_users`;
CREATE TABLE `sys_users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `username` varchar(50) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','doctor','secretary') NOT NULL,
  `specialty` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `legacy_id` bigint(20) DEFAULT NULL COMMENT 'Old System TAKIPNO',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_per_clinic` (`clinic_id`,`username`),
  KEY `idx_user_legacy_id` (`clinic_id`, `legacy_id`),
  CONSTRAINT `sys_users_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Platform Yönetimi
DROP TABLE IF EXISTS `sys_platform_admins`;
CREATE TABLE `sys_platform_admins` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. SMS Logları
DROP TABLE IF EXISTS `sys_sms_logs`;
CREATE TABLE `sys_sms_logs` (
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


-- 6. Tıbbi Tanımlar (ICD-10)
DROP TABLE IF EXISTS `sys_icd10`;
CREATE TABLE `sys_icd10` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(10) NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_common` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_icd_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
