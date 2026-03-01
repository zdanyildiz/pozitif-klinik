<?php

declare(strict_types=1);

namespace App\Domain\Examination;

use App\Core\Database;
use App\Core\Security\CryptoService;
use PDO;

class ExaminationRepository
{
    private Database $db;
    private CryptoService $crypto;

    public function __construct(Database $db, CryptoService $crypto)
    {
        $this->db = $db;
        $this->crypto = $crypto;
    }

    public function findAllByPatient(int $clinicId, int $patientId): array
    {
        $sql = "
            (
                SELECT 
                    e.id, 
                    e.clinic_id, e.patient_id, e.doctor_user_id,
                    e.anamnez, e.complaint, e.story, e.bulgular, e.diagnosis, e.treatment, e.result_note,
                    e.lab_result_text,
                    e.appointment_id, e.specialty_code, e.specialty_data,
                    e.created_at,
                    u.name as doctor_name
                FROM cln_examinations e
                LEFT JOIN sys_users u ON e.doctor_user_id = u.id
                WHERE e.clinic_id = :cid1 AND e.patient_id = :pid1
            )
            UNION ALL
            (
                SELECT 
                    (CAST(a.id AS SIGNED) * -1) as id,
                    a.clinic_id, a.patient_id, 
                    NULL as doctor_user_id,
                    NULL as anamnez, 
                    NULL as complaint, 
                    NULL as story, 
                    NULL as bulgular,
                    'Randevu (Detay Girilmedi)' as diagnosis,
                    NULL as treatment, 
                    NULL as result_note,
                    NULL as lab_result_text,
                    a.id as appointment_id,
                    NULL as specialty_code, 
                    NULL as specialty_data,
                    a.appointment_date as created_at,
                    u.name as doctor_name
                FROM cln_appointments a
                LEFT JOIN sys_users u ON a.doctor_id = u.id
                WHERE a.clinic_id = :cid2 
                  AND a.patient_id = :pid2
                  AND (a.status != 'cancelled' OR a.status IS NULL)
                  AND a.id NOT IN (
                      SELECT appointment_id FROM cln_examinations 
                      WHERE patient_id = :pid3 AND appointment_id IS NOT NULL
                  )
            )
            ORDER BY created_at DESC
            LIMIT 50
        ";

        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->execute([
            'cid1' => $clinicId,
            'pid1' => $patientId,
            'cid2' => $clinicId,
            'pid2' => $patientId,
            'pid3' => $patientId
        ]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return array_map([$this, 'decryptExaminationData'], $results);
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
        return $result ? $this->decryptExaminationData($result) : null;
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
        return $result ? $this->decryptExaminationData($result) : null;
    }

    public function create(array $data): int
    {
        $sql = "INSERT INTO cln_examinations (
                    clinic_id, patient_id, doctor_user_id, 
                    complaint, story, bulgular, 
                    diagnosis, treatment, result_note, lab_result_text, appointment_id,
                    specialty_code, specialty_data
                ) VALUES (
                    :clinic_id, :patient_id, :doctor_user_id, 
                    :complaint, :story, :bulgular, 
                    :diagnosis, :treatment, :result_note, :lab_result_text, :appointment_id,
                    :specialty_code, :specialty_data
                )";

        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->execute([
            'clinic_id' => $data['clinic_id'],
            'patient_id' => $data['patient_id'],
            'doctor_user_id' => $data['doctor_user_id'],
            'complaint' => $this->crypto->encryptSafe($data['complaint'] ?? null),
            'story' => $this->crypto->encryptSafe($data['anamnez'] ?? $data['story'] ?? null),
            'bulgular' => $this->crypto->encryptSafe($data['bulgular'] ?? null),
            'diagnosis' => $this->crypto->encryptSafe($data['diagnosis'] ?? null),
            'treatment' => $this->crypto->encryptSafe($data['treatment'] ?? null),
            'result_note' => $this->crypto->encryptSafe($data['result_note'] ?? null),
            'lab_result_text' => $this->crypto->encryptSafe($data['lab_result_text'] ?? null),
            'appointment_id' => $data['appointment_id'] ?? null,
            'specialty_code' => $data['specialty_code'] ?? null,
            'specialty_data' => $this->crypto->encryptSafe(is_array($data['specialty_data'] ?? null) ? json_encode($data['specialty_data']) : ($data['specialty_data'] ?? null))
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    public function update(int $clinicId, int $id, array $data): bool
    {
        $sql = "UPDATE cln_examinations SET 
                    complaint = :complaint,
                    story = :story,
                    bulgular = :bulgular,
                    diagnosis = :diagnosis,
                    treatment = :treatment,
                    result_note = :result_note,
                    lab_result_text = :lab_result_text,
                    specialty_code = :specialty_code,
                    specialty_data = :specialty_data
                WHERE clinic_id = :clinic_id AND id = :id";

        $stmt = $this->db->getConnection()->prepare($sql);
        return $stmt->execute([
            'clinic_id' => $clinicId,
            'id' => $id,
            'complaint' => $this->crypto->encryptSafe($data['complaint'] ?? null),
            'story' => $this->crypto->encryptSafe($data['anamnez'] ?? $data['story'] ?? null),
            'bulgular' => $this->crypto->encryptSafe($data['bulgular'] ?? null),
            'diagnosis' => $this->crypto->encryptSafe($data['diagnosis'] ?? null),
            'treatment' => $this->crypto->encryptSafe($data['treatment'] ?? null),
            'result_note' => $this->crypto->encryptSafe($data['result_note'] ?? null),
            'lab_result_text' => $this->crypto->encryptSafe($data['lab_result_text'] ?? null),
            'specialty_code' => $data['specialty_code'] ?? null,
            'specialty_data' => $this->crypto->encryptSafe(is_array($data['specialty_data'] ?? null) ? json_encode($data['specialty_data']) : ($data['specialty_data'] ?? null))
        ]);
    }

    /**
     * Muayene verilerini çözer
     */
    private function decryptExaminationData(array $exam): array
    {
        $fields = [
            'anamnez',
            'complaint',
            'story',
            'bulgular',
            'diagnosis',
            'treatment',
            'result_note',
            'lab_result_text',
            'specialty_data'
        ];

        foreach ($fields as $field) {
            if (!empty($exam[$field])) {
                $decrypted = $this->crypto->decrypt($exam[$field]);
                $exam[$field] = $decrypted ?? $exam[$field];

                // specialty_data ise ve deşifre edildiyse, diziye çevir
                if ($field === 'specialty_data' && !empty($exam[$field])) {
                    $decoded = json_decode((string) $exam[$field], true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        $exam[$field] = $decoded;
                    }
                }
            }
        }

        return $exam;
    }
}
