-- Phase 2: Laboratuvar Tanımları ve Şablon Yapısı

-- 1. Merkezi Test Tanımları (Kütüphane)
CREATE TABLE IF NOT EXISTS `sys_lab_test_definitions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `test_code` varchar(50) DEFAULT NULL COMMENT 'Legacy KOD (TETKIK.KOD)',
  `test_name` varchar(255) NOT NULL,
  `loinc_code` varchar(50) DEFAULT NULL,
  `default_unit` varchar(50) DEFAULT NULL,
  `data_type` varchar(20) DEFAULT 'numeric' COMMENT 'numeric, text, boolean',
  `category` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_test_code` (`test_code`),
  KEY `idx_test_name` (`test_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Referans Değerleri Kütüphanesi
CREATE TABLE IF NOT EXISTS `sys_lab_test_normals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `test_definition_id` int(11) NOT NULL,
  `gender` enum('M','F','both') DEFAULT 'both',
  `age_min` int(11) DEFAULT 0,
  `age_max` int(11) DEFAULT 200,
  `min_value` decimal(12,4) DEFAULT NULL,
  `max_value` decimal(12,4) DEFAULT NULL,
  `reference_text` varchar(255) DEFAULT NULL COMMENT 'Örn: 70 - 100',
  `unit` varchar(50) DEFAULT NULL,
  `source` varchar(255) DEFAULT 'legacy',
  PRIMARY KEY (`id`),
  KEY `idx_test_def` (`test_definition_id`),
  CONSTRAINT `fk_test_normals_def` FOREIGN KEY (`test_definition_id`) REFERENCES `sys_lab_test_definitions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Hazır Test Panelleri (Şablonlar)
CREATE TABLE IF NOT EXISTS `cln_lab_test_panels` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL COMMENT 'Örn: Biyokimya Paneli',
  `description` text DEFAULT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `legacy_group_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_panel` (`clinic_id`, `is_active`),
  CONSTRAINT `fk_lab_panels_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Panel İçeriği (Şablondaki Testler)
CREATE TABLE IF NOT EXISTS `cln_lab_panel_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `panel_id` int(11) NOT NULL,
  `test_definition_id` int(11) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_panel_link` (`panel_id`),
  CONSTRAINT `fk_panel_link` FOREIGN KEY (`panel_id`) REFERENCES `cln_lab_test_panels` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_panel_test_link` FOREIGN KEY (`test_definition_id`) REFERENCES `sys_lab_test_definitions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
