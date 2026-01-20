<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\Database;
use Exception;
use Throwable;

class TenantRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Yeni bir klinik ve yönetici oluşturur (Transaction içerir)
     *
     * @param array $tenantData Klinik bilgileri ['name', 'domain_prefix']
     * @param array $adminData Yönetici bilgileri ['username', 'password']
     * @return int Oluşturulan Klinik ID
     * @throws Exception
     */
    public function createTenantWithAdmin(array $tenantData, array $adminData): int
    {
        $connection = $this->db->getConnection();

        try {
            $connection->beginTransaction();

            // 1. Kliniği oluştur
            $sqlTenant = "INSERT INTO sys_tenants (name, domain_prefix) VALUES (:name, :prefix)";
            $stmtTenant = $connection->prepare($sqlTenant);
            $stmtTenant->execute([
                'name' => $tenantData['name'],
                'prefix' => $tenantData['domain_prefix']
            ]);

            $clinicId = (int) $connection->lastInsertId();

            // 2. Yönetici kullanıcısını oluştur
            $sqlUser = "INSERT INTO sys_users (clinic_id, username, password_hash, role, is_active) 
                        VALUES (:clinic_id, :username, :password_hash, 'admin', 1)";
            $stmtUser = $connection->prepare($sqlUser);
            $stmtUser->execute([
                'clinic_id' => $clinicId,
                'username' => $adminData['username'],
                'password_hash' => password_hash($adminData['password'], PASSWORD_BCRYPT)
            ]);

            $connection->commit();

            return $clinicId;

        } catch (Throwable $e) {
            if ($connection->inTransaction()) {
                $connection->rollBack();
            }
            throw new Exception("Klinik oluşturulurken hata: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Tüm klinikleri listeler (Admin kullanıcısı ile birlikte)
     */
    public function findAll(): array
    {
        $sql = "SELECT t.*, 
                (SELECT username FROM sys_users WHERE clinic_id = t.id AND role = 'admin' LIMIT 1) as admin_username
                FROM sys_tenants t 
                ORDER BY t.created_at DESC";
        return $this->db->fetchAll($sql);
    }

    /**
     * Domain prefix'e göre klinik arar
     */
    public function findByDomain(string $prefix): ?array
    {
        $sql = "SELECT id, name, domain_prefix FROM sys_tenants WHERE domain_prefix = ?";
        $result = $this->db->fetch($sql, [$prefix]);
        return $result ?: null;
    }

    /**
     * ID'ye göre klinik arar
     */
    public function findById(int $id): ?array
    {
        $sql = "SELECT * FROM sys_tenants WHERE id = ?";
        $result = $this->db->fetch($sql, [$id]);
        return $result ?: null;
    }

    /**
     * Klinik ve Opsiyonel Olarak Yönetici Bilgilerini Günceller
     */
    public function update(int $id, array $tenantData, array $adminData = []): bool
    {
        $connection = $this->db->getConnection();

        try {
            $connection->beginTransaction();

            // 1. Klinik Bilgilerini Güncelle
            $sqlTenant = "UPDATE sys_tenants SET name = ?, is_active = ? WHERE id = ?";
            $stmt = $connection->prepare($sqlTenant);
            $stmt->execute([
                $tenantData['name'],
                $tenantData['is_active'],
                $id
            ]);

            // 2. Yönetici Bilgilerini Güncelle (Eğer gönderildiyse)
            if (!empty($adminData)) {
                // Mevcut admini bul
                $sqlFindAdmin = "SELECT id FROM sys_users WHERE clinic_id = ? AND role = 'admin' LIMIT 1";
                $stmtFind = $connection->prepare($sqlFindAdmin);
                $stmtFind->execute([$id]);
                $adminUser = $stmtFind->fetch(\PDO::FETCH_ASSOC);

                if ($adminUser) {
                    $userId = $adminUser['id'];
                    $updates = [];
                    $params = [];

                    if (!empty($adminData['username'])) {
                        $updates[] = "username = ?";
                        $params[] = $adminData['username'];
                    }

                    if (!empty($adminData['password'])) {
                        $updates[] = "password_hash = ?";
                        $params[] = password_hash($adminData['password'], PASSWORD_BCRYPT);
                    }

                    if (!empty($updates)) {
                        $sqlUser = "UPDATE sys_users SET " . implode(', ', $updates) . " WHERE id = ?";
                        $params[] = $userId;
                        $stmtUser = $connection->prepare($sqlUser);
                        $stmtUser->execute($params);
                    }
                }
            }

            $connection->commit();
            return true;

        } catch (Throwable $e) {
            if ($connection->inTransaction()) {
                $connection->rollBack();
            }
            throw new Exception("Güncelleme hatası: " . $e->getMessage(), 0, $e);
        }
    }
}
