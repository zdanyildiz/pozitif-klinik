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

    public function findAll(int $clinicId): array
    {
        $sql = "SELECT * FROM cln_services WHERE clinic_id = ? AND is_active = 1 ORDER BY name ASC";
        return $this->db->fetchAll($sql, [$clinicId]);
    }

    public function findById(int $clinicId, int $serviceId): ?array
    {
        $sql = "SELECT * FROM cln_services WHERE clinic_id = ? AND id = ?";
        return $this->db->fetch($sql, [$clinicId, $serviceId]);
    }

    public function create(int $clinicId, array $data): int
    {
        $sql = "INSERT INTO cln_services (clinic_id, name, price, is_active) 
                VALUES (?, ?, ?, ?)";

        $this->db->query($sql, [
            $clinicId,
            $data['name'],
            $data['price'] ?? 0,
            $data['is_active'] ?? 1
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    public function update(int $clinicId, int $serviceId, array $data): bool
    {
        $sql = "UPDATE cln_services SET 
                    name = ?, 
                    price = ?, 
                    is_active = ? 
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $data['name'],
            $data['price'] ?? 0,
            $data['is_active'] ?? 1,
            $clinicId,
            $serviceId
        ]);

        return true;
    }

    public function delete(int $clinicId, int $serviceId): bool
    {
        $sql = "UPDATE cln_services SET is_active = 0 WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $serviceId]);
        return true;
    }
}
