-- Pozitif Klinik - Laboratuvar ve Sonuç Modülü
-- Modül: Lab (cln_)

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Laboratuvar Sonuç Başlıkları (Request/Result Header)
DROP TABLE IF EXISTS `cln_lab_results`;
CREATE TABLE `cln_lab_results` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `appointment_id` bigint(20) unsigned DEFAULT NULL,
  `patient_id` bigint(20) unsigned NOT NULL,
  `request_date` datetime NOT NULL,
  `result_date` datetime DEFAULT NULL,
  `doctor_id` bigint(20) unsigned DEFAULT NULL,
  `status` enum('pending', 'completed', 'cancelled') DEFAULT 'completed',
  `legacy_visit_id` bigint(20) DEFAULT NULL COMMENT 'GELISNO from MSSQL',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_lab_clinic` (`clinic_id`),
  KEY `idx_lab_appt` (`appointment_id`),
  KEY `idx_lab_patient` (`patient_id`),
  CONSTRAINT `cln_lab_results_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_lab_results_appt` FOREIGN KEY (`appointment_id`) REFERENCES `cln_appointments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cln_lab_results_patient` FOREIGN KEY (`patient_id`) REFERENCES `ptn_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Laboratuvar Sonuç Detayları (Sonuç Kalemleri)
DROP TABLE IF EXISTS `cln_lab_result_items`;
CREATE TABLE `cln_lab_result_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `result_id` bigint(20) unsigned NOT NULL,
  `test_name` varchar(255) NOT NULL,
  `result_value` varchar(255) NOT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `reference_range` varchar(100) DEFAULT NULL,
  `is_abnormal` tinyint(1) DEFAULT 0,
  `legacy_test_code` varchar(50) DEFAULT NULL COMMENT 'TESTNO from MSSQL',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_lab_item_result` (`result_id`),
  CONSTRAINT `cln_lab_item_result` FOREIGN KEY (`result_id`) REFERENCES `cln_lab_results` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
