-- Modül: Activity Logs (cln_activity_logs)

DROP TABLE IF EXISTS `cln_activity_logs`;

CREATE TABLE `cln_activity_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `clinic_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NULL COMMENT 'İşlemi yapan personel',
  `action` VARCHAR(64) NOT NULL COMMENT 'CRITICAL_DELETE, PAYMENT_CREATE vb.',
  `module` VARCHAR(32) NOT NULL COMMENT 'PATIENT, APPOINTMENT, FINANCE',
  `record_id` BIGINT UNSIGNED NULL COMMENT 'Etkilenen kaydın IDsi',
  `record_type` VARCHAR(64) NULL COMMENT 'Etkilenen Model (örn: Patient)',
  `old_values` JSON NULL COMMENT 'Değişiklik öncesi veriler',
  `new_values` JSON NULL COMMENT 'Değişiklik sonrası veriler',
  `ip_address` VARCHAR(45) NULL,
  `description` TEXT NULL COMMENT 'İnsan tarafından okunabilir özet',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_clinic_module` (`clinic_id`, `module`),
  INDEX `idx_clinic_action` (`clinic_id`, `action`),
  INDEX `idx_record` (`record_type`, `record_id`),
  CONSTRAINT `cln_activity_logs_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_activity_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `sys_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
