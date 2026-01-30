CREATE TABLE IF NOT EXISTS sys_appointment_statuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    color_code VARCHAR(20) DEFAULT '#6c757d',
    icon_class VARCHAR(50) DEFAULT 'bi-circle',
    description VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    is_system TINYINT(1) DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Varsayılan verileri ekle
INSERT INTO sys_appointment_statuses (status_code, name, color_code, icon_class, is_system, sort_order) VALUES
('pending', 'Bekliyor', '#ffc107', 'bi-hourglass-split', 1, 1),
('confirmed', 'Onaylandı', '#0d6efd', 'bi-check-lg', 1, 2),
('waiting', 'Klinikte Bekliyor', '#fd7e14', 'bi-person-check', 1, 3),
('in_test', 'İşlemde/Muayenede', '#0dcaf0', 'bi-heart-pulse', 1, 4),
('completed', 'Tamamlandı', '#198754', 'bi-check-circle-fill', 1, 5),
('cancelled', 'İptal Edildi', '#dc3545', 'bi-x-circle', 1, 6),
('did_not_come', 'Gelmedi', '#6c757d', 'bi-dash-circle', 1, 7)
ON DUPLICATE KEY UPDATE name=VALUES(name);
