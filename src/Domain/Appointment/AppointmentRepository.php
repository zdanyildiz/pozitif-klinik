<?php

declare(strict_types=1);

namespace App\Domain\Appointment;

use App\Core\Database;
use App\Core\Security\CryptoService;

/**
 * AppointmentRepository - Randevu Veritabanı İşlemleri
 * 
 * Randevu CRUD işlemleri ve tür yönetimi.
 * Hasta verileri şifrelenmiş olduğundan, listelerken CryptoService ile çözülür.
 * 
 * ⚠️ GÜVENLİK: Tüm sorgular clinic_id filtresi ile çalışır (multi-tenancy)
 * 
 * @package App\Domain\Appointment
 */
class AppointmentRepository
{
    private Database $db;
    private CryptoService $crypto;

    public function __construct(Database $db, CryptoService $crypto)
    {
        $this->db = $db;
        $this->crypto = $crypto;
    }

    // ==========================================
    // RANDEVU TÜRLERİ
    // ==========================================

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
     * Randevu türünü ID'ye göre getirir
     */
    public function findTypeById(int $clinicId, int $typeId): ?array
    {
        $sql = "SELECT * FROM cln_appointment_types WHERE clinic_id = ? AND id = ?";
        $result = $this->db->fetch($sql, [$clinicId, $typeId]);
        return $result ?: null;
    }

