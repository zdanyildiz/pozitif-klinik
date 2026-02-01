-- Add payment_status to cln_appointments
ALTER TABLE `cln_appointments` 
ADD COLUMN `payment_status` ENUM('unpaid', 'partially_paid', 'paid') NOT NULL DEFAULT 'unpaid' AFTER `status`;
