<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Core\Database;

class ServiceRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Tüm aktif hizmetleri listeler
     */
    public function findAll(int $clinicId, bool $includeInactive = false): array
    {
        $sql = "SELECT * FROM cln_services WHERE clinic_id = ?";

        if (!$includeInactive) {
            $sql .= " AND is_active = 1";
        }

        $sql .= " ORDER BY category ASC, name ASC";

        return $this->db->fetchAll($sql, [$clinicId]);
    }

    /**
     * ID'ye göre hizmet getirir
     */
    public function findById(int $clinicId, int $serviceId): ?array
    {
        $sql = "SELECT * FROM cln_services WHERE clinic_id = ? AND id = ?";
        $result = $this->db->fetch($sql, [$clinicId, $serviceId]);
        return $result ?: null;
    }

    /**
     * Koda göre hizmet arar
     */
    public function findByCode(int $clinicId, string $code): ?array
    {
        $sql = "SELECT * FROM cln_services WHERE clinic_id = ? AND code = ? AND is_active = 1";
        $result = $this->db->fetch($sql, [$clinicId, $code]);
        return $result ?: null;
    }

    /**
     * İsim veya kodda arama yapar
     */
    public function search(int $clinicId, string $query): array
    {
        $sql = "SELECT * FROM cln_services 
                WHERE clinic_id = ? AND is_active = 1 
                AND (name LIKE ? OR code LIKE ? OR description LIKE ?)
                ORDER BY name ASC";

        $likeQuery = '%' . $query . '%';
        return $this->db->fetchAll($sql, [$clinicId, $likeQuery, $likeQuery, $likeQuery]);
    }

    /**
     * Kategoriye göre hizmetleri getirir
     */
    public function findByCategory(int $clinicId, string $category): array
    {
        $sql = "SELECT * FROM cln_services 
                WHERE clinic_id = ? AND category = ? AND is_active = 1 
                ORDER BY name ASC";
        return $this->db->fetchAll($sql, [$clinicId, $category]);
    }

    /**
     * Tüm kategorileri listeler
     */
    public function getCategories(int $clinicId): array
    {
        $sql = "SELECT DISTINCT category FROM cln_services 
                WHERE clinic_id = ? AND is_active = 1 AND category IS NOT NULL AND category != ''
                ORDER BY category ASC";
        $results = $this->db->fetchAll($sql, [$clinicId]);
        return array_column($results, 'category');
    }

    /**
     * Yeni hizmet oluşturur
     */
    public function create(int $clinicId, array $data): int
    {
        $sql = "INSERT INTO cln_services (clinic_id, name, code, description, category, price, tax_rate, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        $this->db->query($sql, [
            $clinicId,
            $data['name'],
            $data['code'] ?? null,
            $data['description'] ?? null,
            $data['category'] ?? null,
            $data['price'] ?? 0,
            $data['tax_rate'] ?? 0,
            $data['is_active'] ?? 1
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Hizmet bilgilerini günceller
     */
    public function update(int $clinicId, int $serviceId, array $data): bool
    {
        $sql = "UPDATE cln_services SET 
                    name = ?, 
                    code = ?,
                    description = ?,
                    category = ?,
                    price = ?, 
                    tax_rate = ?,
                    is_active = ? 
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $data['name'],
            $data['code'] ?? null,
            $data['description'] ?? null,
            $data['category'] ?? null,
            $data['price'] ?? 0,
            $data['tax_rate'] ?? 0,
            $data['is_active'] ?? 1,
            $clinicId,
            $serviceId
        ]);

        return true;
    }

    /**
     * Hizmeti pasif yapar (soft delete)
     */
    public function delete(int $clinicId, int $serviceId): bool
    {
        $sql = "UPDATE cln_services SET is_active = 0 WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $serviceId]);
        return true;
    }

    /**
     * Hizmet istatistikleri
     */
    public function getStats(int $clinicId): array
    {
        $sql = "SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active,
                    COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive,
                    COUNT(DISTINCT category) as category_count
                FROM cln_services WHERE clinic_id = ?";

        return $this->db->fetch($sql, [$clinicId]) ?? [
            'total' => 0,
            'active' => 0,
            'inactive' => 0,
            'category_count' => 0
        ];
    }
}
