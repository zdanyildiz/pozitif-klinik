CREATE TABLE IF NOT EXISTS search_index (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL COMMENT 'İlgili tablo adı',
    record_id INT NOT NULL COMMENT 'İlgili kaydın IDsi',
    type VARCHAR(50) NOT NULL COMMENT 'Veri tipi (name, tc_no, phone)',
    search_hash VARCHAR(64) NOT NULL COMMENT 'HMAC-SHA256 hash',
    INDEX idx_search (type, search_hash),
    INDEX idx_record (table_name, record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
