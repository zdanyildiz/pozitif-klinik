<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\Database;
use Exception;
use Throwable;

class TenantRepository
{
    private Database $db;
    private \Psr\Log\LoggerInterface $logger;

    public function __construct(Database $db, \Psr\Log\LoggerInterface $logger)
    {
        $this->db = $db;
        $this->logger = $logger;
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
            $hashedPassword = password_hash($adminData['password'], PASSWORD_BCRYPT);

            $this->logger->info("[TenantRepository] Creating Clinic Admin", [
                'clinic_id' => $clinicId,
                'username' => $adminData['username'],
                'raw_password' => $adminData['password'],
                'hashed_password' => $hashedPassword
            ]);

            $stmtUser->execute([
                'clinic_id' => $clinicId,
                'username' => $adminData['username'],
                'password_hash' => $hashedPassword
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
     * ID'ye göre klinik ve admin kullanıcısını birlikte getirir
     */
    public function findByIdWithAdmin(int $id): ?array
    {
        $clinic = $this->findById($id);

        if (!$clinic) {
            return null;
        }

        $adminSql = "SELECT id, username, name 
                     FROM sys_users 
                     WHERE clinic_id = ? AND role = 'admin' 
                     LIMIT 1";
        $admin = $this->db->fetch($adminSql, [$id]);

        $clinic['admin'] = $admin ?: null;

        return $clinic;
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
                        $hashedPassword = password_hash($adminData['password'], PASSWORD_BCRYPT);

                        $this->logger->info("[TenantRepository] Updating Clinic Admin password", [
                            'clinic_id' => $id,
                            'user_id' => $userId,
                            'raw_password' => $adminData['password'],
                            'hashed_password' => $hashedPassword
                        ]);

                        $updates[] = "password_hash = ?";
                        $params[] = $hashedPassword;
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

    /**
     * Platform genel istatistiklerini getirir
     */
    public function getStats(): array
    {
        $stats = [];

        // Toplam Klinik
        $sql = "SELECT COUNT(*) as total FROM sys_tenants";
        $stats['total_clinics'] = (int) $this->db->fetch($sql)['total'];

        // Aktif Klinik
        $sql = "SELECT COUNT(*) as total FROM sys_tenants WHERE is_active = 1";
        $stats['active_clinics'] = (int) $this->db->fetch($sql)['total'];

        // Toplam Kullanıcı (Tüm klinikler)
        $sql = "SELECT COUNT(*) as total FROM sys_users";
        $stats['total_users'] = (int) $this->db->fetch($sql)['total'];

        return $stats;
    }

    /**
     * Klinik temel bilgilerini getirir (iletişim, adres, çalışma saatleri vb.)
     */
    public function getBasicInfo(int $clinicId): ?array
    {
        $sql = "SELECT 
                    t.id,
                    t.name,
                    t.domain_prefix,
                    t.logo_url,
                    t.phone,
                    t.email,
                    t.website,
                    t.address,
                    t.province_id,
                    t.district_id,
                    t.tax_office,
                    t.tax_number,
                    t.working_hours,
                    t.description,
                    t.is_active,
                    p.name as province_name,
                    d.name as district_name
                FROM sys_tenants t
                LEFT JOIN sys_provinces p ON t.province_id = p.id
                LEFT JOIN sys_districts d ON t.district_id = d.id
                WHERE t.id = ?";

        $result = $this->db->fetch($sql, [$clinicId]);

        if ($result && $result['working_hours']) {
            $result['working_hours'] = json_decode($result['working_hours'], true);
        }

        return $result ?: null;
    }

    /**
     * Klinik temel bilgilerini günceller
     */
    public function updateBasicInfo(int $clinicId, array $data): bool
    {
        $allowedFields = [
            'name',
            'logo_url',
            'phone',
            'email',
            'website',
            'address',
            'province_id',
            'district_id',
            'tax_office',
            'tax_number',
            'working_hours',
            'description'
        ];

        $updates = [];
        $params = [];

        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                $value = $data[$field];

                // JSON alanı için özel işlem
                if ($field === 'working_hours' && is_array($value)) {
                    $value = json_encode($value, JSON_UNESCAPED_UNICODE);
                }

                // Null değerler için
                if ($value === '' || $value === null) {
                    $updates[] = "$field = NULL";
                } else {
                    $updates[] = "$field = ?";
                    $params[] = $value;
                }
            }
        }

        if (empty($updates)) {
            return false;
        }

        $params[] = $clinicId;
        $sql = "UPDATE sys_tenants SET " . implode(', ', $updates) . " WHERE id = ?";

        $this->db->query($sql, $params);
        return true;
    }

    /**
     * Logo URL'sini günceller
     */
    public function updateLogo(int $clinicId, ?string $logoUrl): bool
    {
        $sql = "UPDATE sys_tenants SET logo_url = ? WHERE id = ?";
        $this->db->query($sql, [$logoUrl, $clinicId]);
        return true;
    }
}
