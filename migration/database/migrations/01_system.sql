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
  `legacy_table` varchar(128) DEFAULT NULL,
  `legacy_record_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  UNIQUE KEY `uk_legacy_sms` (`clinic_id`, `legacy_table`, `legacy_record_id`),
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

-- 7. Randevu Durumları (Dinamik Statü Sistemi)
DROP TABLE IF EXISTS `sys_appointment_statuses`;
CREATE TABLE `sys_appointment_statuses` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `status_code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `color_code` varchar(20) DEFAULT '#6c757d',
  `icon_class` varchar(50) DEFAULT 'bi-circle',
  `sort_order` int(11) DEFAULT 0,
  `is_system` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `status_code` (`status_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `sys_appointment_statuses` (`status_code`, `name`, `color_code`, `icon_class`, `is_system`, `sort_order`) VALUES
('unconfirmed', 'Onay Bekliyor', '#6c757d', 'bi-patch-question', 1, 0),
('confirmed', 'Onaylandı', '#0d6efd', 'bi-check-lg', 1, 1),
('waiting', 'Klinikte Bekliyor', '#fd7e14', 'bi-person-check', 1, 2),
('in_test', 'İşlemde/Muayenede', '#0dcaf0', 'bi-heart-pulse', 1, 3),
('completed', 'Tamamlandı', '#198754', 'bi-check-circle-fill', 1, 4),
('cancelled', 'İptal Edildi', '#dc3545', 'bi-x-circle', 1, 5),
('did_not_come', 'Gelmedi', '#6c757d', 'bi-dash-circle', 1, 6);

-- 8. Tıbbi Uzmanlıklar (Branşlar) ve Dinamik Formlar
DROP TABLE IF EXISTS `sys_medical_specialties`;
CREATE TABLE `sys_medical_specialties` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `icd_prefixes` varchar(255) DEFAULT NULL COMMENT 'Comma separated ICD-10 prefixes for search boost (e.g. H,J)',
  `form_schema` LONGTEXT DEFAULT NULL COMMENT 'JSON storage for form fields definition',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `specialty_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `sys_medical_specialties` (`code`, `name`, `icd_prefixes`, `form_schema`) VALUES
('INTERNAL_MEDICINE', 'İç Hastalıkları (Dahiliye)', 'A,B,E,J,I,N', NULL),
('CARDIOLOGY', 'Kardiyoloji', 'I', NULL),
('ENT', 'Kulak Burun Boğaz', 'H,J', NULL),
('OPHTHALMOLOGY', 'Göz Hastalıkları', 'H', NULL),
('ORTHOPEDICS', 'Ortopedi ve Travmatoloji', 'M', NULL),
('DERMATOLOGY', 'Dermatoloji (Cildiye)', 'L', NULL),
('NEUROLOGY', 'Nöroloji', 'G', NULL),
('PSYCHIATRY', 'Psikiyatri', 'F', NULL),
('GYNECOLOGY', 'Kadın Hastalıkları ve Doğum', 'O', NULL),
('PEDIATRICS', 'Çocuk Sağlığı ve Hastalıkları', 'A,B,E,J,P,Q', NULL),
('UROLOGY', 'Üroloji', 'N', NULL),
('GENERAL_SURGERY', 'Genel Cerrahi', 'K,C,D', NULL),
('PULMONOLOGY', 'Göğüs Hastalıkları', 'J', NULL),
('ENDOCRINOLOGY', 'Endokrinoloji', 'E', NULL),
('INFECTIOUS_DISEASES', 'Enfeksiyon Hastalıkları', 'A,B', NULL),
('DIETITIAN', 'Beslenme ve Diyet', 'E', NULL),
('EMERGENCY', 'Acil Tıp', 'R,S,T', NULL);

SET FOREIGN_KEY_CHECKS = 1;
