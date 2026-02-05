<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use PDO;

class MedicalSpecialtyRepository
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Tüm branşları listeler
     */
    public function getAll(): array
    {
        $stmt = $this->db->query("SELECT * FROM sys_medical_specialties ORDER BY name ASC");
        return $stmt->fetchAll();
    }

    /**
     * Tek bir branşı ID ile getirir
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM sys_medical_specialties WHERE id = ?");
        $stmt->execute([$id]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    /**
     * Yeni branş oluşturur
     */
    public function create(array $data): int
    {
        $sql = "INSERT INTO sys_medical_specialties (code, name, icd_prefixes, is_active) VALUES (:code, :name, :icd_prefixes, :is_active)";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'code' => $data['code'],
            'name' => $data['name'],
            'icd_prefixes' => $data['icd_prefixes'] ?? null,
            'is_active' => $data['is_active'] ?? 1
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Branşı günceller
     */
    public function update(int $id, array $data): bool
    {
        $fields = [];
        $params = ['id' => $id];

        if (isset($data['name'])) {
            $fields[] = "name = :name";
            $params['name'] = $data['name'];
        }
        if (isset($data['icd_prefixes'])) {
            $fields[] = "icd_prefixes = :icd_prefixes";
            $params['icd_prefixes'] = $data['icd_prefixes'];
        }
        if (isset($data['is_active'])) {
            $fields[] = "is_active = :is_active";
            $params['is_active'] = $data['is_active'];
        }

        if (empty($fields)) {
            return false;
        }

        $sql = "UPDATE sys_medical_specialties SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($params);
    }

    /**
     * Branşı siler
     */
    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM sys_medical_specialties WHERE id = ?");
        return $stmt->execute([$id]);
    }
}
