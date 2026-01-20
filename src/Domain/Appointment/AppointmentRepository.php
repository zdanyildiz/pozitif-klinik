<?php

declare(strict_types=1);

namespace App\Domain\Appointment;

use App\Core\Database;
use App\Core\Security\CryptoService;

/**
 * AppointmentRepository - Randevu Veritabanı İşlemleri
 * 
 * Randevu CRUD işlemleri, tür yönetimi ve adisyon (items) yönetimi.
 * Hasta verileri şifrelenmiş olduğundan, listelerken CryptoService ile çözülür.
 * 
 * ⚠️ GÜVENLİK: Tüm sorgular clinic_id filtresi ile çalışır (multi-tenancy)
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

    public function createType(int $clinicId, array $data): int
    {
        $sql = "INSERT INTO cln_appointment_types (clinic_id, name, color_code, duration_minutes, default_price, is_active) 
                VALUES (?, ?, ?, ?, ?, 1)";

        $this->db->query($sql, [
            $clinicId,
            $data['name'],
            $data['color_code'] ?? '#3788d8',
            $data['duration_minutes'] ?? 30,
            $data['default_price'] ?? 0.00
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    public function listTypes(int $clinicId): array
    {
        $sql = "SELECT * FROM cln_appointment_types WHERE clinic_id = ? AND is_active = 1 ORDER BY name ASC";
        return $this->db->fetchAll($sql, [$clinicId]);
    }

    public function findTypeById(int $clinicId, int $typeId): ?array
    {
        $sql = "SELECT * FROM cln_appointment_types WHERE clinic_id = ? AND id = ?";
        return $this->db->fetch($sql, [$clinicId, $typeId]);
    }

    public function updateType(int $clinicId, int $typeId, array $data): bool
    {
        $sql = "UPDATE cln_appointment_types SET 
                    name = ?,
                    color_code = ?,
                    duration_minutes = ?,
                    default_price = ?
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $data['name'],
            $data['color_code'] ?? '#3788d8',
            $data['duration_minutes'] ?? 30,
            $data['default_price'] ?? 0.00,
            $clinicId,
            $typeId
        ]);

        return true;
    }

    public function deleteType(int $clinicId, int $typeId): bool
    {
        $sql = "UPDATE cln_appointment_types SET is_active = 0 WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $typeId]);
        return true;
    }

    // ==========================================
    // RANDEVULAR
    // ==========================================

    public function createAppointment(int $clinicId, array $data): int
    {
        // 1. Randevuyu oluştur
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

        $appointmentId = (int) $this->db->getConnection()->lastInsertId();

        // 2. Eğer randevu türünün varsayılan fiyatı varsa, adisyona ilk kalemi ekle
        $type = $this->findTypeById($clinicId, (int) $data['type_id']);
        if ($type && $type['default_price'] > 0) {
            $this->addItem($clinicId, $appointmentId, [
                'item_name' => $type['name'] . ' (Muayene)',
                'quantity' => 1,
                'unit_price' => $type['default_price'],
                'total_price' => $type['default_price'],
                'performer_id' => $data['doctor_id'] ?? null
            ]);
        }

        return $appointmentId;
    }

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

        $appointment = $this->decryptAppointmentPatientName($result);

        // Randevu kalemlerini (items) getir
        $appointment['items'] = $this->getItems($clinicId, $appointmentId);

        // Toplam tutarı hesapla
        $appointment['total_amount'] = array_reduce($appointment['items'], function ($carry, $item) {
            return $carry + $item['total_price'];
        }, 0);

        return $appointment;
    }

    public function updateStatus(int $clinicId, int $appointmentId, string $status): bool
    {
        $sql = "UPDATE cln_appointments SET status = ? WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$status, $clinicId, $appointmentId]);
        return true;
    }

    public function updateAppointment(int $clinicId, int $appointmentId, array $data): bool
    {
        $sql = "UPDATE cln_appointments SET 
                    doctor_id = ?,
                    type_id = ?,
                    appointment_date = ?,
                    notes = ?
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $data['doctor_id'] ?? null,
            $data['type_id'],
            $data['appointment_date'],
            $data['notes'] ?? null,
            $clinicId,
            $appointmentId
        ]);

        return true;
    }

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

    public function getStats(int $clinicId, string $date): array
    {
        // 1. Bugunkü toplam randevu sayısı
        $sqlToday = "SELECT COUNT(*) as count FROM cln_appointments WHERE clinic_id = ? AND DATE(appointment_date) = ?";
        $resToday = $this->db->fetch($sqlToday, [$clinicId, $date]);
        $todayCount = (int) ($resToday['count'] ?? 0);

        // 2. Bekleyen randevu sayısı (pending, waiting, in_test)
        $sqlPending = "SELECT COUNT(*) as count FROM cln_appointments 
                       WHERE clinic_id = ? AND DATE(appointment_date) = ? 
                       AND status IN ('pending', 'waiting', 'in_test')";
        $resPending = $this->db->fetch($sqlPending, [$clinicId, $date]);
        $pendingCount = (int) ($resPending['count'] ?? 0);

        return [
            'today' => $todayCount,
            'pending' => $pendingCount
        ];
    }

    // ==========================================
    // RANDEVU KALEMLERİ (ADİSYON)
    // ==========================================

    public function getItems(int $clinicId, int $appointmentId): array
    {
        $sql = "SELECT i.*, s.name as service_name, u.name as performer_name
                FROM cln_appointment_items i
                LEFT JOIN cln_services s ON i.service_id = s.id
                LEFT JOIN sys_users u ON i.performer_id = u.id
                WHERE i.clinic_id = ? AND i.appointment_id = ?
                ORDER BY i.id ASC";

        return $this->db->fetchAll($sql, [$clinicId, $appointmentId]);
    }

    public function addItem(int $clinicId, int $appointmentId, array $data): int
    {
        $sql = "INSERT INTO cln_appointment_items (
                    clinic_id, appointment_id, service_id, item_name, 
                    quantity, unit_price, total_price, performer_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        $this->db->query($sql, [
            $clinicId,
            $appointmentId,
            $data['service_id'] ?? null,
            $data['item_name'],
            $data['quantity'] ?? 1,
            $data['unit_price'],
            $data['total_price'],
            $data['performer_id'] ?? null
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    public function removeItem(int $clinicId, int $appointmentId, int $itemId): bool
    {
        $sql = "DELETE FROM cln_appointment_items WHERE clinic_id = ? AND appointment_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $appointmentId, $itemId]);
        return true;
    }

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
