CREATE TABLE `cln_payments` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `clinic_id` BIGINT UNSIGNED NOT NULL,
  `patient_id` BIGINT UNSIGNED NOT NULL,
  `appointment_id` BIGINT UNSIGNED DEFAULT NULL,
  `payment_type` ENUM('cash', 'credit_card', 'bank_transfer', 'other') NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `currency` VARCHAR(3) DEFAULT 'TRY',
  `payment_date` DATETIME NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `status` ENUM('completed', 'cancelled') DEFAULT 'completed',
  `created_by` BIGINT UNSIGNED DEFAULT NULL,
  `legacy_id` BIGINT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_clinic_payments` (`clinic_id`, `payment_date`),
  INDEX `idx_patient_payments` (`patient_id`),
  INDEX `idx_appointment_payments` (`appointment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
