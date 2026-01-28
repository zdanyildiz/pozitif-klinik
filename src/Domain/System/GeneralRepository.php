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
    /**
     * ICD-10 tanılarını arar veya sık kullanılanları getirir.
     * Klinik bazlı favorileri önceliklendirir.
     */
    public function searchDiagnoses(int $clinicId, ?string $query = null): array
    {
        $sql = "SELECT i.code, i.name, (f.id IS NOT NULL) as is_favorite
                FROM sys_icd10 i
                LEFT JOIN cln_diagnosis_favorites f ON i.code = f.icd_code AND f.clinic_id = :clinic_id";

        if (empty($query)) {
            $sql .= " WHERE f.id IS NOT NULL OR i.is_common = 1 ORDER BY is_favorite DESC, i.name ASC LIMIT 50";
            $stmt = $this->db->prepare($sql);
            $stmt->execute(['clinic_id' => $clinicId]);
        } else {
            $sql .= " WHERE i.name LIKE :q OR i.code LIKE :q 
                     ORDER BY is_favorite DESC, i.name ASC LIMIT 50";
            $stmt = $this->db->prepare($sql);
            $stmt->execute(['clinic_id' => $clinicId, 'q' => "%$query%"]);
        }
        return $stmt->fetchAll();
    }
}
