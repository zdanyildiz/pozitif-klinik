<?php

declare(strict_types=1);

namespace App\Domain\Appointment;

use App\Core\Database;

class AppointmentRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Yeni randevu türü oluşturur
     */
    public function createType(int $clinicId, array $data): int
    {
        $sql = "INSERT INTO cln_appointment_types (clinic_id, name, color_code, duration_minutes, is_active) 
                VALUES (?, ?, ?, ?, 1)";

        $this->db->query($sql, [
            $clinicId,
            $data['name'],
            $data['color_code'] ?? '#3788d8',
            $data['duration_minutes'] ?? 30
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Randevu türlerini listeler
     */
    public function listTypes(int $clinicId): array
    {
        $sql = "SELECT * FROM cln_appointment_types WHERE clinic_id = ? AND is_active = 1 ORDER BY name ASC";
        return $this->db->fetchAll($sql, [$clinicId]);
    }

    /**
     * Yeni randevu oluşturur
     */
    public function createAppointment(int $clinicId, array $data): int
    {
        $sql = "INSERT INTO cln_appointments (clinic_id, patient_id, doctor_id, type_id, appointment_date, status, notes) 
                VALUES (?, ?, ?, ?, ?, 'pending', ?)";

        $this->db->query($sql, [
            $clinicId,
            $data['patient_id'],
            $data['doctor_id'] ?? null,
            $data['type_id'],
            $data['appointment_date'],
            $data['notes'] ?? null
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Randevu durumunu günceller
     */
    public function updateStatus(int $clinicId, int $appointmentId, string $status): bool
    {
        $sql = "UPDATE cln_appointments SET status = ? WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$status, $clinicId, $appointmentId]);
        return true;
    }

    /**
     * Belirli bir tarihteki randevuları listeler
     */
    public function listDailyAppointments(int $clinicId, string $date): array
    {
        $sql = "SELECT 
                    a.*, 
                    p.name as patient_name, 
                    t.name as type_name, 
                    t.color_code,
                    u.name as doctor_name
                FROM cln_appointments a
                JOIN ptn_cards p ON a.patient_id = p.id
                JOIN cln_appointment_types t ON a.type_id = t.id
                LEFT JOIN sys_users u ON a.doctor_id = u.id
                WHERE a.clinic_id = ? AND DATE(a.appointment_date) = ?
                ORDER BY a.appointment_date ASC";

        return $this->db->fetchAll($sql, [$clinicId, $date]);
    }
}
