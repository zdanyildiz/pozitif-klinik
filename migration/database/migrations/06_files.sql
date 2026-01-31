CREATE TABLE IF NOT EXISTS `sys_files` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `clinic_id` INT UNSIGNED NOT NULL COMMENT 'Klinik ID',
    `module` VARCHAR(50) NOT NULL COMMENT 'Hangi modül: patient, lab, invoice vb.',
    `related_id` BIGINT UNSIGNED NOT NULL COMMENT 'Bağlı olduğu kaydın IDsi',
    `original_name` VARCHAR(255) NOT NULL COMMENT 'Orijinal dosya adı',
    `storage_path` VARCHAR(255) NOT NULL COMMENT 'Disk üzerindeki tam yol (örn: 1/2026/01/hash.pdf)',
    `file_hash` VARCHAR(64) NOT NULL COMMENT 'SHA-256 hash',
    `mime_type` VARCHAR(100) NOT NULL,
    `size_kb` INT UNSIGNED NOT NULL,
    `uuid` CHAR(36) NOT NULL COMMENT 'Public ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` INT UNSIGNED NULL COMMENT 'Yükleyen kullanıcı ID',
    `deleted_at` DATETIME NULL COMMENT 'Soft delete',
    
    INDEX `idx_clinic_module_related` (`clinic_id`, `module`, `related_id`),
    UNIQUE KEY `uk_uuid` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sistem genelinde dosya metadata bilgileri';
