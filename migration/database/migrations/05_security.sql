CREATE TABLE IF NOT EXISTS `sys_rate_limits` (
  `ip_address` varchar(45) NOT NULL,
  `route_hash` varchar(32) NOT NULL, -- Hangi sayfaya saldırıyor?
  `request_count` int DEFAULT 1,
  `reset_at` timestamp NOT NULL,
  PRIMARY KEY (`ip_address`, `route_hash`),
  KEY `idx_reset` (`reset_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
