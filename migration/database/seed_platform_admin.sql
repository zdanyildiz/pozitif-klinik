-- =====================================================
-- Platform Admin Seed
-- Pozitif Klinik - Varsayılan Platform Yöneticisi
-- =====================================================
-- Şifre Hash Bilgisi:
--   Algoritma: PASSWORD_BCRYPT (PHP password_hash)
--   Özel anahtar: YOK - bcrypt kendi salt'ını üretir
--   Doğrulama: password_verify('#Global2025*', hash) = true
-- =====================================================

-- Varsayılan platform admin kaydı
INSERT INTO sys_platform_admins (username, password_hash)
VALUES (
    'admin',
    '$2y$10$rZVuHSYsz7uAINCLxcrW7uxVWWZ9YHhjr/6zkNnEIiss7RNgNLiOu'
)
ON DUPLICATE KEY UPDATE
    password_hash = VALUES(password_hash);

-- Doğrulama: Eklenen kaydı kontrol et
-- SELECT id, username, created_at FROM sys_platform_admins WHERE username = 'admin';
