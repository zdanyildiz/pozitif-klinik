-- ==========================================
-- Pozitif Klinik Database Schema
-- Version: 3.0 - Hizmet ve Adisyon Desteği
-- Son Güncelleme: 2026-01-20
-- ==========================================
-- GÖREV: Aşağıdaki SQL komutlarını sırasıyla çalıştırarak veritabanı şemasını oluştur.

-- 1. VERİTABANI OLUŞTURMA
CREATE DATABASE IF NOT EXISTS `pozitif_klinik` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `pozitif_klinik`;

-- ==========================================
-- BÖLÜM A: PLATFORM YÖNETİMİ (SÜPER ADMIN)
-- ==========================================

-- 1. Platform Yöneticileri Tablosu
CREATE TABLE IF NOT EXISTS sys_platform_admins (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. "Root" Admin Kullanıcısını Ekle (Seeding)
INSERT IGNORE INTO sys_platform_admins (username, password_hash) 
VALUES ('root', '$2y$10$vI8aWBdWs4j3w.8L6x8K.eXb7of.hD/Fp7p/j7s.u/u6v/u6v/u6');


-- ==========================================
-- BÖLÜM B: MULTI-TENANT SİSTEM TABLOLARI
-- ==========================================

-- 3. Klinikler (Tenants)
CREATE TABLE IF NOT EXISTS sys_tenants (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    domain_prefix VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    logo_url VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Klinik Kullanıcıları (Doctors, Secretaries)
CREATE TABLE IF NOT EXISTS sys_users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    username VARCHAR(50) NOT NULL,
    name VARCHAR(100) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'doctor', 'secretary') NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id) ON DELETE RESTRICT,
    UNIQUE KEY unique_user_per_clinic (clinic_id, username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. SMS Logları
CREATE TABLE IF NOT EXISTS sys_sms_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    phone VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    provider_response TEXT,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ==========================================
-- BÖLÜM C: İŞ ALANI (DOMAIN) TABLOLARI
-- ==========================================

-- 6. Hasta Kartları
-- ÖNEMLİ: TÜM KİŞİSEL VERİLER AES-256-GCM ile şifrelenmiş olarak saklanır.
CREATE TABLE IF NOT EXISTS ptn_cards (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    
    -- Şifrelenmiş alanlar (AES-256-GCM, base64 encoded)
    tc_no VARCHAR(255) NOT NULL COMMENT 'AES-256-GCM şifreli TC Kimlik',
    tc_no_hash VARCHAR(64) NULL COMMENT 'HMAC-SHA256 blind index (arama için)',
    
    name VARCHAR(255) NOT NULL COMMENT 'AES-256-GCM şifreli hasta adı',
    name_hash VARCHAR(64) NULL COMMENT 'HMAC-SHA256 blind index (arama için)',
    
    phone VARCHAR(255) NOT NULL COMMENT 'AES-256-GCM şifreli telefon',
    phone_hash VARCHAR(64) NULL COMMENT 'HMAC-SHA256 blind index (arama için)',
    
    email VARCHAR(255) NULL COMMENT 'AES-256-GCM şifreli email',
    
    birth_date DATE NULL,
    gender ENUM('M', 'F', 'U') DEFAULT 'U',
    blood_type ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-') NULL,
    address TEXT NULL COMMENT 'AES-256-GCM şifreli adres',
    notes TEXT NULL,
    status TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id),
    INDEX idx_tc_hash (clinic_id, tc_no_hash),
    INDEX idx_name_hash (clinic_id, name_hash),
    INDEX idx_phone_hash (clinic_id, phone_hash),
    INDEX idx_status (clinic_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Yaşam Bulguları (Vitals)
CREATE TABLE IF NOT EXISTS ptn_vitals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    patient_id BIGINT UNSIGNED NOT NULL,
    height SMALLINT UNSIGNED NULL,
    weight DECIMAL(5,2) NULL,
    systolic_bp SMALLINT UNSIGNED NULL,
    diastolic_bp SMALLINT UNSIGNED NULL,
    heart_rate SMALLINT UNSIGNED NULL,
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT UNSIGNED NULL,
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES ptn_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. KVKK & Rıza Metinleri
CREATE TABLE IF NOT EXISTS ptn_kvkk_consents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    patient_id BIGINT UNSIGNED NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    otp_expires_at TIMESTAMP NOT NULL,
    is_verified TINYINT(1) DEFAULT 0,
    verified_at TIMESTAMP NULL,
    ip_address VARCHAR(45),
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id),
    FOREIGN KEY (patient_id) REFERENCES ptn_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Muayene & Doktor Notları
CREATE TABLE IF NOT EXISTS cln_examinations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    patient_id BIGINT UNSIGNED NOT NULL,
    doctor_user_id BIGINT UNSIGNED NOT NULL,
    anamnez TEXT,
    bulgular TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id),
    FOREIGN KEY (patient_id) REFERENCES ptn_cards(id),
    FOREIGN KEY (doctor_user_id) REFERENCES sys_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Hizmet Kataloğu
