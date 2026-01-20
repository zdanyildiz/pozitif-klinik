-- Pozitif Klinik Database Schema
-- GÖREV: Aşağıdaki SQL komutlarını sırasıyla çalıştırarak veritabanı şemasını oluştur.

-- 1. VERİTABANI OLUŞTURMA
CREATE DATABASE IF NOT EXISTS `pozitif_klinik` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `pozitif_klinik`;

-- ==========================================
-- BÖLÜM A: PLATFORM YÖNETİMİ (SÜPER ADMIN)
-- ==========================================

-- 1. Platform Yöneticileri Tablosu
-- Bu tablo tenantlardan bağımsızdır. Sistemi yöneten "Bizim" kullanıcılarımızdır.
CREATE TABLE IF NOT EXISTS sys_platform_admins (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. "Root" Admin Kullanıcısını Ekle (Seeding)
-- Username: root
-- Password: 123456 (BCrypt Hash)
INSERT IGNORE INTO sys_platform_admins (username, password_hash) 
VALUES ('root', '$2y$10$vI8aWBdWs4j3w.8L6x8K.eXb7of.hD/Fp7p/j7s.u/u6v/u6v/u6');


-- ==========================================
-- BÖLÜM B: MULTI-TENANT SİSTEM TABLOLARI
-- ==========================================

-- 3. Klinikler (Tenants)
CREATE TABLE IF NOT EXISTS sys_tenants (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    domain_prefix VARCHAR(50) NOT NULL UNIQUE, -- ornek.pozitifklinik.com
    name VARCHAR(100) NOT NULL,
    logo_url VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Klinik Kullanıcıları (Doctors, Secretaries)
-- Her kullanıcı mutlaka bir kliniğe (sys_tenants) bağlıdır.
CREATE TABLE IF NOT EXISTS sys_users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    username VARCHAR(50) NOT NULL,
    name VARCHAR(100) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'doctor', 'secretary') NOT NULL, -- admin burada "Klinik Yöneticisi" demek
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
CREATE TABLE IF NOT EXISTS ptn_cards (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    tc_no VARCHAR(11) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    birth_date DATE NULL,
    gender ENUM('M', 'F', 'U') DEFAULT 'U' COMMENT 'M:Male, F:Female, U:Unknown',
    blood_type ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-') NULL,
    address TEXT NULL,
    notes TEXT NULL COMMENT 'Personel özel notları',
    status TINYINT(1) DEFAULT 1 COMMENT '1:Aktif, 0:Pasif (Arşiv)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id),
    INDEX idx_search (clinic_id, tc_no, phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Yaşam Bulguları (Vitals)
CREATE TABLE IF NOT EXISTS ptn_vitals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    patient_id BIGINT UNSIGNED NOT NULL,
    height SMALLINT UNSIGNED NULL COMMENT 'cm cinsinden',
    weight DECIMAL(5,2) NULL COMMENT 'kg cinsinden',
    systolic_bp SMALLINT UNSIGNED NULL COMMENT 'Büyük Tansiyon (mmHg)',
    diastolic_bp SMALLINT UNSIGNED NULL COMMENT 'Küçük Tansiyon (mmHg)',
    heart_rate SMALLINT UNSIGNED NULL COMMENT 'Nabız (bpm)',
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT UNSIGNED NULL COMMENT 'Ölçümü giren personel ID',
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

-- 10. Randevu Türleri
CREATE TABLE IF NOT EXISTS cln_appointment_types (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    color_code VARCHAR(10) DEFAULT '#3788d8',
    duration_minutes INT DEFAULT 30,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_app_type_clinic FOREIGN KEY (clinic_id) REFERENCES sys_tenants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Randevular
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
    CONSTRAINT fk_app_doctor FOREIGN KEY (doctor_id) REFERENCES sys_users (id) ON DELETE SET NULL,
    CONSTRAINT fk_app_type FOREIGN KEY (type_id) REFERENCES cln_appointment_types (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
