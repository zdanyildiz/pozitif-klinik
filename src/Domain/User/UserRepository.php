<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Core\Database;

class UserRepository
{
    private Database $db;
    private \Psr\Log\LoggerInterface $logger;

    public function __construct(Database $db, \Psr\Log\LoggerInterface $logger)
    {
        $this->db = $db;
        $this->logger = $logger;
    }

    /**
     * Kliniğe ait kullanıcıları listeler (şifre hariç)
     */
    public function findAll(int $clinicId): array
    {
        $sql = "SELECT id, clinic_id, username, name, role, is_active, created_at 
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
        $sql = "SELECT id, clinic_id, username, name, role, is_active 
                FROM sys_users 
                WHERE clinic_id = ? AND username = ?";
        $result = $this->db->fetch($sql, [$clinicId, $username]);
        return $result ?: null;
    }

    /**
     * Tenant ve Kullanıcı adına göre kullanıcıyı bulur (Tenant-Aware Login)
     * Önce tenant'ın aktifliğini kontrol eder, sonra kullanıcıyı sorgular.
     */
    public function findUserByTenantAndUsername(string $clinicCode, string $username): array
    {
        // 1. Önce Tenant (Klinik) kontrolü
        $sqlTenant = "SELECT id, is_active FROM sys_tenants WHERE domain_prefix = ?";
        $tenant = $this->db->fetch($sqlTenant, [$clinicCode]);

        if (!$tenant) {
            return ['status' => 'error', 'reason' => 'tenant_not_found'];
        }

        if ((int) $tenant['is_active'] !== 1) {
            return ['status' => 'error', 'reason' => 'tenant_inactive'];
        }

        // 2. Kullanıcıyı sorgula (Tenant ID ile)
        $sqlUser = "SELECT id, clinic_id, username, name, password_hash, role, is_active 
                    FROM sys_users 
                    WHERE clinic_id = ? AND username = ?";

        $user = $this->db->fetch($sqlUser, [$tenant['id'], $username]);

        if (!$user) {
            return ['status' => 'error', 'reason' => 'user_not_found'];
        }

        return ['status' => 'success', 'user' => $user];
    }

    /**
     * Yeni kullanıcı oluşturur
     */
    public function create(int $clinicId, array $data): int
    {
        $sql = "INSERT INTO sys_users (clinic_id, username, name, password_hash, role, is_active) 
                VALUES (?, ?, ?, ?, ?, 1)";

        $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);

        $this->logger->debug("[UserRepository] Creating User", [
            'clinic_id' => $clinicId,
            'username' => $data['username']
        ]);

        $this->db->query($sql, [
            $clinicId,
            $data['username'],
            $data['name'] ?? null,
            $hashedPassword,
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

    /**
     * ID'ye göre kullanıcı getirir
     */
    public function findById(int $clinicId, int $userId): ?array
    {
        $sql = "SELECT id, clinic_id, username, name, role, is_active, created_at 
                FROM sys_users 
                WHERE clinic_id = ? AND id = ?";
        $result = $this->db->fetch($sql, [$clinicId, $userId]);
        return $result ?: null;
    }

    /**
     * Kullanıcı bilgilerini günceller
     */
    public function update(int $clinicId, int $userId, array $data): bool
    {
        // Şifre güncellemesi varsa
        if (!empty($data['password'])) {
            $sql = "UPDATE sys_users SET 
                        username = ?,
                        name = ?,
                        role = ?,
                        is_active = ?,
                        password_hash = ?
                    WHERE clinic_id = ? AND id = ?";

            $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);

            $this->logger->debug("[UserRepository] Updating User WITH password", [
                'clinic_id' => $clinicId,
                'user_id' => $userId,
                'username' => $data['username']
            ]);

            $this->db->query($sql, [
                $data['username'],
                $data['name'] ?? null,
                $data['role'],
                $data['is_active'] ?? 1,
                $hashedPassword,
                $clinicId,
                $userId
            ]);
        } else {
            // Şifre güncellemesi yok
            $sql = "UPDATE sys_users SET 
                        username = ?,
                        name = ?,
                        role = ?,
                        is_active = ?
                    WHERE clinic_id = ? AND id = ?";

            $this->db->query($sql, [
                $data['username'],
                $data['name'] ?? null,
                $data['role'],
                $data['is_active'] ?? 1,
                $clinicId,
                $userId
            ]);
        }

        return true;
    }

    public function listUsers(int $clinicId, ?string $role = null): array
    {
        $sql = "SELECT id, name, role FROM sys_users WHERE clinic_id = ?";
        $params = [$clinicId];

        if ($role) {
            $sql .= " AND role = ?";
            $params[] = $role;
        }

        $sql .= " AND is_active = 1 ORDER BY name ASC";
        return $this->db->fetchAll($sql, $params);
    }
}
