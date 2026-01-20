<?php

declare(strict_types=1);

namespace App\Domain\System;

use PDO;

class GeneralRepository
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Tüm illeri listeler
     */
    public function getProvinces(): array
    {
        $stmt = $this->db->query("SELECT id, name FROM sys_provinces ORDER BY name ASC");
        return $stmt->fetchAll();
    }

    /**
     * Seçilen ile ait ilçeleri listeler
     */
    public function getDistricts(int $provinceId): array
    {
        $stmt = $this->db->prepare("SELECT id, name FROM sys_districts WHERE province_id = :province_id ORDER BY name ASC");
        $stmt->execute(['province_id' => $provinceId]);
        return $stmt->fetchAll();
    }
}