    /**
     * Randevu türünü günceller
     */
    public function updateType(int $clinicId, int $typeId, array $data): bool
    {
        $sql = "UPDATE cln_appointment_types SET 
                    name = ?,
                    color_code = ?,
                    duration_minutes = ?
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $data['name'],
            $data['color_code'] ?? '#3788d8',
            $data['duration_minutes'] ?? 30,
            $clinicId,
            $typeId
        ]);

        return true;
    }

    /**
     * Randevu türünü pasif yapar (soft delete)
     */
    public function deleteType(int $clinicId, int $typeId): bool
    {
        $sql = "UPDATE cln_appointment_types SET is_active = 0 WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $typeId]);
        return true;
    }

    // ==========================================
    // RANDEVULAR
    // ==========================================

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
     * Randevuyu günceller
     */
    public function updateAppointment(int $clinicId, int $appointmentId, array $data): bool
    {
        $sql = "UPDATE cln_appointments SET 
                    patient_id = ?,
                    doctor_id = ?,
                    type_id = ?,
                    appointment_date = ?,
                    notes = ?
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $data['patient_id'],
            $data['doctor_id'] ?? null,
            $data['type_id'],
            $data['appointment_date'],
            $data['notes'] ?? null,
            $clinicId,
            $appointmentId
        ]);

        return true;
    }

    /**
     * Randevuyu siler
     */
    public function deleteAppointment(int $clinicId, int $appointmentId): bool
    {
        $sql = "DELETE FROM cln_appointments WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $appointmentId]);
        return true;
    }

    /**
     * Randevuyu ID'ye göre getirir
     * Hasta adı şifreli olduğundan decrypt edilir.
     */
    public function findById(int $clinicId, int $appointmentId): ?array
    {
        $sql = "SELECT 
                    a.*, 
                    p.name as patient_name_encrypted, 
                    t.name as type_name, 
                    t.color_code,
                    u.name as doctor_name
                FROM cln_appointments a
                JOIN ptn_cards p ON a.patient_id = p.id
                JOIN cln_appointment_types t ON a.type_id = t.id
                LEFT JOIN sys_users u ON a.doctor_id = u.id
                WHERE a.clinic_id = ? AND a.id = ?";

        $result = $this->db->fetch($sql, [$clinicId, $appointmentId]);

        if (!$result) {
            return null;
        }

        return $this->decryptAppointmentPatientName($result);
    }

    /**
     * Belirli bir tarihteki randevuları listeler
     * Hasta adları şifreli saklandığından decrypt edilir.
     */
    public function listDailyAppointments(int $clinicId, string $date): array
    {
        $sql = "SELECT 
                    a.*, 
                    p.name as patient_name_encrypted, 
                    t.name as type_name, 
                    t.color_code,
                    u.name as doctor_name
                FROM cln_appointments a
                JOIN ptn_cards p ON a.patient_id = p.id
                JOIN cln_appointment_types t ON a.type_id = t.id
                LEFT JOIN sys_users u ON a.doctor_id = u.id
                WHERE a.clinic_id = ? AND DATE(a.appointment_date) = ?
                ORDER BY a.appointment_date ASC";

        $results = $this->db->fetchAll($sql, [$clinicId, $date]);

        return array_map([$this, 'decryptAppointmentPatientName'], $results);
    }

    /**
     * Belirli bir tarih aralığındaki randevuları listeler
     */
    public function listAppointmentsByDateRange(int $clinicId, string $startDate, string $endDate): array
    {
        $sql = "SELECT 
                    a.*, 
                    p.name as patient_name_encrypted, 
                    t.name as type_name, 
                    t.color_code,
                    u.name as doctor_name
                FROM cln_appointments a
                JOIN ptn_cards p ON a.patient_id = p.id
                JOIN cln_appointment_types t ON a.type_id = t.id
                LEFT JOIN sys_users u ON a.doctor_id = u.id
                WHERE a.clinic_id = ? AND DATE(a.appointment_date) BETWEEN ? AND ?
                ORDER BY a.appointment_date ASC";

        $results = $this->db->fetchAll($sql, [$clinicId, $startDate, $endDate]);

        return array_map([$this, 'decryptAppointmentPatientName'], $results);
    }

    /**
     * Hastanın randevularını listeler
     */
    public function listPatientAppointments(int $clinicId, int $patientId): array
    {
        $sql = "SELECT 
                    a.*, 
                    t.name as type_name, 
                    t.color_code,
                    u.name as doctor_name
                FROM cln_appointments a
                JOIN cln_appointment_types t ON a.type_id = t.id
                LEFT JOIN sys_users u ON a.doctor_id = u.id
                WHERE a.clinic_id = ? AND a.patient_id = ?
                ORDER BY a.appointment_date DESC";

        return $this->db->fetchAll($sql, [$clinicId, $patientId]);
    }

    /**
     * Bugünkü randevu sayısını getirir (Dashboard için)
     */
    public function countTodayAppointments(int $clinicId): int
    {
        $sql = "SELECT COUNT(*) as total FROM cln_appointments 
                WHERE clinic_id = ? AND DATE(appointment_date) = CURDATE()";
        $result = $this->db->fetch($sql, [$clinicId]);

        return (int) ($result['total'] ?? 0);
    }

    /**
     * Bekleyen randevu sayısını getirir
     */
    public function countPendingAppointments(int $clinicId): int
    {
        $sql = "SELECT COUNT(*) as total FROM cln_appointments 
                WHERE clinic_id = ? AND status IN ('pending', 'confirmed', 'waiting')";
        $result = $this->db->fetch($sql, [$clinicId]);

        return (int) ($result['total'] ?? 0);
    }

    /**
     * Doktorun belirli bir tarihteki randevularını listeler
     */
    public function listDoctorAppointments(int $clinicId, int $doctorId, string $date): array
    {
        $sql = "SELECT 
                    a.*, 
                    p.name as patient_name_encrypted, 
                    t.name as type_name, 
                    t.color_code
                FROM cln_appointments a
                JOIN ptn_cards p ON a.patient_id = p.id
                JOIN cln_appointment_types t ON a.type_id = t.id
                WHERE a.clinic_id = ? AND a.doctor_id = ? AND DATE(a.appointment_date) = ?
                ORDER BY a.appointment_date ASC";

        $results = $this->db->fetchAll($sql, [$clinicId, $doctorId, $date]);

        return array_map([$this, 'decryptAppointmentPatientName'], $results);
    }

    /**
     * Randevu çakışması kontrolü
     */
    public function checkConflict(int $clinicId, string $appointmentDate, ?int $doctorId = null, ?int $excludeId = null): bool
    {
        // Eğer doktor belirtilmemişse çakışma kontrolü yapmıyoruz
        if ($doctorId === null) {
            return false;
        }

        $sql = "SELECT COUNT(*) as total FROM cln_appointments 
                WHERE clinic_id = ? 
                AND doctor_id = ? 
                AND appointment_date = ?
                AND status NOT IN ('cancelled', 'no_show')";

        $params = [$clinicId, $doctorId, $appointmentDate];

        if ($excludeId !== null) {
            $sql .= " AND id != ?";
            $params[] = $excludeId;
        }

        $result = $this->db->fetch($sql, $params);

        return (int) ($result['total'] ?? 0) > 0;
    }

    /**
     * Randevu kaydındaki şifreli hasta adını çözer
     */
    private function decryptAppointmentPatientName(array $appointment): array
    {
        if (!empty($appointment['patient_name_encrypted'])) {
            $decrypted = $this->crypto->decrypt($appointment['patient_name_encrypted']);
            $appointment['patient_name'] = $decrypted ?? 'Bilinmeyen';
            unset($appointment['patient_name_encrypted']);
        }

        return $appointment;
    }
}
