-- Pozitif Klinik - E-Posta Modülü
-- Modül: Email (sys_tenant_email_configs)
-- Multi-tenant email configuration table

SET FOREIGN_KEY_CHECKS = 0;

-- Klinik Bazlı SMTP Konfigürasyonu
-- Her klinik kendi mail sunucusunu kullanabilir
DROP TABLE IF EXISTS `sys_tenant_email_configs`;
CREATE TABLE `sys_tenant_email_configs` (
    `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    `clinic_id` bigint(20) unsigned NOT NULL,
    `smtp_host` varchar(255) NOT NULL COMMENT 'SMTP sunucu adresi',
    `smtp_port` smallint(5) unsigned NOT NULL DEFAULT 587 COMMENT 'SMTP port numarası (25, 465, 587)',
    `smtp_username` varchar(255) NOT NULL COMMENT 'SMTP kullanıcı adı',
    `smtp_password_encrypted` text NOT NULL COMMENT 'AES-256-GCM ile şifrelenmiş SMTP parolası',
    `smtp_encryption` enum('none','tls','ssl') NOT NULL DEFAULT 'tls' COMMENT 'Şifreleme türü',
    `from_email` varchar(255) NOT NULL COMMENT 'Gönderen e-posta adresi',
    `from_name` varchar(100) NOT NULL COMMENT 'Gönderen adı',
    `is_active` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT 'Aktif/Pasif durumu',
    `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
    `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_clinic_email_config` (`clinic_id`),
    CONSTRAINT `sys_tenant_email_configs_ibfk_1` 
        FOREIGN KEY (`clinic_id`) 
        REFERENCES `sys_tenants` (`id`) 
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- E-posta Gönderim Logları
-- Gönderilen tüm e-postaların kaydı
DROP TABLE IF EXISTS `sys_email_logs`;
CREATE TABLE `sys_email_logs` (
    `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    `clinic_id` bigint(20) unsigned NOT NULL,
    `to_email` varchar(255) NOT NULL COMMENT 'Alıcı e-posta adresi',
    `subject` varchar(255) NOT NULL COMMENT 'E-posta konusu',
    `body_preview` text DEFAULT NULL COMMENT 'E-posta içeriği önizleme (ilk 500 kar)',
    `status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
    `error_message` text DEFAULT NULL COMMENT 'Hata durumunda mesaj',
    `sent_via` enum('tenant','fallback') NOT NULL DEFAULT 'fallback' COMMENT 'Hangi config kullanıldı',
    `sent_at` timestamp NULL DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    KEY `idx_clinic_status` (`clinic_id`, `status`),
    KEY `idx_sent_at` (`sent_at`),
    CONSTRAINT `sys_email_logs_ibfk_1` 
        FOREIGN KEY (`clinic_id`) 
        REFERENCES `sys_tenants` (`id`) 
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
