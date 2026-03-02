-- Pozitif Klinik - AI Hasta Özeti Modülü
-- Modül: AI Summary

SET FOREIGN_KEY_CHECKS = 0;

-- 1. AI Ayarları (Platform Admin)
DROP TABLE IF EXISTS `sys_ai_settings`;
CREATE TABLE `sys_ai_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `api_key` varchar(255) DEFAULT NULL COMMENT 'AES-256-GCM ile şifrelenmiş olarak tutulacak',
  `model_name` varchar(100) DEFAULT 'gemini-2.5-flash',
  `system_prompt` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Varsayılan sistem promptu ile tek bir kayıt atılıyor
INSERT INTO `sys_ai_settings` (`id`, `model_name`, `system_prompt`, `is_active`) VALUES 
(1, 'gemini-1.5-pro', 'Sen tecrübeli bir tıp asistanısın. Sağlanan hasta verilerini inceleyerek; hastanın kronik hastalıklarını, geçmiş operasyonlarını, sürekli kullandığı ilaçları ve dikkate alınması gereken klinik bulgularını kısa, hekimin bir bakışta anlayabileceği bir profesyonellikte raporla. Hasta mahremiyetine uygun bir medikal dil kullan.', 1);

-- 2. Hasta AI Özetleri Geçmişi
DROP TABLE IF EXISTS `cln_patient_summaries`;
CREATE TABLE `cln_patient_summaries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clinic_id` bigint(20) unsigned NOT NULL,
  `patient_id` bigint(20) unsigned NOT NULL,
  `summary_text` text NOT NULL,
  `last_examination_id` bigint(20) unsigned DEFAULT 0 COMMENT 'Özet çıkarılırken referans alınan son muayene ID',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_clinic_patient` (`clinic_id`, `patient_id`),
  CONSTRAINT `fk_cln_patient_summaries_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cln_patient_summaries_patient` FOREIGN KEY (`patient_id`) REFERENCES `ptn_cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
