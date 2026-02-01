<?php

declare(strict_types=1);

namespace App\Domain\Lab;

use App\Core\Database;
use PDO;

class LabRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Hastanın tüm laboratuvar sonuçlarını getirir (Detayları ile birlikte)
     */
    public function findAllByPatient(int $clinicId, int $patientId): array
    {
        // Önce başlıkları al
        $sql = "SELECT r.*, u.name as doctor_name, a.appointment_date
                FROM cln_lab_results r
                LEFT JOIN sys_users u ON r.doctor_id = u.id
                LEFT JOIN cln_appointments a ON r.appointment_id = a.id
                WHERE r.clinic_id = ? AND r.patient_id = ?
                ORDER BY r.result_date DESC";

        $results = $this->db->fetchAll($sql, [$clinicId, $patientId]);

        if (empty($results)) {
            return [];
        }

        // Her sonuç için kalemleri (items) getir
        foreach ($results as &$result) {
            $result['items'] = $this->getItemsByResultId((int) $result['id']);
        }

        return $results;
    }

    /**
     * Belirli bir sonuç kaydına ait test kalemlerini getirir
     */
    public function getItemsByResultId(int $resultId): array
    {
        $sql = "SELECT * FROM cln_lab_result_items WHERE result_id = ? ORDER BY id ASC";
        return $this->db->fetchAll($sql, [$resultId]);
    }

    /**
     * ID'ye göre tekil sonuç detayı
     */
    public function findById(int $clinicId, int $resultId): ?array
    {
        $sql = "SELECT r.*, u.name as doctor_name
                FROM cln_lab_results r
                LEFT JOIN sys_users u ON r.doctor_id = u.id
                WHERE r.clinic_id = ? AND r.id = ?";

        $result = $this->db->fetch($sql, [$clinicId, $resultId]);

        if ($result) {
            $result['items'] = $this->getItemsByResultId($resultId);
        }

        return $result;
    }
}
