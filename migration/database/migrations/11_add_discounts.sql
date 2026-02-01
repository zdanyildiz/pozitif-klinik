-- 11_add_discounts.sql
-- Description: Add discount columns to appointment items and appointments table

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Add discount columns to cln_appointment_items
ALTER TABLE `cln_appointment_items` 
ADD COLUMN `discount_amount` DECIMAL(10,2) DEFAULT 0.00 AFTER `unit_price`,
ADD COLUMN `description` VARCHAR(255) NULL COMMENT 'Kalem bazlı açıklama/not' AFTER `item_name`;

-- 2. Add general discount columns to cln_appointments
ALTER TABLE `cln_appointments`
ADD COLUMN `general_discount_amount` DECIMAL(10,2) DEFAULT 0.00 AFTER `status`,
ADD COLUMN `general_discount_note` VARCHAR(255) NULL AFTER `general_discount_amount`;

SET FOREIGN_KEY_CHECKS = 1;
