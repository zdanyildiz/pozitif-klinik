-- Pozitif Klinik Full Schema
-- Includes Locations, Services, Patients, Appointments and Security

-- Foreign Key kontrollerini geçici olarak kapatıyoruz (Tabloları rahat silebiliriz)
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `pozitif_klinik` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `pozitif_klinik`;

-- 1. Lokasyon Tabloları
DROP TABLE IF EXISTS sys_provinces;
CREATE TABLE sys_provinces (
    id INT UNSIGNED PRIMARY KEY,
    name VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS sys_districts;
CREATE TABLE sys_districts (
    id INT UNSIGNED PRIMARY KEY,
    province_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    FOREIGN KEY (province_id) REFERENCES sys_provinces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tenancy & Users
CREATE TABLE IF NOT EXISTS sys_tenants (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    domain_prefix VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    logo_url VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- 3. Hizmet Kataloğu
DROP TABLE IF EXISTS cln_services;
CREATE TABLE cln_services (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) DEFAULT 0.00,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Randevu Türleri
DROP TABLE IF EXISTS cln_appointment_types;
CREATE TABLE cln_appointment_types (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    color_code VARCHAR(10) DEFAULT '#3788d8',
    duration_minutes INT DEFAULT 30,
    default_price DECIMAL(10,2) DEFAULT 0.00,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Hasta Kartları (Şifreli PII ve Lokasyon)
DROP TABLE IF EXISTS ptn_cards;
CREATE TABLE ptn_cards (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    tc_no VARCHAR(255) NOT NULL,
    tc_no_hash VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    name_hash VARCHAR(64) NULL,
    phone VARCHAR(255) NOT NULL,
    phone_hash VARCHAR(64) NULL,
    email VARCHAR(255) NULL,
    birth_date DATE NULL,
    gender ENUM('M', 'F', 'U') DEFAULT 'U',
    address TEXT NULL,
    province_id INT UNSIGNED NULL,
    district_id INT UNSIGNED NULL,
    status TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id),
    FOREIGN KEY (province_id) REFERENCES sys_provinces(id),
    FOREIGN KEY (district_id) REFERENCES sys_districts(id),
    INDEX idx_tc_hash (clinic_id, tc_no_hash),
    INDEX idx_name_hash (clinic_id, name_hash),
    INDEX idx_phone_hash (clinic_id, phone_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Randevular
DROP TABLE IF EXISTS cln_appointments;
CREATE TABLE cln_appointments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    patient_id BIGINT UNSIGNED NOT NULL,
    doctor_id BIGINT UNSIGNED NULL,
    type_id BIGINT UNSIGNED NOT NULL,
    appointment_date DATETIME NOT NULL,
    status ENUM('pending', 'confirmed', 'waiting', 'completed', 'cancelled') DEFAULT 'pending',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES ptn_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES sys_users(id) ON DELETE SET NULL,
    FOREIGN KEY (type_id) REFERENCES cln_appointment_types (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Randevu Kalemleri
DROP TABLE IF EXISTS cln_appointment_items;
CREATE TABLE cln_appointment_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    appointment_id BIGINT UNSIGNED NOT NULL,
    service_id BIGINT UNSIGNED NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    performer_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES cln_appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES cln_services(id) ON DELETE SET NULL,
    FOREIGN KEY (performer_id) REFERENCES sys_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Foreign Key kontrollerini geri açıyoruz
SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- DATA SEEDING
-- ==========================================

-- Provinces
INSERT IGNORE INTO sys_provinces (id, name) VALUES 
(1, 'Adana'), (2, 'Adıyaman'), (3, 'Afyonkarahisar'), (4, 'Ağrı'), (5, 'Amasya'), (6, 'Ankara'), (7, 'Antalya'), (8, 'Artvin'), 
(9, 'Aydın'), (10, 'Balıkesir'), (11, 'Bilecik'), (12, 'Bingöl'), (13, 'Bitlis'), (14, 'Bolu'), (15, 'Burdur'), (16, 'Bursa'), 
(17, 'Çanakkale'), (18, 'Çankırı'), (19, 'Çorum'), (20, 'Denizli'), (21, 'Diyarbakır'), (22, 'Edirne'), (23, 'Elazığ'), (24, 'Erzincan'), 
(25, 'Erzurum'), (26, 'Eskişehir'), (27, 'Gaziantep'), (28, 'Giresun'), (29, 'Gümüşhane'), (30, 'Hakkari'), (31, 'Hatay'), (32, 'Isparta'), 
(33, 'Mersin'), (34, 'İstanbul'), (35, 'İzmir'), (36, 'Kars'), (37, 'Kastamonu'), (38, 'Kayseri'), (39, 'Kırklareli'), (40, 'Kırşehir'), 
(41, 'Kocaeli'), (42, 'Konya'), (43, 'Kütahya'), (44, 'Malatya'), (45, 'Manisa'), (46, 'Kahramanmaraş'), (47, 'Mardin'), (48, 'Muğla'), 
(49, 'Muş'), (50, 'Nevşehir'), (51, 'Niğde'), (52, 'Ordu'), (53, 'Rize'), (54, 'Sakarya'), (55, 'Samsun'), (56, 'Siirt'), 
(57, 'Sinop'), (58, 'Sivas'), (59, 'Tekirdağ'), (60, 'Tokat'), (61, 'Trabzon'), (62, 'Tunceli'), (63, 'Şanlıurfa'), (64, 'Uşak'), 
(65, 'Van'), (66, 'Yozgat'), (67, 'Zonguldak'), (68, 'Aksaray'), (69, 'Bayburt'), (70, 'Karaman'), (71, 'Kırıkkale'), (72, 'Batman'), 
(73, 'Şırnak'), (74, 'Bartın'), (75, 'Ardahan'), (76, 'Iğdır'), (77, 'Yalova'), (78, 'Karabük'), (79, 'Kilis'), (80, 'Osmaniye'), (81, 'Düzce');

-- Districts (Examples for Istanbul, Ankara, Izmir)
INSERT IGNORE INTO sys_districts (id, province_id, name) VALUES 
-- Istanbul (34)
(3401, 34, 'Adalar'), (3402, 34, 'Arnavutköy'), (3403, 34, 'Ataşehir'), (3404, 34, 'Avcılar'), (3405, 34, 'Bağcılar'), 
(3406, 34, 'Bahçelievler'), (3407, 34, 'Bakırköy'), (3408, 34, 'Başakşehir'), (3409, 34, 'Bayrampaşa'), (3410, 34, 'Beşiktaş'), 
(3411, 34, 'Beykoz'), (3412, 34, 'Beylikdüzü'), (3413, 34, 'Beyoğlu'), (3414, 34, 'Büyükçekmece'), (3415, 34, 'Çatalca'), 
(3416, 34, 'Çekmeköy'), (3417, 34, 'Esenler'), (3418, 34, 'Esenyurt'), (3419, 34, 'Eyüpsultan'), (3420, 34, 'Fatih'), 
(3421, 34, 'Gaziosmanpaşa'), (3422, 34, 'Güngören'), (3423, 34, 'Kadıköy'), (3424, 34, 'Kağıthane'), (3425, 34, 'Kartal'), 
(3426, 34, 'Küçükçekmece'), (3427, 34, 'Maltepe'), (3428, 34, 'Pendik'), (3429, 34, 'Sancaktepe'), (3430, 34, 'Sarıyer'), 
(3431, 34, 'Silivri'), (3432, 34, 'Sultanbeyli'), (3433, 34, 'Sultangazi'), (3434, 34, 'Şile'), (3435, 34, 'Şişli'), 
(3436, 34, 'Tuzla'), (3437, 34, 'Ümraniye'), (3438, 34, 'Üsküdar'), (3439, 34, 'Zeytinburnu'),
-- Ankara (6)
(0601, 6, 'Altındağ'), (0602, 6, 'Ayaş'), (0603, 6, 'Bala'), (0604, 6, 'Beypazarı'), (0605, 6, 'Çamlıdere'), 
(0606, 6, 'Çankaya'), (0607, 6, 'Çubuk'), (0608, 6, 'Elmadağ'), (0609, 6, 'Etimesgut'), (0610, 6, 'Evren'), 
(0611, 6, 'Gölbaşı'), (0612, 6, 'Güdül'), (0613, 6, 'Haymana'), (0614, 6, 'Kahramankazan'), (0615, 6, 'Kalecik'), 
(0616, 6, 'Keçiören'), (0617, 6, 'Kızılcahamam'), (0618, 6, 'Mamak'), (0619, 6, 'Nallıhan'), (0620, 6, 'Polatlı'), 
(0621, 6, 'Pursaklar'), (0622, 6, 'Şereflikoçhisar'), (0623, 6, 'Sincan'), (0624, 6, 'Yenimahalle'),
-- Izmir (35)
(3501, 35, 'Aliağa'), (3502, 35, 'Balçova'), (3503, 35, 'Bayındır'), (3504, 35, 'Bayraklı'), (3505, 35, 'Bergama'), 
(3506, 35, 'Beydağ'), (3507, 35, 'Bornova'), (3508, 35, 'Buca'), (3509, 35, 'Çeşme'), (3510, 35, 'Çiğli'), 
(3511, 35, 'Dikili'), (3512, 35, 'Foça'), (3513, 35, 'Gaziemir'), (3514, 35, 'Güzelbahçe'), (3515, 35, 'Karabağlar'), 
(3516, 35, 'Karaburun'), (3517, 35, 'Karşıyaka'), (3518, 35, 'Kemalpaşa'), (3519, 35, 'Kınık'), (3520, 35, 'Kiraz'), 
(3521, 35, 'Konak'), (3522, 35, 'Menderes'), (3523, 35, 'Menemen'), (3524, 35, 'Narlıdere'), (3525, 35, 'Ödemiş'), 
(3526, 35, 'Seferihisar'), (3527, 35, 'Selçuk'), (3528, 35, 'Tire'), (3529, 35, 'Torbalı'), (3530, 35, 'Urla');
