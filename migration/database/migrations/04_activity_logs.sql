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
  `legacy_table` VARCHAR(128) NULL COMMENT 'Legacy table name or code',
  `legacy_record_id` BIGINT NULL COMMENT 'Legacy record id',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_clinic_module` (`clinic_id`, `module`),
  INDEX `idx_clinic_action` (`clinic_id`, `action`),
  INDEX `idx_record` (`record_type`, `record_id`),
  INDEX `idx_legacy_record` (`legacy_table`, `legacy_record_id`),
  INDEX `idx_clinic_legacy` (`clinic_id`, `legacy_table`),
  UNIQUE KEY `uk_legacy_record` (`clinic_id`, `legacy_table`, `legacy_record_id`),
  CONSTRAINT `cln_activity_logs_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_activity_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `sys_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Legacy table mapping helper
DROP TABLE IF EXISTS `map_legacy_tables`;
CREATE TABLE `map_legacy_tables` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `legacy_table_id` INT NULL COMMENT 'Legacy TABLE_ID if present',
  `legacy_table_name` VARCHAR(128) NOT NULL,
  `record_type` VARCHAR(64) NOT NULL COMMENT 'Target model name',
  `module` VARCHAR(32) NOT NULL COMMENT 'Target module',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_legacy_table_name` (`legacy_table_name`),
  KEY `idx_legacy_table_id` (`legacy_table_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data access logs (KVKK audit trail)
DROP TABLE IF EXISTS `cln_data_access_logs`;
CREATE TABLE `cln_data_access_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinic_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NULL,
  `patient_id` BIGINT UNSIGNED NULL,
  `record_type` VARCHAR(64) NULL,
  `record_id` BIGINT UNSIGNED NULL,
  `action` VARCHAR(64) NOT NULL DEFAULT 'DATA_ACCESS',
  `ip_address` VARCHAR(45) NULL,
  `description` TEXT NULL,
  `accessed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `legacy_table` VARCHAR(128) NULL,
  `legacy_record_id` BIGINT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_access` (`clinic_id`, `accessed_at`),
  KEY `idx_patient_access` (`patient_id`, `accessed_at`),
  KEY `idx_user_access` (`user_id`, `accessed_at`),
  KEY `idx_legacy_access` (`legacy_table`, `legacy_record_id`),
  UNIQUE KEY `uk_legacy_access` (`clinic_id`, `legacy_table`, `legacy_record_id`),
  CONSTRAINT `cln_data_access_logs_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cln_data_access_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `sys_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cln_data_access_logs_ibfk_3` FOREIGN KEY (`patient_id`) REFERENCES `ptn_cards` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
