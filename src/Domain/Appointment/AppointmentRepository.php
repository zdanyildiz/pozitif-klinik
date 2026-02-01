<?php

declare(strict_types=1);

namespace App\Domain\Appointment;

use App\Core\Database;
use App\Core\Security\CryptoService;
use App\Domain\Activity\ActivityLogger;

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
    private ActivityLogger $logger;

    public function __construct(Database $db, CryptoService $crypto, ActivityLogger $logger)
    {
        $this->db = $db;
        $this->crypto = $crypto;
        $this->logger = $logger;
    }

    // ==========================================
    // RANDEVU VALİDASYON METODLARİ
    // ==========================================

    /**
     * Doktor bazlı randevu çakışmasını kontrol eder
     * 
     * @param int $clinicId Klinik ID
     * @param int|null $doctorId Doktor ID (null ise kontrol atlanır)
     * @param string $appointmentDate Randevu tarihi (YYYY-MM-DD HH:mm:ss)
     * @param int $durationMinutes Randevu süresi (dakika)
     * @param int|null $excludeAppointmentId Güncelleme sırasında mevcut randevuyu hariç tut
     * @return array|null Çakışan randevu bilgisi veya null
     */
    public function hasConflict(
        int $clinicId,
        ?int $doctorId,
        string $appointmentDate,
        int $durationMinutes = 30,
        ?int $excludeAppointmentId = null
    ): ?array {
        // Doktor seçilmediyse çakışma kontrolü yapılmaz
        if (!$doctorId) {
            return null;
        }

        $startTime = new \DateTime($appointmentDate);
        $endTime = (clone $startTime)->modify("+{$durationMinutes} minutes");

        // Aktif statüler (iptal ve gelmedi olanlar hariç)
        $activeStatuses = ['unconfirmed', 'confirmed', 'waiting', 'in_test'];
        $statusPlaceholders = implode(',', array_fill(0, count($activeStatuses), '?'));

        $sql = "SELECT 
                    a.id,
                    a.appointment_date,
                    t.duration_minutes,
                    t.name as type_name,
                    p.name as patient_name_encrypted
                FROM cln_appointments a
                JOIN cln_appointment_types t ON a.type_id = t.id
                JOIN ptn_cards p ON a.patient_id = p.id
                WHERE a.clinic_id = ?
                AND a.doctor_id = ?
                AND a.status IN ($statusPlaceholders)";

        $params = [$clinicId, $doctorId, ...$activeStatuses];

        // Güncelleme sırasında mevcut randevuyu hariç tut
        if ($excludeAppointmentId) {
            $sql .= " AND a.id != ?";
            $params[] = $excludeAppointmentId;
        }

        $appointments = $this->db->fetchAll($sql, $params);

        foreach ($appointments as $existing) {
            $existingStart = new \DateTime($existing['appointment_date']);
            $existingDuration = (int) ($existing['duration_minutes'] ?? 30);
            $existingEnd = (clone $existingStart)->modify("+{$existingDuration} minutes");

            // Çakışma kontrolü: Yeni randevunun başlangıç veya bitişi mevcut randevu aralığında mı?
            // veya mevcut randevunun başlangıç veya bitişi yeni randevu aralığında mı?
            $hasOverlap = (
                ($startTime >= $existingStart && $startTime < $existingEnd) || // Yeni başlangıç mevcut aralıkta
                ($endTime > $existingStart && $endTime <= $existingEnd) ||     // Yeni bitiş mevcut aralıkta
                ($startTime <= $existingStart && $endTime >= $existingEnd)      // Yeni randevu mevcut olanı kapsıyor
            );

            if ($hasOverlap) {
                // Hasta adını çöz
                $patientName = 'Hasta';
                if (!empty($existing['patient_name_encrypted'])) {
                    $decrypted = $this->crypto->decrypt($existing['patient_name_encrypted']);
                    $patientName = $decrypted ?? 'Hasta';
                }

                return [
                    'appointment_id' => $existing['id'],
                    'appointment_date' => $existing['appointment_date'],
                    'type_name' => $existing['type_name'],
                    'patient_name' => $patientName,
                    'existing_time_range' => $existingStart->format('H:i') . ' - ' . $existingEnd->format('H:i')
                ];
            }
        }

        return null;
    }

    /**
     * Klinik çalışma saatlerini getirir
     */
    public function getClinicWorkingHours(int $clinicId): ?array
    {
        $sql = "SELECT working_hours FROM sys_tenants WHERE id = ?";
        $result = $this->db->fetch($sql, [$clinicId]);

        if (!$result || empty($result['working_hours'])) {
            return null;
        }

        return json_decode($result['working_hours'], true);
    }

    /**
     * Randevu saatinin çalışma saatleri içinde olup olmadığını kontrol eder
     * 
     * @param int $clinicId Klinik ID
     * @param string $appointmentDate Randevu tarihi (YYYY-MM-DD HH:mm:ss)
     * @param int $durationMinutes Randevu süresi (dakika)
     * @return array ['valid' => bool, 'message' => string, 'working_hours' => array|null]
     */
    public function validateWorkingHours(int $clinicId, string $appointmentDate, int $durationMinutes = 30): array
    {
        $workingHours = $this->getClinicWorkingHours($clinicId);

        // Çalışma saatleri tanımlanmamışsa, kontrol atlanır (kabul et)
        if (!$workingHours) {
            return ['valid' => true, 'message' => '', 'working_hours' => null];
        }

        $dateTime = new \DateTime($appointmentDate);
        $endTime = (clone $dateTime)->modify("+{$durationMinutes} minutes");

        // Türkçe gün adları (küçük harf)
        $dayNames = [
            0 => 'pazar',
            1 => 'pazartesi',
            2 => 'sali',
            3 => 'carsamba',
            4 => 'persembe',
            5 => 'cuma',
            6 => 'cumartesi'
        ];

        $dayOfWeek = (int) $dateTime->format('w');
        $dayName = $dayNames[$dayOfWeek];

        // Gün için çalışma saati tanımlı mı?
        if (!isset($workingHours[$dayName])) {
            return [
                'valid' => false,
                'message' => 'Bu gün için çalışma saati tanımlanmamış.',
                'working_hours' => $workingHours
            ];
        }

        $daySchedule = $workingHours[$dayName];

        // Gün kapalı mı?
        if (empty($daySchedule['open']) || $daySchedule['open'] === false) {
            $dayNameTr = ucfirst($dayName);
            return [
                'valid' => false,
                'message' => "{$dayNameTr} günü klinik kapalıdır.",
                'working_hours' => $workingHours
            ];
        }

        // Çalışma saatleri kontrolü
        $workStart = $daySchedule['start'] ?? '09:00';
        $workEnd = $daySchedule['end'] ?? '18:00';

        $appointmentTime = $dateTime->format('H:i');
        $appointmentEndTime = $endTime->format('H:i');

        // Randevu başlangıcı çalışma saatinden önce mi?
        if ($appointmentTime < $workStart) {
            return [
                'valid' => false,
                'message' => "Randevu saati çalışma saatlerinden önce. Klinik {$workStart}'de açılıyor.",
                'working_hours' => $workingHours
            ];
        }

        // Randevu bitişi çalışma saatinden sonra mı?
        if ($appointmentEndTime > $workEnd) {
            return [
                'valid' => false,
                'message' => "Randevu bitişi çalışma saatlerini aşıyor. Klinik {$workEnd}'de kapanıyor.",
                'working_hours' => $workingHours
            ];
        }

        return ['valid' => true, 'message' => '', 'working_hours' => $workingHours];
    }

    /**
     * Belirli bir gün için uygun randevu slotlarını hesaplar
     * 
     * @param int $clinicId Klinik ID
     * @param string $date Tarih (YYYY-MM-DD formatında)
     * @param int|null $doctorId Doktor ID (null ise tüm klinik bazlı)
     * @param int $slotDurationMinutes Slot süresi (varsayılan: 30 dakika)
     * @return array ['slots' => array, 'working_hours' => array, 'is_closed' => bool]
     */
    public function getAvailableSlots(
        int $clinicId,
        string $date,
        ?int $doctorId = null,
        int $slotDurationMinutes = 30
    ): array {
        $result = [
            'date' => $date,
            'doctor_id' => $doctorId,
            'slot_duration' => $slotDurationMinutes,
            'is_closed' => false,
            'working_hours' => null,
            'slots' => []
        ];

        // 1. Çalışma saatlerini al
        $workingHours = $this->getClinicWorkingHours($clinicId);

        if (!$workingHours) {
            // Çalışma saatleri tanımlı değilse varsayılan kullan
            $workingHours = [
                'pazartesi' => ['open' => true, 'start' => '09:00', 'end' => '18:00'],
                'sali' => ['open' => true, 'start' => '09:00', 'end' => '18:00'],
                'carsamba' => ['open' => true, 'start' => '09:00', 'end' => '18:00'],
                'persembe' => ['open' => true, 'start' => '09:00', 'end' => '18:00'],
                'cuma' => ['open' => true, 'start' => '09:00', 'end' => '18:00'],
                'cumartesi' => ['open' => false, 'start' => '09:00', 'end' => '14:00'],
                'pazar' => ['open' => false, 'start' => '09:00', 'end' => '18:00']
            ];
        }

        $result['working_hours'] = $workingHours;

        // 2. Hangi gün olduğunu bul
        $dateTime = new \DateTime($date);
        $dayNames = [
            0 => 'pazar',
            1 => 'pazartesi',
            2 => 'sali',
            3 => 'carsamba',
            4 => 'persembe',
            5 => 'cuma',
            6 => 'cumartesi'
        ];
        $dayOfWeek = (int) $dateTime->format('w');
        $dayName = $dayNames[$dayOfWeek];

        // 3. Gün kapalı mı kontrol et
        if (!isset($workingHours[$dayName]) || empty($workingHours[$dayName]['open'])) {
            $result['is_closed'] = true;
            $result['closed_message'] = ucfirst($dayName) . ' günü klinik kapalıdır.';
            return $result;
        }

        $daySchedule = $workingHours[$dayName];
        $workStart = $daySchedule['start'] ?? '09:00';
        $workEnd = $daySchedule['end'] ?? '18:00';

        // 4. O gün için mevcut randevuları al (sadece aktif olanlar)
        $existingAppointments = $this->getDayAppointmentsForSlotCalculation($clinicId, $date, $doctorId);

        // 5. Slotları oluştur
        $slots = [];
        $currentSlot = new \DateTime("{$date} {$workStart}");
        $endTime = new \DateTime("{$date} {$workEnd}");

        while ($currentSlot < $endTime) {
            $slotStart = clone $currentSlot;
            $slotEnd = (clone $slotStart)->modify("+{$slotDurationMinutes} minutes");

            // Slot bitiş saati çalışma saatini aşıyorsa durma
            if ($slotEnd > $endTime) {
                break;
            }

            $slotStartStr = $slotStart->format('H:i');
            $slotEndStr = $slotEnd->format('H:i');

            // Bu slot dolu mu kontrol et
            $isOccupied = false;
            $occupiedBy = null;

            foreach ($existingAppointments as $appointment) {
                $appStart = new \DateTime($appointment['appointment_date']);
                $appDuration = (int) ($appointment['duration_minutes'] ?? 30);
                $appEnd = (clone $appStart)->modify("+{$appDuration} minutes");

                // Çakışma kontrolü
                $hasOverlap = (
                    ($slotStart >= $appStart && $slotStart < $appEnd) ||
                    ($slotEnd > $appStart && $slotEnd <= $appEnd) ||
                    ($slotStart <= $appStart && $slotEnd >= $appEnd)
                );

                if ($hasOverlap) {
                    $isOccupied = true;
                    // Hasta adını çöz
                    $patientName = 'Dolu';
                    if (!empty($appointment['patient_name_encrypted'])) {
                        $decrypted = $this->crypto->decrypt($appointment['patient_name_encrypted']);
                        $patientName = $decrypted ?? 'Dolu';
                    }
                    $occupiedBy = [
                        'patient_name' => $patientName,
                        'type_name' => $appointment['type_name'] ?? 'Randevu',
                        'time_range' => $appStart->format('H:i') . ' - ' . $appEnd->format('H:i')
                    ];
                    break;
                }
            }

            $slots[] = [
                'time' => $slotStartStr,
                'end_time' => $slotEndStr,
                'datetime' => "{$date} {$slotStartStr}:00",
                'available' => !$isOccupied,
                'occupied_by' => $occupiedBy
            ];

            // Sonraki slot'a geç
            $currentSlot->modify("+{$slotDurationMinutes} minutes");
        }

        $result['slots'] = $slots;
        $result['available_count'] = count(array_filter($slots, fn($s) => $s['available']));
        $result['occupied_count'] = count(array_filter($slots, fn($s) => !$s['available']));

        return $result;
    }

    /**
     * Slot hesaplaması için gün randevularını getirir
     */
    private function getDayAppointmentsForSlotCalculation(int $clinicId, string $date, ?int $doctorId = null): array
    {
        $activeStatuses = ['unconfirmed', 'confirmed', 'waiting', 'in_test'];
        $statusPlaceholders = implode(',', array_fill(0, count($activeStatuses), '?'));

        $sql = "SELECT 
                    a.id,
                    a.appointment_date,
                    a.doctor_id,
                    t.duration_minutes,
                    t.name as type_name,
                    p.name as patient_name_encrypted
                FROM cln_appointments a
                JOIN cln_appointment_types t ON a.type_id = t.id
                JOIN ptn_cards p ON a.patient_id = p.id
                WHERE a.clinic_id = ?
                AND DATE(a.appointment_date) = ?
                AND a.status IN ($statusPlaceholders)";

        $params = [$clinicId, $date, ...$activeStatuses];

        // Doktor filtresi
        if ($doctorId) {
            $sql .= " AND a.doctor_id = ?";
            $params[] = $doctorId;
        }

        $sql .= " ORDER BY a.appointment_date ASC";

        return $this->db->fetchAll($sql, $params);
    }

    // ==========================================
    // RANDEVU TÜRLERİ
    // ==========================================

    public function createType(int $clinicId, array $data): int
    {
        $sql = "INSERT INTO cln_appointment_types (clinic_id, service_id, name, color_code, duration_minutes, default_price, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, 1)";

        $this->db->query($sql, [
            $clinicId,
            $data['service_id'] ?? null,
            $data['name'],
            $data['color_code'] ?? '#3788d8',
            $data['duration_minutes'] ?? 30,
            $data['default_price'] ?? 0.00
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    public function listTypes(int $clinicId): array
    {
        $sql = "SELECT t.*, s.price as service_price, s.tax_rate as service_tax_rate, s.name as service_name
                FROM cln_appointment_types t
                LEFT JOIN cln_services s ON t.service_id = s.id
                WHERE t.clinic_id = ? AND t.is_active = 1 
                ORDER BY t.name ASC";
        return $this->db->fetchAll($sql, [$clinicId]);
    }

    public function findTypeById(int $clinicId, int $typeId): ?array
    {
        $sql = "SELECT t.*, s.price as service_price, s.tax_rate as service_tax_rate, s.name as service_name
                FROM cln_appointment_types t
                LEFT JOIN cln_services s ON t.service_id = s.id
                WHERE t.clinic_id = ? AND t.id = ?";
        return $this->db->fetch($sql, [$clinicId, $typeId]);
    }

    public function updateType(int $clinicId, int $typeId, array $data): bool
    {
        $sql = "UPDATE cln_appointment_types SET 
                    service_id = ?,
                    name = ?,
                    color_code = ?,
                    duration_minutes = ?,
                    default_price = ?
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $data['service_id'] ?? null,
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

    public function listStatuses(): array
    {
        $sql = "SELECT status_code, name, color_code, icon_class FROM sys_appointment_statuses WHERE is_active = 1 ORDER BY sort_order ASC";
        return $this->db->fetchAll($sql);
    }

    // ==========================================
    // RANDEVULAR
    // ==========================================

    public function createAppointment(int $clinicId, array $data, ?int $userId = null): int
    {
        // Boş string değerleri NULL'a çevir
        $doctorId = !empty($data['doctor_id']) ? (int) $data['doctor_id'] : null;

        $status = !empty($data['status']) ? $data['status'] : 'confirmed';

        // 1. Randevuyu oluştur
        $sql = "INSERT INTO cln_appointments (clinic_id, patient_id, doctor_id, type_id, appointment_date, status, notes) 
                VALUES (?, ?, ?, ?, ?, ?, ?)";

        $this->db->query($sql, [
            $clinicId,
            $data['patient_id'],
            $doctorId,
            $data['type_id'],
            $data['appointment_date'],
            $status,
            $data['notes'] ?? null
        ]);

        $appointmentId = (int) $this->db->getConnection()->lastInsertId();

        // Loglama
        $this->logger->log(
            clinicId: $clinicId,
            action: 'APPOINTMENT_CREATE',
            module: 'APPOINTMENT',
            userId: $userId,
            recordId: $appointmentId,
            recordType: 'Appointment',
            newValues: $data,
            description: "Yeni randevu oluşturuldu (Tarih: {$data['appointment_date']})"
        );

        // 2. Eğer randevu türünün bağlı hizmeti veya varsayılan fiyatı varsa, adisyona ilk kalemi ekle
        $type = $this->findTypeById($clinicId, (int) $data['type_id']);
        if ($type) {
            // Öncelik: Kullanıcının girdiği fiyat, sonra bağlı hizmet fiyatı, en son default_price
            $price = 0;
            if (isset($data['type_price']) && is_numeric($data['type_price'])) {
                $price = (float) $data['type_price'];
            } else {
                $price = ($type['service_id'] && $type['service_price'])
                    ? $type['service_price']
                    : $type['default_price'];
            }

            if ($price > 0) {
                $this->addItem($clinicId, $appointmentId, [
                    'service_id' => $type['service_id'] ?? null,
                    'item_name' => $type['name'] . ' (Muayene)',
                    'quantity' => 1,
                    'unit_price' => $price,
                    'total_price' => $price,
                    'performer_id' => $data['doctor_id'] ?? null
                ], $userId);
            }
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
                    u.name as doctor_name,
                    s.name as status_name,
                    s.color_code as status_color,
                    s.icon_class as status_icon
                FROM cln_appointments a
                JOIN ptn_cards p ON a.patient_id = p.id
                JOIN cln_appointment_types t ON a.type_id = t.id
                LEFT JOIN sys_users u ON a.doctor_id = u.id
                LEFT JOIN sys_appointment_statuses s ON a.status = s.status_code
                WHERE a.clinic_id = ? AND a.id = ?";

        $result = $this->db->fetch($sql, [$clinicId, $appointmentId]);

        if (!$result) {
            return null;
        }

        $appointment = $this->decryptAppointmentPatientName($result);

        $appointment['items'] = $this->getItems($clinicId, $appointmentId);

        // Toplam tutarı hesapla
        $appointment['items_subtotal'] = array_reduce($appointment['items'], function ($carry, $item) {
            return $carry + (float) $item['total_price'];
        }, 0);

        $appointment['items_discount_total'] = array_reduce($appointment['items'], function ($carry, $item) {
            return $carry + (float) ($item['discount_amount'] ?? 0);
        }, 0);

        $appointment['general_discount_amount'] = (float) ($appointment['general_discount_amount'] ?? 0);

        // Net Tutar = (Kalemler - Kalem İndirimleri) - Genel İndirim
        $netItemsTotal = $appointment['items_subtotal'] - $appointment['items_discount_total'];
        $appointment['total_amount'] = max(0, $netItemsTotal - $appointment['general_discount_amount']);

        // Ödeme bilgileri
        $paidSql = "SELECT COALESCE(SUM(amount), 0) as total_paid FROM cln_payments WHERE appointment_id = ? AND status = 'completed'";
        $paidResult = $this->db->fetch($paidSql, [$appointmentId]);
        $appointment['total_paid'] = (float) $paidResult['total_paid'];
        $appointment['remaining_amount'] = $appointment['total_amount'] - $appointment['total_paid'];

        return $appointment;
    }

    public function updateStatus(int $clinicId, int $appointmentId, string $status, ?int $userId = null): bool
    {
        $oldAppointment = $this->findById($clinicId, $appointmentId);

        $sql = "UPDATE cln_appointments SET status = ? WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$status, $clinicId, $appointmentId]);

        if ($oldAppointment) {
            $this->logger->log(
                clinicId: $clinicId,
                action: 'APPOINTMENT_STATUS_UPDATE',
                module: 'APPOINTMENT',
                userId: $userId,
                recordId: $appointmentId,
                recordType: 'Appointment',
                oldValues: ['status' => $oldAppointment['status']],
                newValues: ['status' => $status],
                description: "Randevu durumu '{$oldAppointment['status']}' -> '{$status}' olarak değiştirildi."
            );
        }

        return true;
    }

    public function updateAppointment(int $clinicId, int $appointmentId, array $data): bool
    {
        // Boş string değerleri NULL'a çevir
        $doctorId = !empty($data['doctor_id']) ? (int) $data['doctor_id'] : null;

        $sql = "UPDATE cln_appointments SET 
                    doctor_id = ?,
                    type_id = ?,
                    appointment_date = ?,
                    status = ?,
                    notes = ?
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $doctorId,
            $data['type_id'],
            $data['appointment_date'],
            $data['status'] ?? 'confirmed',
            $data['notes'] ?? null,
            $clinicId,
            $appointmentId
        ]);

        return true;
    }

    public function deleteAppointment(int $clinicId, int $appointmentId, ?int $userId = null): bool
    {
        $oldAppointment = $this->findById($clinicId, $appointmentId);

        $sql = "DELETE FROM cln_appointments WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $appointmentId]);

        if ($oldAppointment) {
            $this->logger->log(
                clinicId: $clinicId,
                action: 'APPOINTMENT_DELETE',
                module: 'APPOINTMENT',
                userId: $userId,
                recordId: $appointmentId,
                recordType: 'Appointment',
                oldValues: $oldAppointment,
                description: "Randevu silindi (Tarih: {$oldAppointment['appointment_date']})"
            );
        }

        return true;
    }

    public function listDailyAppointments(int $clinicId, string $date): array
    {
        $sql = "SELECT 
                    a.*, 
                    p.name as patient_name_encrypted, 
                    t.name as type_name, 
                    t.color_code,
                    u.name as doctor_name,
                    s.name as status_name,
                    s.color_code as status_color,
                    s.icon_class as status_icon
                FROM cln_appointments a
                JOIN ptn_cards p ON a.patient_id = p.id
                JOIN cln_appointment_types t ON a.type_id = t.id
                LEFT JOIN sys_users u ON a.doctor_id = u.id
                LEFT JOIN sys_appointment_statuses s ON a.status = s.status_code
                WHERE a.clinic_id = ? AND DATE(a.appointment_date) = ?
                ORDER BY a.appointment_date ASC";

        $results = $this->db->fetchAll($sql, [$clinicId, $date]);

        return array_map([$this, 'decryptAppointmentPatientName'], $results);
    }

    public function listAppointmentsByRange(int $clinicId, string $startDate, string $endDate): array
    {
        $sql = "SELECT 
                    a.*, 
                    p.name as patient_name_encrypted, 
                    t.name as type_name, 
                    t.color_code,
                    u.name as doctor_name,
                    s.name as status_name,
                    s.color_code as status_color,
                    s.icon_class as status_icon
                FROM cln_appointments a
                JOIN ptn_cards p ON a.patient_id = p.id
                JOIN cln_appointment_types t ON a.type_id = t.id
                LEFT JOIN sys_users u ON a.doctor_id = u.id
                LEFT JOIN sys_appointment_statuses s ON a.status = s.status_code
                WHERE a.clinic_id = ? AND DATE(a.appointment_date) BETWEEN ? AND ?
                ORDER BY a.appointment_date ASC";

        $results = $this->db->fetchAll($sql, [$clinicId, $startDate, $endDate]);

        return array_map([$this, 'decryptAppointmentPatientName'], $results);
    }

    public function findAllByPatient(int $clinicId, int $patientId): array
    {
        $sql = "SELECT 
                    a.*, 
                    t.name as type_name, 
                    t.color_code,
                    u.name as doctor_name,
                    s.name as status_name,
                    s.color_code as status_color,
                    s.icon_class as status_icon
                FROM cln_appointments a
                JOIN cln_appointment_types t ON a.type_id = t.id
                LEFT JOIN sys_users u ON a.doctor_id = u.id
                LEFT JOIN sys_appointment_statuses s ON a.status = s.status_code
                WHERE a.clinic_id = ? AND a.patient_id = ?
                ORDER BY a.appointment_date DESC";

        $results = $this->db->fetchAll($sql, [$clinicId, $patientId]);

        // Patient information is known, so we don't strictly need to decrypt patient name here, 
        // but to keep structure consistent if we used the decryption helper, it expects 'patient_name_encrypted'.
        // However, here we don't join patient table again for name since we query by patient_id.
        return $results;
    }

    public function getPatientTotalDebt(int $clinicId, int $patientId): float
    {
        // 1. Kalemler Toplamı (İndirimler düşülmüş)
        $sqlItems = "SELECT COALESCE(SUM(unit_price * quantity - COALESCE(discount_amount, 0)), 0) as total
                     FROM cln_appointment_items i
                     JOIN cln_appointments a ON i.appointment_id = a.id
                     WHERE i.clinic_id = ? AND a.patient_id = ?";

        // 2. Genel İndirimler Toplamı
        $sqlDiscount = "SELECT COALESCE(SUM(general_discount_amount), 0) as total
                        FROM cln_appointments
                        WHERE clinic_id = ? AND patient_id = ?";

        $itemsTotal = (float) ($this->db->fetch($sqlItems, [$clinicId, $patientId])['total'] ?? 0);
        $discountTotal = (float) ($this->db->fetch($sqlDiscount, [$clinicId, $patientId])['total'] ?? 0);

        return max(0, $itemsTotal - $discountTotal);
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
                       AND status IN ('unconfirmed', 'confirmed', 'waiting', 'in_test')";
        $resPending = $this->db->fetch($sqlPending, [$clinicId, $date]);
        $pendingCount = (int) ($resPending['count'] ?? 0);

        return [
            'today' => $todayCount,
            'pending' => $pendingCount
        ];
    }

    public function getDashboardStats(int $clinicId): array
    {
        $date = date('Y-m-d');

        // 1. Günlük İstatistikler
        $sqlStats = "SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'unconfirmed' THEN 1 ELSE 0 END) as unconfirmed,
            SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
            FROM cln_appointments 
            WHERE clinic_id = ? AND DATE(appointment_date) = ?";

        $stats = $this->db->fetch($sqlStats, [$clinicId, $date]);

        // 2. Sıradaki Randevu (Şu andan sonraki ilk randevu)
        $now = date('Y-m-d H:i:s');
        $sqlNext = "SELECT a.*, p.name as patient_name_encrypted, t.name as type_name
                    FROM cln_appointments a
                    JOIN ptn_cards p ON a.patient_id = p.id
                    JOIN cln_appointment_types t ON a.type_id = t.id
                    WHERE a.clinic_id = ? 
                    AND a.appointment_date >= ? 
                    AND a.status NOT IN ('cancelled', 'completed')
                    ORDER BY a.appointment_date ASC 
                    LIMIT 1";

        $nextAppointment = $this->db->fetch($sqlNext, [$clinicId, $now]);

        if ($nextAppointment) {
            $nextAppointment = $this->decryptAppointmentPatientName($nextAppointment);
        }

        return [
            'stats' => $stats,
            'next_appointment' => $nextAppointment
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

    public function addItem(int $clinicId, int $appointmentId, array $data, ?int $userId = null): int
    {
        $sql = "INSERT INTO cln_appointment_items (
                    clinic_id, appointment_id, service_id, item_name, 
                    quantity, unit_price, total_price, performer_id, discount_amount, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $this->db->query($sql, [
            $clinicId,
            $appointmentId,
            $data['service_id'] ?? null,
            $data['item_name'],
            $data['quantity'] ?? 1,
            $data['unit_price'],
            $data['total_price'],
            $data['performer_id'] ?? null,
            $data['discount_amount'] ?? 0.00,
            $data['description'] ?? null
        ]);

        $itemId = (int) $this->db->getConnection()->lastInsertId();

        $this->logger->log(
            clinicId: $clinicId,
            action: 'APPOINTMENT_ITEM_ADD',
            module: 'FINANCE',
            userId: $userId,
            recordId: $appointmentId,
            recordType: 'AppointmentItem',
            newValues: $data,
            description: "Randevuya '{$data['item_name']}' kalemi eklendi. Tutar: {$data['total_price']}"
        );

        return $itemId;
    }

    public function updateItem(int $clinicId, int $appointmentId, int $itemId, array $data, ?int $userId = null): bool
    {
        $sql = "UPDATE cln_appointment_items SET 
                    item_name = ?, quantity = ?, unit_price = ?, total_price = ?, discount_amount = ?, description = ?
                WHERE clinic_id = ? AND appointment_id = ? AND id = ?";

        $this->db->query($sql, [
            $data['item_name'],
            $data['quantity'],
            $data['unit_price'],
            $data['total_price'],
            $data['discount_amount'] ?? 0.00,
            $data['description'] ?? null,
            $clinicId,
            $appointmentId,
            $itemId
        ]);

        $this->logger->log(
            clinicId: $clinicId,
            action: 'APPOINTMENT_ITEM_UPDATE',
            module: 'FINANCE',
            userId: $userId,
            recordId: $appointmentId,
            recordType: 'AppointmentItem',
            newValues: $data,
            description: "Randevu kalemi güncellendi (#{$itemId})"
        );

        return true;
    }

    public function updateGeneralDiscount(int $clinicId, int $appointmentId, float $amount, ?string $note, ?int $userId = null): bool
    {
        $sql = "UPDATE cln_appointments SET general_discount_amount = ?, general_discount_note = ? 
                WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$amount, $note, $clinicId, $appointmentId]);

        $this->logger->log(
            clinicId: $clinicId,
            action: 'APPOINTMENT_DISCOUNT_UPDATE',
            module: 'FINANCE',
            userId: $userId,
            recordId: $appointmentId,
            recordType: 'Appointment',
            newValues: ['amount' => $amount, 'note' => $note],
            description: "Randevu genel indirimi güncellendi: {$amount} TL"
        );

        return true;
    }

    public function removeItem(int $clinicId, int $appointmentId, int $itemId, ?int $userId = null): bool
    {
        // Silinen kalemi bul (Log için)
        // Burada basit bir SELECT yapılabilir veya loga sadece ID yazılabilir.
        // Hızlı olması için detaylı select yapmıyorum, sadece siliyoruz.
        $sql = "DELETE FROM cln_appointment_items WHERE clinic_id = ? AND appointment_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $appointmentId, $itemId]);

        $this->logger->log(
            clinicId: $clinicId,
            action: 'APPOINTMENT_ITEM_REMOVE',
            module: 'FINANCE',
            userId: $userId,
            recordId: $appointmentId,
            recordType: 'AppointmentItem',
            oldValues: ['id' => $itemId],
            description: "Randevudan #{$itemId} nolu kalem silindi."
        );

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
