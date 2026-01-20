<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Core\Database;

class UserRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Kliniğe ait kullanıcıları listeler (şifre hariç)
     */
    public function findAll(int $clinicId): array
    {
        $sql = "SELECT id, clinic_id, username, role, is_active, created_at 
                FROM sys_users 
                WHERE clinic_id = ? 
                ORDER BY id DESC";
        return $this->db->fetchAll($sql, [$clinicId]);
    }

    /**
     * Kullanıcı adına göre kullanıcıyı bulur (klinik içinde benzersiz)
     */
    public function findByUsername(int $clinicId, string $username): ?array
    {
        $sql = "SELECT id, clinic_id, username, role, is_active 
                FROM sys_users 
                WHERE clinic_id = ? AND username = ?";
        $result = $this->db->fetch($sql, [$clinicId, $username]);
        return $result ?: null;
    }

    /**
     * Kullanıcı adına göre kullanıcıyı bulur (Global arama - Login için)
     * Şifre hash'ini de döndürür.
     */
    public function findByUsernameGlobal(string $username): ?array
    {
        $sql = "SELECT id, clinic_id, username, password_hash, role, is_active 
                FROM sys_users 
                WHERE username = ?";
        $result = $this->db->fetch($sql, [$username]);
        return $result ?: null;
    }

    /**
     * Yeni kullanıcı oluşturur
     */
    public function create(int $clinicId, array $data): int
    {
        $sql = "INSERT INTO sys_users (clinic_id, username, password_hash, role, is_active) 
                VALUES (?, ?, ?, ?, 1)";

        $this->db->query($sql, [
            $clinicId,
            $data['username'],
            password_hash($data['password'], PASSWORD_BCRYPT),
            $data['role']
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Kullanıcıyı siler
     */
    public function delete(int $clinicId, int $userId): bool
    {
        $sql = "DELETE FROM sys_users WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $userId]);
        return true;
    }

    /**
     * Kullanıcının rolünü getirir
     */
    public function findRoleById(int $userId): ?string
    {
        $sql = "SELECT role FROM sys_users WHERE id = ?";
        $result = $this->db->fetch($sql, [$userId]);
        return $result['role'] ?? null;
    }
}
