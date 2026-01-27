<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\Database;

/**
 * PlatformAdminRepository - Sistem (Platform) Yöneticileri için Veri Erişimi
 */
class PlatformAdminRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Tüm platform adminlerini listeler
     */
    public function findAll(): array
    {
        $sql = "SELECT id, username, created_at FROM sys_platform_admins ORDER BY created_at DESC";
        return $this->db->fetchAll($sql);
    }

    /**
     * Yeni bir platform admini oluşturur
     */
    public function create(array $data): int
    {
        $sql = "INSERT INTO sys_platform_admins (username, password_hash) VALUES (:username, :password_hash)";
        $params = [
            'username' => $data['username'],
            'password_hash' => password_hash($data['password'], PASSWORD_BCRYPT)
        ];

        $this->db->query($sql, $params);
        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Platform adminini günceller
     */
    public function update(int $id, array $data): bool
    {
        $updates = [];
        $params = ['id' => $id];

        if (!empty($data['username'])) {
            $updates[] = "username = :username";
            $params['username'] = $data['username'];
        }

        if (!empty($data['password'])) {
            $updates[] = "password_hash = :password_hash";
            $params['password_hash'] = password_hash($data['password'], PASSWORD_BCRYPT);
        }

        if (empty($updates)) {
            return false;
        }

        $sql = "UPDATE sys_platform_admins SET " . implode(', ', $updates) . " WHERE id = :id";
        return (bool) $this->db->query($sql, $params);
    }

    /**
     * Kullanıcı adına göre platform admini bulur
     */
    public function findByUsername(string $username): ?array
    {
        $sql = "SELECT id, username, password_hash FROM sys_platform_admins WHERE username = :username";
        $result = $this->db->fetch($sql, ['username' => $username]);
        return $result ?: null;
    }

    /**
     * Platform adminini siler
     */
    public function delete(int $id): bool
    {
        $sql = "DELETE FROM sys_platform_admins WHERE id = :id";
        return (bool) $this->db->query($sql, ['id' => $id]);
    }
}
