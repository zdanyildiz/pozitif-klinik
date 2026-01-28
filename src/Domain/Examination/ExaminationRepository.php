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

    public function findAllByPatient(int $patientId): array
    {
        $stmt = $this->db->getConnection()->prepare("
            SELECT e.*, u.name as doctor_name
            FROM cln_examinations e
            LEFT JOIN sys_users u ON e.doctor_user_id = u.id
            WHERE e.patient_id = :patient_id
            ORDER BY e.created_at DESC
        ");
        $stmt->execute(['patient_id' => $patientId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->getConnection()->prepare("
            SELECT e.*, u.name as doctor_name
            FROM cln_examinations e
            LEFT JOIN sys_users u ON e.doctor_user_id = u.id
            WHERE e.id = :id
        ");
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    public function findByAppointmentId(int $appointmentId): ?array
    {
        $stmt = $this->db->getConnection()->prepare("
            SELECT e.*, u.name as doctor_name
            FROM cln_examinations e
            LEFT JOIN sys_users u ON e.doctor_user_id = u.id
            WHERE e.appointment_id = :appointment_id
            LIMIT 1
        ");
        $stmt->execute(['appointment_id' => $appointmentId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    public function create(array $data): int
    {
        $sql = "INSERT INTO cln_examinations (
                    clinic_id, patient_id, doctor_user_id, 
                    anamnez, complaint, story, bulgular, 
                    diagnosis, treatment, result_note, appointment_id
                ) VALUES (
                    :clinic_id, :patient_id, :doctor_user_id, 
                    :anamnez, :complaint, :story, :bulgular, 
                    :diagnosis, :treatment, :result_note, :appointment_id
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
            'appointment_id' => $data['appointment_id'] ?? null
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $sql = "UPDATE cln_examinations SET 
                    anamnez = :anamnez,
                    complaint = :complaint,
                    story = :story,
                    bulgular = :bulgular,
                    diagnosis = :diagnosis,
                    treatment = :treatment,
                    result_note = :result_note
                WHERE id = :id";

        $stmt = $this->db->getConnection()->prepare($sql);
        return $stmt->execute([
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
