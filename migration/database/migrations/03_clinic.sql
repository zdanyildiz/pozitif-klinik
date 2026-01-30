-- Pozitif Klinik - Klinik İşlemleri (Appointment, Service, Examination)
-- Modül: Clinic (cln_)

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Hizmet Kataloğu
DROP TABLE IF EXISTS `cln_services`;
CREATE TABLE `cln_services` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `legacy_code` varchar(20) DEFAULT NULL COMMENT 'Old System TETKIK.KOD',
  `price` decimal(10,2) DEFAULT 0.00,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  KEY `idx_service_legacy_code` (`clinic_id`, `legacy_code`),
  CONSTRAINT `cln_services_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Randevu Türleri
DROP TABLE IF EXISTS `cln_appointment_types`;
CREATE TABLE `cln_appointment_types` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `color_code` varchar(10) DEFAULT '#3788d8',
  `duration_minutes` int(11) DEFAULT 30,
  `default_price` decimal(10,2) DEFAULT 0.00,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  CONSTRAINT `cln_appointment_types_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Randevular
DROP TABLE IF EXISTS `cln_appointments`;
CREATE TABLE `cln_appointments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `protocol_no` varchar(50) DEFAULT NULL,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `patient_id` bigint(20) unsigned NOT NULL,
  `doctor_id` bigint(20) unsigned DEFAULT NULL,
  `type_id` bigint(20) unsigned NOT NULL,
  `appointment_date` datetime NOT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `legacy_visit_id` bigint(20) DEFAULT NULL COMMENT 'Old System GELISNO',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  KEY `patient_id` (`patient_id`),
  KEY `doctor_id` (`doctor_id`),
  KEY `type_id` (`type_id`),
  KEY `idx_appt_legacy_id` (`clinic_id`, `legacy_visit_id`),
  CONSTRAINT `cln_appointments_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_appointments_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `ptn_cards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_appointments_ibfk_3` FOREIGN KEY (`doctor_id`) REFERENCES `sys_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cln_appointments_ibfk_4` FOREIGN KEY (`type_id`) REFERENCES `cln_appointment_types` (`id`),
  CONSTRAINT `fk_appointment_status` FOREIGN KEY (`status`) REFERENCES `sys_appointment_statuses` (`status_code`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Randevu Kalemleri (Adisyon)
DROP TABLE IF EXISTS `cln_appointment_items`;
CREATE TABLE `cln_appointment_items` (
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

-- 5. Muayene Kayıtları
DROP TABLE IF EXISTS `cln_examinations`;
CREATE TABLE `cln_examinations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `patient_id` bigint(20) unsigned NOT NULL,
  `doctor_user_id` bigint(20) unsigned NOT NULL,
  `appointment_id` bigint(20) unsigned DEFAULT NULL,
  `anamnez` text DEFAULT NULL,
  `complaint` text DEFAULT NULL COMMENT 'Şikayetler',
  `story` text DEFAULT NULL COMMENT 'Hikayesi',
  `bulgular` text DEFAULT NULL,
  `diagnosis` text DEFAULT NULL COMMENT 'Tanı/Teşhis',
  `treatment` text DEFAULT NULL COMMENT 'Tedavi',
  `result_note` text DEFAULT NULL COMMENT 'Sonuç',
  `legacy_visit_id` bigint(20) DEFAULT NULL COMMENT 'Link to HST_GELISLER.GELISNO',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  KEY `patient_id` (`patient_id`),
  KEY `doctor_user_id` (`doctor_user_id`),
  KEY `appointment_id` (`appointment_id`),
  CONSTRAINT `cln_examinations_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`),
  CONSTRAINT `cln_examinations_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `ptn_cards` (`id`),
  CONSTRAINT `cln_examinations_ibfk_3` FOREIGN KEY (`doctor_user_id`) REFERENCES `sys_users` (`id`),
  CONSTRAINT `cln_examinations_ibfk_4` FOREIGN KEY (`appointment_id`) REFERENCES `cln_appointments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Klinik Tanı Favorileri
DROP TABLE IF EXISTS `cln_diagnosis_favorites`;
CREATE TABLE `cln_diagnosis_favorites` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `icd_code` varchar(10) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clinic_icd` (`clinic_id`, `icd_code`),
  CONSTRAINT `cln_diag_fav_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
