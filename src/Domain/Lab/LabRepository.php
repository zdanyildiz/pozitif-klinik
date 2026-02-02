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
    /**
     * Yeni laboratuvar sonucu başlığı oluşturur
     */
    public function createResult(array $data): int
    {
        $sql = "INSERT INTO cln_lab_results (clinic_id, patient_id, appointment_id, doctor_id, result_date, created_at)
                VALUES (:clinic_id, :patient_id, :appointment_id, :doctor_id, :result_date, NOW())";

        $this->db->query($sql, [
            'clinic_id' => $data['clinic_id'],
            'patient_id' => $data['patient_id'],
            'appointment_id' => $data['appointment_id'] ?? null,
            'doctor_id' => $data['doctor_id'],
            'result_date' => $data['result_date']
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Sonuç kalemini (Test Satırı) ekler
     */
    public function createResultItem(int $resultId, array $item): bool
    {
        $sql = "INSERT INTO cln_lab_result_items (result_id, test_name, result_value, unit, reference_range, is_abnormal)
                VALUES (:result_id, :test_name, :result_value, :unit, :reference_range, :is_abnormal)";

        $stmt = $this->db->query($sql, [
            'result_id' => $resultId,
            'test_name' => $item['test_name'],
            'result_value' => $item['result_value'],
            'unit' => $item['unit'] ?? null,
            'reference_range' => $item['reference_range'] ?? null,
            'is_abnormal' => !empty($item['is_abnormal']) ? 1 : 0
        ]);

        return $stmt->rowCount() > 0;
    }

    /**
     * İşlem (Transaction) bazlı tam sonuç kaydı
     */
    public function saveFullResult(array $resultData, array $items): int
    {
        try {
            $this->db->beginTransaction();

            // 1. Ana kaydı oluştur
            $resultId = $this->createResult($resultData);

            // 2. Kalemleri ekle
            foreach ($items as $item) {
                if (empty($item['test_name']) || empty($item['result_value'])) {
                    continue;
                }
                $this->createResultItem($resultId, $item);
            }

            $this->db->commit();
            return $resultId;

        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Sonucu ve bağlı kalemlerini siler
     */
    public function deleteResult(int $clinicId, int $resultId): bool
    {
        // Önce sonuç var mı ve bu kliniğe mi ait kontrol et
        $check = $this->findById($clinicId, $resultId);
        if (!$check) {
            return false;
        }

        // Bağlı kalemleri sil
        $this->db->query("DELETE FROM cln_lab_result_items WHERE result_id = ?", [$resultId]);

        // Ana kaydı sil
        $stmt = $this->db->query("DELETE FROM cln_lab_results WHERE id = ?", [$resultId]);

        return $stmt->rowCount() > 0;
    }
}
