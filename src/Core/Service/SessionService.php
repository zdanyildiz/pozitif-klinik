<?php

declare(strict_types=1);

namespace App\Core\Service;

/**
 * SessionService - Oturum Yönetimi Soyutlaması
 * 
 * $_SESSION süper globaline doğrudan erişimi engellemek için kullanılır.
 * Unit test ve güvenlik standartları için gereklidir.
 */
class SessionService
{
    public function __construct()
    {
        $this->start();
    }

    /**
     * Oturumu başlatır (eğer henüz başlamamışsa)
     */
    public function start(): bool
    {
        if (session_status() === PHP_SESSION_NONE) {
            return session_start();
        }
        return true;
    }

    /**
     * Oturuma veri yazar
     */
    public function set(string $key, $value): void
    {
        $_SESSION[$key] = $value;
    }

    /**
     * Oturumdan veri okur
     */
    public function get(string $key, $default = null)
    {
        return $_SESSION[$key] ?? $default;
    }

    /**
     * Verinin oturumda olup olmadığını kontrol eder
     */
    public function has(string $key): bool
    {
        return isset($_SESSION[$key]);
    }

    /**
     * Belirli bir veriyi oturumdan siler
     */
    public function remove(string $key): void
    {
        if ($this->has($key)) {
            unset($_SESSION[$key]);
        }
    }

    /**
     * Tüm oturum verilerini temizler
     */
    public function clear(): void
    {
        $_SESSION = [];
    }

    /**
     * Oturumu tamamen yok eder
     */
    public function destroy(): bool
    {
        $this->clear();

        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params["path"],
                $params["domain"],
                $params["secure"],
                $params["httponly"]
            );
        }

        return session_destroy();
    }

    /**
     * Session ID'sini yeniler (Session Fixation koruması)
     */
    public function regenerate(bool $deleteOldSession = true): bool
    {
        return session_regenerate_id($deleteOldSession);
    }
}
