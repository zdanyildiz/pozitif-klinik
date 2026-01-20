<?php

declare(strict_types=1);

namespace App\Domain\Patient;

use App\Core\Database;

/**
 * Yaşam Bulguları (Vitals) Repository
 * Hasta gelişimini (Boy, Kilo, Tansiyon vb.) takip eder.
 */
class PatientVitalsRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Yeni bir yaşam bulgusu kaydı ekler
     */
    public function addVital(int $clinicId, int $patientId, array $data): int
    {
        $sql = "INSERT INTO ptn_vitals (
                    clinic_id, patient_id, height, weight, 
                    systolic_bp, diastolic_bp, heart_rate, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        $this->db->query($sql, [
            $clinicId,
            $patientId,
            $data['height'] ?? null,
            $data['weight'] ?? null,
            $data['systolic_bp'] ?? null,
            $data['diastolic_bp'] ?? null,
            $data['heart_rate'] ?? null,
            $data['created_by'] ?? null
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Bir hastanın tüm yaşam bulguları geçmişini getirir
     * Tarihe göre yeniden eskiye sıralı.
     */
    public function getHistory(int $clinicId, int $patientId, int $limit = 100): array
    {
        $sql = "SELECT * FROM ptn_vitals 
                WHERE clinic_id = ? AND patient_id = ? 
                ORDER BY measured_at DESC 
                LIMIT ?";

        return $this->db->fetchAll($sql, [$clinicId, $patientId, $limit]);
    }

    /**
     * Son yaşam bulgusunu getirir
     */
    public function getLastVitals(int $clinicId, int $patientId): ?array
    {
        $sql = "SELECT * FROM ptn_vitals 
                WHERE clinic_id = ? AND patient_id = ? 
                ORDER BY measured_at DESC 
                LIMIT 1";

        $result = $this->db->fetch($sql, [$clinicId, $patientId]);
        return $result ?: null;
    }
}
