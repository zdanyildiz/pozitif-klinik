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
     * Tüm tıbbi branşları listeler
     */
    public function getMedicalSpecialties(): array
    {
        $stmt = $this->db->query("SELECT code, name FROM sys_medical_specialties WHERE is_active = 1 ORDER BY name ASC");
        return $stmt->fetchAll();
    }
    /**
     * ICD-10 tanılarını arar veya sık kullanılanları getirir.
     * Klinik bazlı favorileri önceliklendirir.
     */
    /**
     * ICD-10 tanılarını arar veya sık kullanılanları getirir.
     * Klinik bazlı favorileri ve doktor branşını (Hybrid Search) önceliklendirir.
     */
    public function searchDiagnoses(int $clinicId, ?string $query = null, ?int $userId = null): array
    {
        // 1. Doktorun branşını bul (Boost için)
        $specialtyPrefixes = [];
        if ($userId) {
            $specialtyPrefixes = $this->getUserSpecialtyPrefixes($userId);
        }

        // 2. Base SQL
        $sql = "SELECT i.code, i.name, 
                       (f.id IS NOT NULL) as is_favorite,
                       0 as relevance_score -- Default score
                FROM sys_icd10 i
                LEFT JOIN cln_diagnosis_favorites f ON i.code = f.icd_code AND f.clinic_id = :clinic_id";

        $params = ['clinic_id' => $clinicId];
        $orderBy = "is_favorite DESC";

        // 3. Branş Boost Logic (SQL Injection'a karşı whitelist kullanıyoruz)
        if (!empty($specialtyPrefixes)) {
            $boostCases = [];
            foreach ($specialtyPrefixes as $prefix) {
                // Prefix sadece harf olmalı (Güvenlik)
                if (ctype_alpha($prefix)) {
                    $boostCases[] = "WHEN i.code LIKE '$prefix%' THEN 1";
                }
            }
            if (!empty($boostCases)) {
                $sql = str_replace(
                    "0 as relevance_score",
                    "(CASE " . implode(' ', $boostCases) . " ELSE 0 END) as relevance_score",
                    $sql
                );
                $orderBy .= ", relevance_score DESC";
            }
        }

        // 4. Arama Filtresi
        if (empty($query)) {
            // Arama yoksa favoriler veya yaygın olanlar
            $sql .= " WHERE f.id IS NOT NULL OR i.is_common = 1";
        } else {
            // Arama varsa (Blind Index yok, ICD public data olduğu için LIKE güvenli)
            $sql .= " WHERE (i.name LIKE :q_name OR i.code LIKE :q_code)";
            $params['q_name'] = "%$query%";
            $params['q_code'] = "%$query%";
        }

        // 5. Sıralama ve Limit
        $sql .= " ORDER BY " . $orderBy . ", i.name ASC LIMIT 50";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Kullanıcının uzmanlık alanına göre öncelikli ICD harflerini döner
     */
    private function getUserSpecialtyPrefixes(int $userId): array
    {
        $stmt = $this->db->prepare("SELECT specialty FROM sys_users WHERE id = ?");
        $stmt->execute([$userId]);
        $specialty = $stmt->fetchColumn();

        if (!$specialty) {
            return [];
        }

        // 2. sys_medical_specialties tablosundan eşleşen kaydı bul
        // Hem Code (INTERNAL_MEDICINE) hem de Name (İç Hastalıkları) eşleşmesine bakıyoruz
        // Böylece eski verilerle de uyumlu çalışır.
        $stmt = $this->db->prepare("
            SELECT icd_prefixes 
            FROM sys_medical_specialties 
            WHERE code = :code OR name LIKE :name_pattern
            LIMIT 1
        ");

        $stmt->execute([
            'code' => $specialty,
            'name_pattern' => "%$specialty%"
        ]);

        $prefixesStr = $stmt->fetchColumn();

        if ($prefixesStr) {
            return explode(',', $prefixesStr);
        }

        return [];
    }
}
