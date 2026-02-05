<?php

declare(strict_types=1);

namespace App\Domain\Examination;

use App\Core\Database;
use PDO;

class ExaminationRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    public function findAllByPatient(int $clinicId, int $patientId): array
    {
        $stmt = $this->db->getConnection()->prepare("
            SELECT e.*, u.name as doctor_name
            FROM cln_examinations e
            LEFT JOIN sys_users u ON e.doctor_user_id = u.id
            WHERE e.clinic_id = :clinic_id AND e.patient_id = :patient_id
            ORDER BY e.created_at DESC
        ");
        $stmt->execute([
            'clinic_id' => $clinicId,
            'patient_id' => $patientId
        ]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findById(int $clinicId, int $id): ?array
    {
        $stmt = $this->db->getConnection()->prepare("
            SELECT e.*, u.name as doctor_name
            FROM cln_examinations e
            LEFT JOIN sys_users u ON e.doctor_user_id = u.id
            WHERE e.clinic_id = :clinic_id AND e.id = :id
        ");
        $stmt->execute([
            'clinic_id' => $clinicId,
            'id' => $id
        ]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    public function findByAppointmentId(int $clinicId, int $appointmentId): ?array
    {
        $stmt = $this->db->getConnection()->prepare("
            SELECT e.*, u.name as doctor_name
            FROM cln_examinations e
            LEFT JOIN sys_users u ON e.doctor_user_id = u.id
            WHERE e.clinic_id = :clinic_id AND e.appointment_id = :appointment_id
            ORDER BY e.id DESC
            LIMIT 1
        ");
        $stmt->execute([
            'clinic_id' => $clinicId,
            'appointment_id' => $appointmentId
        ]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    public function create(array $data): int
    {
        $sql = "INSERT INTO cln_examinations (
                    clinic_id, patient_id, doctor_user_id, 
                    anamnez, complaint, story, bulgular, 
                    diagnosis, treatment, result_note, appointment_id,
                    specialty_code, specialty_data
                ) VALUES (
                    :clinic_id, :patient_id, :doctor_user_id, 
                    :anamnez, :complaint, :story, :bulgular, 
                    :diagnosis, :treatment, :result_note, :appointment_id,
                    :specialty_code, :specialty_data
                )";

        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->execute([
            'clinic_id' => $data['clinic_id'],
            'patient_id' => $data['patient_id'],
            'doctor_user_id' => $data['doctor_user_id'],
            'anamnez' => $data['anamnez'] ?? null,
            'complaint' => $data['complaint'] ?? null,
            'story' => $data['story'] ?? null,
            'bulgular' => $data['bulgular'] ?? null,
            'diagnosis' => $data['diagnosis'] ?? null,
            'treatment' => $data['treatment'] ?? null,
            'result_note' => $data['result_note'] ?? null,
            'appointment_id' => $data['appointment_id'] ?? null,
            'specialty_code' => $data['specialty_code'] ?? null,
            'specialty_data' => $data['specialty_data'] ?? null
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    public function update(int $clinicId, int $id, array $data): bool
    {
        $sql = "UPDATE cln_examinations SET 
                    anamnez = :anamnez,
                    complaint = :complaint,
                    story = :story,
                    bulgular = :bulgular,
                    diagnosis = :diagnosis,
                    treatment = :treatment,
                    result_note = :result_note
                WHERE clinic_id = :clinic_id AND id = :id";

        $stmt = $this->db->getConnection()->prepare($sql);
        return $stmt->execute([
            'clinic_id' => $clinicId,
            'id' => $id,
            'anamnez' => $data['anamnez'] ?? null,
            'complaint' => $data['complaint'] ?? null,
            'story' => $data['story'] ?? null,
            'bulgular' => $data['bulgular'] ?? null,
            'diagnosis' => $data['diagnosis'] ?? null,
            'treatment' => $data['treatment'] ?? null,
            'result_note' => $data['result_note'] ?? null
        ]);
    }
}