CREATE TABLE IF NOT EXISTS `cln_services` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `clinic_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NULL,
    `standard_price` DECIMAL(10,2) DEFAULT 0.00,
    `tax_rate` DECIMAL(5,2) DEFAULT 20.00,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_service_clinic FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Randevu Türleri
CREATE TABLE IF NOT EXISTS cln_appointment_types (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    color_code VARCHAR(10) DEFAULT '#3788d8',
    duration_minutes INT DEFAULT 30,
    default_price DECIMAL(10,2) DEFAULT 0.00,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_app_type_clinic FOREIGN KEY (clinic_id) REFERENCES sys_tenants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Randevular
CREATE TABLE IF NOT EXISTS cln_appointments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    patient_id BIGINT UNSIGNED NOT NULL,
    doctor_id BIGINT UNSIGNED NULL,
    type_id BIGINT UNSIGNED NOT NULL,
    appointment_date DATETIME NOT NULL,
    status ENUM('pending', 'confirmed', 'waiting', 'in_test', 'completed', 'cancelled', 'no_show') DEFAULT 'pending',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_app_clinic FOREIGN KEY (clinic_id) REFERENCES sys_tenants (id) ON DELETE CASCADE,
    CONSTRAINT fk_app_patient FOREIGN KEY (patient_id) REFERENCES ptn_cards (id) ON DELETE CASCADE,
    CONSTRAINT fk_app_doctor FOREIGN KEY (doctor_id) REFERENCES sys_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_app_type FOREIGN KEY (type_id) REFERENCES cln_appointment_types (id),
    INDEX idx_appointment_date (clinic_id, appointment_date),
    INDEX idx_patient_appointments (clinic_id, patient_id),
    INDEX idx_doctor_appointments (clinic_id, doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Randevu Kalemleri / Adisyon
CREATE TABLE IF NOT EXISTS `cln_appointment_items` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `clinic_id` BIGINT UNSIGNED NOT NULL,
    `appointment_id` BIGINT UNSIGNED NOT NULL,
    `service_id` BIGINT UNSIGNED NULL,
    `item_name` VARCHAR(255) NOT NULL,
    `quantity` INT DEFAULT 1,
    `unit_price` DECIMAL(10,2) NOT NULL,
    `total_price` DECIMAL(10,2) NOT NULL,
    `performer_id` BIGINT UNSIGNED NULL COMMENT 'İşlemi yapan personel',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_item_clinic FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_app FOREIGN KEY (appointment_id) REFERENCES cln_appointments(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_service FOREIGN KEY (service_id) REFERENCES cln_services(id) ON DELETE SET NULL,
    CONSTRAINT fk_item_performer FOREIGN KEY (performer_id) REFERENCES sys_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
