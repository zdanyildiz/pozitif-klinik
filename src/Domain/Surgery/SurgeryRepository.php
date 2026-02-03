<?php

declare(strict_types=1);

namespace App\Domain\Surgery;

use App\Core\Database;
use App\Core\Security\CryptoService;
use App\Domain\Activity\ActivityLogger;

class SurgeryRepository
{
    private Database $db;
    private CryptoService $crypto;
    private ActivityLogger $logger;

    public function __construct(Database $db, CryptoService $crypto, ActivityLogger $logger)
    {
        $this->db = $db;
        $this->crypto = $crypto;
        $this->logger = $logger;
    }

    public function create(int $clinicId, array $data, ?int $userId = null): int
    {
        $sql = "INSERT INTO cln_surgeries (
            clinic_id, patient_id, doctor_id, surgery_date, 
            hospital_name, status, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?)";

        $this->db->query($sql, [
            $clinicId,
            $data['patient_id'],
            $data['doctor_id'],
            $data['surgery_date'],
            $data['hospital_name'] ?? null,
            $data['status'] ?? 'planned',
            $data['description'] ?? null
        ]);

        $id = (int) $this->db->getConnection()->lastInsertId();

        $this->logger->log(
            clinicId: $clinicId,
            action: 'SURGERY_CREATE',
            module: 'SURGERY',
            userId: $userId,
            recordId: $id,
            recordType: 'Surgery',
            newValues: $data,
            description: "Yeni ameliyat planlandı (Tarih: {$data['surgery_date']})"
        );

        return $id;
    }

    public function list(int $clinicId, array $filters = []): array
    {
        $sql = "SELECT 
                    s.*,
                    p.name as patient_name_encrypted,
                    u.name as doctor_name
                FROM cln_surgeries s
                JOIN ptn_cards p ON s.patient_id = p.id
                JOIN sys_users u ON s.doctor_id = u.id
                WHERE s.clinic_id = ?";

        $params = [$clinicId];

        if (!empty($filters['status'])) {
            $sql .= " AND s.status = ?";
            $params[] = $filters['status'];
        }

        if (!empty($filters['doctor_id'])) {
            $sql .= " AND s.doctor_id = ?";
            $params[] = $filters['doctor_id'];
        }

        if (!empty($filters['start_date'])) {
            $sql .= " AND s.surgery_date >= ?";
            $params[] = $filters['start_date'];
        }

        if (!empty($filters['end_date'])) {
            $sql .= " AND s.surgery_date <= ?";
            $params[] = $filters['end_date'];
        }

        $sql .= " ORDER BY s.surgery_date ASC";

        $results = $this->db->fetchAll($sql, $params);

        return array_map(function ($row) {
            if (!empty($row['patient_name_encrypted'])) {
                $row['patient_name'] = $this->crypto->decrypt($row['patient_name_encrypted']) ?? 'Bilinmiyor';
            }
            return $row;
        }, $results);
    }

    public function findById(int $clinicId, int $id): ?array
    {
        $sql = "SELECT 
                    s.*,
                    p.name as patient_name_encrypted,
                    p.tc_no_hash,
                    u.name as doctor_name
                FROM cln_surgeries s
                JOIN ptn_cards p ON s.patient_id = p.id
                JOIN sys_users u ON s.doctor_id = u.id
                WHERE s.clinic_id = ? AND s.id = ?";

        $result = $this->db->fetch($sql, [$clinicId, $id]);

        if (!$result) {
            return null;
        }

        if (!empty($result['patient_name_encrypted'])) {
            $result['patient_name'] = $this->crypto->decrypt($result['patient_name_encrypted']) ?? 'Bilinmiyor';
        }

        return $result;
    }

    public function update(int $clinicId, int $id, array $data, ?int $userId = null): bool
    {
        $oldRecord = $this->findById($clinicId, $id);

        $sql = "UPDATE cln_surgeries SET 
                    patient_id = ?,
                    doctor_id = ?,
                    surgery_date = ?,
                    hospital_name = ?,
                    status = ?,
                    description = ?
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $data['patient_id'],
            $data['doctor_id'],
            $data['surgery_date'],
            $data['hospital_name'] ?? null,
            $data['status'] ?? 'planned',
            $data['description'] ?? null,
            $clinicId,
            $id
        ]);

        $this->logger->log(
            clinicId: $clinicId,
            action: 'SURGERY_UPDATE',
            module: 'SURGERY',
            userId: $userId,
            recordId: $id,
            recordType: 'Surgery',
            oldValues: $oldRecord,
            newValues: $data,
            description: "Ameliyat bilgileri güncellendi"
        );

        return true;
    }

    public function updateStatus(int $clinicId, int $id, string $status, ?int $userId = null): bool
    {
        $oldRecord = $this->findById($clinicId, $id);

        $sql = "UPDATE cln_surgeries SET status = ? WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$status, $clinicId, $id]);

        $this->logger->log(
            clinicId: $clinicId,
            action: 'SURGERY_STATUS_UPDATE',
            module: 'SURGERY',
            userId: $userId,
            recordId: $id,
            recordType: 'Surgery',
            oldValues: ['status' => $oldRecord['status'] ?? null],
            newValues: ['status' => $status],
            description: "Ameliyat durumu değişti: $status"
        );

        return true;
    }

    public function delete(int $clinicId, int $id, ?int $userId = null): bool
    {
        $oldRecord = $this->findById($clinicId, $id);

        $sql = "DELETE FROM cln_surgeries WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $id]);

        $this->logger->log(
            clinicId: $clinicId,
            action: 'SURGERY_DELETE',
            module: 'SURGERY',
            userId: $userId,
            recordId: $id,
            recordType: 'Surgery',
            oldValues: $oldRecord,
            description: "Ameliyat kaydı silindi"
        );

        return true;
    }
}
