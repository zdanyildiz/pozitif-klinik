-- 12_sms_module.sql

-- System SMS Providers (Templates)
CREATE TABLE IF NOT EXISTS `sys_sms_providers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `driver_key` VARCHAR(50) NOT NULL COMMENT 'e.g. netgsm, generic_http',
  `template_config` JSON NULL COMMENT 'Admin defined configuration (URL, Body Template etc.)',
  `config_schema` JSON NOT NULL COMMENT 'Form fields definition',
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clinic SMS Settings
CREATE TABLE IF NOT EXISTS `cln_sms_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `clinic_id` INT NOT NULL,
  `provider_id` INT NOT NULL,
  `config_data` TEXT NOT NULL COMMENT 'Encrypted credentials',
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`provider_id`) REFERENCES `sys_sms_providers`(`id`),
  UNIQUE KEY `uk_clinic_sms` (`clinic_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Default Providers if not exists
INSERT INTO `sys_sms_providers` (`name`, `driver_key`, `config_schema`, `is_active`) 
SELECT 'Genel HTTP (REST/XML/GET)', 'generic_http', '[
    {"key": "url", "label": "API URL", "type": "url", "required": true, "placeholder": "https://api.vericini.com/v1/sms"},
    {"key": "method", "label": "HTTP Method", "type": "select", "options": ["GET", "POST", "PUT"], "default": "POST"},
    {"key": "headers", "label": "HTTP Headers (Dinamik)", "type": "keyvalue", "help": "API için gerekli header bilgilerini ekleyin (örn: Authorization, Content-Type)"},
    {"key": "body_template", "label": "Body Template (JSON/XML)", "type": "textarea", "help": "Placeholderlar: {{phone}}, {{message}}, {{message_json}} ve diğer tanımladığınız parametreler."}
]', 1
WHERE NOT EXISTS (SELECT 1 FROM `sys_sms_providers` WHERE `driver_key` = 'generic_http');

INSERT INTO `sys_sms_providers` (`name`, `driver_key`, `config_schema`, `is_active`) 
SELECT 'NetGSM', 'netgsm', '[
    {"key": "username", "label": "NetGSM Kullanıcı Adı", "type": "text", "required": true},
    {"key": "password", "label": "Şifre", "type": "password", "required": true},
    {"key": "header", "label": "Gönderici Başlığı (Header)", "type": "text", "required": true}
]', 1
WHERE NOT EXISTS (SELECT 1 FROM `sys_sms_providers` WHERE `driver_key` = 'netgsm');
