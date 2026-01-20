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
     * Tüm klinikleri listeler
     */
    public function findAll(): array
    {
        $sql = "SELECT id, name, domain_prefix, created_at FROM sys_tenants ORDER BY created_at DESC";
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
}
