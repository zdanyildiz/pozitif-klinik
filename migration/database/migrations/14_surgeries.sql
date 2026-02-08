-- Pozitif Klinik - Ameliyat Takip Modülü
-- Modül: Surgery (cln_surgeries)

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `cln_surgeries`;
CREATE TABLE `cln_surgeries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `patient_id` bigint(20) unsigned NOT NULL,
  `doctor_id` bigint(20) unsigned DEFAULT NULL,
  `surgery_date` datetime NOT NULL,
  `hospital_name` varchar(255) DEFAULT NULL,
  `status` enum('planned', 'completed', 'cancelled') NOT NULL DEFAULT 'planned',
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  KEY `patient_id` (`patient_id`),
  KEY `doctor_id` (`doctor_id`),
  KEY `idx_surgery_date` (`clinic_id`, `surgery_date`),
  CONSTRAINT `cln_surgeries_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_surgeries_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `ptn_cards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_surgeries_ibfk_3` FOREIGN KEY (`doctor_id`) REFERENCES `sys_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
