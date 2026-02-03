-- 12_sms_module.sql

-- System SMS Providers (Templates)
CREATE TABLE IF NOT EXISTS `sys_sms_providers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `driver_key` VARCHAR(50) NOT NULL COMMENT 'e.g. netgsm, generic_http',
  `config_schema` JSON NOT NULL COMMENT 'Form fields definition',
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clinic SMS Settings
CREATE TABLE IF NOT EXISTS `cln_sms_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `clinic_id` INT NOT NULL,
  `provider_id` INT NOT NULL,
  `config_data` JSON NOT NULL COMMENT 'Encrypted credentials',
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`provider_id`) REFERENCES `sys_sms_providers`(`id`),
  UNIQUE KEY `uk_clinic_sms` (`clinic_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Default Providers if not exists
INSERT INTO `sys_sms_providers` (`name`, `driver_key`, `config_schema`, `is_active`) 
SELECT 'Genel HTTP (REST/XML/GET)', 'generic_http', '[
    {"key": "endpoint_url", "label": "API URL", "type": "url", "required": true},
    {"key": "method", "label": "HTTP Method", "type": "select", "options": ["POST", "GET"], "default": "POST"},
    {"key": "content_type", "label": "Content Type", "type": "select", "options": ["application/json", "application/x-www-form-urlencoded", "application/xml"], "default": "application/json"},
    {"key": "headers", "label": "HTTP Headers (JSON)", "type": "code", "language": "json", "placeholder": "{\\"Authorization\\": \\"Bearer ...\\"}"},
    {"key": "payload_template", "label": "Body Template", "type": "code", "language": "text", "help": "Değişkenler: {{phone}}, {{message}}, {{title}}. Örn: <req><msg>{{message}}</msg></req>"}
]', 1
WHERE NOT EXISTS (SELECT 1 FROM `sys_sms_providers` WHERE `driver_key` = 'generic_http');

INSERT INTO `sys_sms_providers` (`name`, `driver_key`, `config_schema`, `is_active`) 
SELECT 'NetGSM', 'netgsm', '[
    {"key": "username", "label": "NetGSM Kullanıcı Adı", "type": "text", "required": true},
    {"key": "password", "label": "Şifre", "type": "password", "required": true},
    {"key": "header", "label": "Gönderici Başlığı (Header)", "type": "text", "required": true}
]', 1
WHERE NOT EXISTS (SELECT 1 FROM `sys_sms_providers` WHERE `driver_key` = 'netgsm');
