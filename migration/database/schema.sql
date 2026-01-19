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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id),
    INDEX idx_search (clinic_id, tc_no, phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. KVKK & Rıza Metinleri
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

-- 8. Muayene & Doktor Notları
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
