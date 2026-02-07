<?php

declare(strict_types=1);

namespace App\Domain\Finance;

use App\Core\Database;
use App\Core\Security\CryptoService;

class PaymentRepository
{
    private Database $db;
    private CryptoService $crypto;

    public function __construct(Database $db, CryptoService $crypto)
    {
        $this->db = $db;
        $this->crypto = $crypto;
    }

    /**
     * Yeni ödeme kaydı oluşturur.
     */
    public function create(int $clinicId, array $data): int
    {
        $sql = "INSERT INTO cln_payments (
                    clinic_id, patient_id, appointment_id, payment_type, 
                    amount, currency, payment_date, notes, status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $this->db->query($sql, [
            $clinicId,
            $data['patient_id'],
            $data['appointment_id'] ?? null,
            $data['payment_type'],
            $data['amount'],
            $data['currency'] ?? 'TRY',
            $data['payment_date'] ?? date('Y-m-d H:i:s'),
            $data['notes'] ?? null,
            $data['status'] ?? 'completed',
            $data['created_by'] ?? null
        ]);

        $paymentId = (int) $this->db->getConnection()->lastInsertId();

        if (!empty($data['appointment_id'])) {
            $this->updateAppointmentPaymentStatus((int) $data['appointment_id']);
        }

        return $paymentId;
    }

    /**
     * Parçalı ödeme (Split Payment) kaydeder.
     */
    public function createMultiple(int $clinicId, array $payments, int $createdBy): array
    {
        $ids = [];
        $appointmentIdsToUpdate = [];

        foreach ($payments as $payment) {
            $payment['created_by'] = $createdBy;
            $ids[] = $this->create($clinicId, $payment);
            if (!empty($payment['appointment_id'])) {
                $appointmentIdsToUpdate[] = (int) $payment['appointment_id'];
            }
        }

        // Benzersiz randevu ID'lerini al ve her biri için ödeme durumunu güncelle
        foreach (array_unique($appointmentIdsToUpdate) as $appId) {
            $this->updateAppointmentPaymentStatus($appId);
        }

        return $ids;
    }

    /**
     * Randevunun ödeme durumunu hesaplar ve günceller.
     */
    public function updateAppointmentPaymentStatus(int $appointmentId): void
    {
        // 1. Toplam Borç
        $debtSql = "SELECT SUM(total_price) as total FROM cln_appointment_items WHERE appointment_id = ?";
        $debt = (float) ($this->db->fetch($debtSql, [$appointmentId])['total'] ?? 0);

        // 2. Toplam Ödeme
        $paidSql = "SELECT SUM(amount) as total FROM cln_payments WHERE appointment_id = ? AND status = 'completed'";
        $paid = (float) ($this->db->fetch($paidSql, [$appointmentId])['total'] ?? 0);

        // 3. Statü Belirle
        $status = 'unpaid';
        if ($debt > 0) {
            if ($paid >= $debt) {
                $status = 'paid';
            } elseif ($paid > 0) {
                $status = 'partially_paid';
            }
        }

        // 4. Güncelle
        // 4. Güncelle
        if ($status === 'paid') {
            $updateSql = "UPDATE cln_appointments SET payment_status = ?, status = 'completed' WHERE id = ?";
        } else {
            $updateSql = "UPDATE cln_appointments SET payment_status = ? WHERE id = ?";
        }
        $this->db->query($updateSql, [$status, $appointmentId]);
    }

    /**
     * Ödeme iptali (Status update)
     */
    public function cancel(int $clinicId, int $paymentId): bool
    {
        // Önce ödemeyi bulalım ki appointment_id varsa orayı da güncelleyelim
        $sql = "SELECT appointment_id FROM cln_payments WHERE clinic_id = ? AND id = ?";
        $payment = $this->db->fetch($sql, [$clinicId, $paymentId]);

        $updateSql = "UPDATE cln_payments SET status = 'cancelled' WHERE clinic_id = ? AND id = ?";
        $this->db->query($updateSql, [$clinicId, $paymentId]);

        if ($payment && !empty($payment['appointment_id'])) {
            $this->updateAppointmentPaymentStatus((int) $payment['appointment_id']);
        }

        return true;
    }

    /**
     * Randevu bazlı borç/alacak listesi.
     * Sadece borcu olan randevuları getirir.
     */
    public function getPendingPayments(int $clinicId): array
    {
        // 1. Hesaplama: Her randevunun toplam tutarı
        // 2. Hesaplama: Her randevu için yapılan toplam ödeme
        // Fark > 0 ise listele.

        $sql = "
            SELECT 
                a.id as appointment_id,
                a.appointment_date,
                p.id as patient_id,
                p.name as patient_name,
                p.tc_no as patient_tc,
                p.phone as patient_phone,
                doc.name as doctor_name,
                
                (SELECT COALESCE(SUM(total_price), 0) 
                 FROM cln_appointment_items 
                 WHERE appointment_id = a.id) as total_debt,
                 
                (SELECT COALESCE(SUM(amount), 0) 
                 FROM cln_payments 
                 WHERE appointment_id = a.id AND status = 'completed') as total_paid
                 
            FROM cln_appointments a
            JOIN ptn_cards p ON a.patient_id = p.id
            LEFT JOIN sys_users doc ON a.doctor_id = doc.id
            WHERE a.clinic_id = ? 
              AND a.status != 'cancelled'
            HAVING (total_debt - total_paid) > 0
            ORDER BY a.appointment_date DESC
            LIMIT 50
        ";

        $rows = $this->db->fetchAll($sql, [$clinicId]);

        // Hasta isimlerini çöz
        return array_map(function ($row) {
            if (!empty($row['patient_name'])) {
                $row['patient_name'] = $this->crypto->decrypt($row['patient_name']) ?? $row['patient_name'];
            }
            if (!empty($row['patient_phone'])) {
                $row['patient_phone'] = $this->crypto->decrypt($row['patient_phone']) ?? $row['patient_phone'];
            }
            $row['remaining_amount'] = (float) $row['total_debt'] - (float) $row['total_paid'];
            return $row;
        }, $rows);
    }

    /**
     * Günlük ciro özeti.
     */
    public function getDailySummary(int $clinicId, string $date): array
    {
        $sql = "SELECT 
                    payment_type, 
                    SUM(amount) as total_amount,
                    COUNT(*) as count
                FROM cln_payments 
                WHERE clinic_id = ? 
                  AND DATE(payment_date) = ?
                  AND status = 'completed'
                GROUP BY payment_type";

        return $this->db->fetchAll($sql, [$clinicId, $date]);
    }

    /**
     * Günlük toplam tahsilat (Tek rakam).
     */
    public function getDailyTotal(int $clinicId, string $date): float
    {
        $sql = "SELECT SUM(amount) as total
                FROM cln_payments 
                WHERE clinic_id = ? 
                  AND DATE(payment_date) = ?
                  AND status = 'completed'";

        $result = $this->db->fetch($sql, [$clinicId, $date]);
        return (float) ($result['total'] ?? 0);
    }

    /**
     * Belirli tarih aralığındaki toplam ciro.
     */
    public function getPeriodTotal(int $clinicId, string $startDate, string $endDate): float
    {
        $sql = "SELECT SUM(amount) as total
                FROM cln_payments 
                WHERE clinic_id = ? 
                  AND DATE(payment_date) >= ?
                  AND DATE(payment_date) <= ?
                  AND status = 'completed'";

        $result = $this->db->fetch($sql, [$clinicId, $startDate, $endDate]);
        return (float) ($result['total'] ?? 0);
    }

    /**
     * Son alının ödemeler listesi.
     */
    public function getRecentTransactions(int $clinicId, int $limit = 20): array
    {
        $sql = "SELECT 
                    pm.patient_id,
                    MAX(pm.appointment_id) as appointment_id,
                    MAX(pm.payment_date) as payment_date,
                    SUM(pm.amount) as amount,
                    GROUP_CONCAT(DISTINCT pm.payment_type SEPARATOR ', ') as payment_type,
                    p.name as patient_name,
                    u.name as staff_name
                FROM cln_payments pm
                JOIN ptn_cards p ON pm.patient_id = p.id
                LEFT JOIN sys_users u ON pm.created_by = u.id
                WHERE pm.clinic_id = ? AND pm.status = 'completed'
                GROUP BY pm.patient_id, DATE(pm.payment_date)
                ORDER BY payment_date DESC
                LIMIT ?";

        $rows = $this->db->fetchAll($sql, [$clinicId, $limit]);

        return array_map(function ($row) {
            if (!empty($row['patient_name'])) {
                $row['patient_name'] = $this->crypto->decrypt($row['patient_name']) ?? $row['patient_name'];
            }
            return $row;
        }, $rows);
    }

    /**
     * Hastanın bakiyesini getirir.
     */
    public function getPatientBalance(int $clinicId, int $patientId): array
    {
        // Toplam Borç (Randevulardan)
        $debtSql = "SELECT SUM(total_price) as total_debt 
                    FROM cln_appointment_items i
                    JOIN cln_appointments a ON i.appointment_id = a.id
                    WHERE a.clinic_id = ? AND a.patient_id = ? AND a.status != 'cancelled'";

        $debt = (float) ($this->db->fetch($debtSql, [$clinicId, $patientId])['total_debt'] ?? 0);

        // Toplam Ödeme
        $paidSql = "SELECT SUM(amount) as total_paid
                    FROM cln_payments
                    WHERE clinic_id = ? AND patient_id = ? AND status = 'completed'";

        $paid = (float) ($this->db->fetch($paidSql, [$clinicId, $patientId])['total_paid'] ?? 0);

        return [
            'total_debt' => $debt,
            'total_paid' => $paid,
            'balance' => $debt - $paid // Pozitif: Borçlu, Negatif: Alacaklı
        ];
    }
    /**
     * Gelişmiş Filtreleme ve Gruplama ile Ödeme Listesi (Pagination Destekli)
     * Not: Aynı hasta ve aynı randevuya ait ödemeler gruplanır.
     */
    public function getDetailedTransactions(int $clinicId, array $filters = [], int $page = 1, int $perPage = 20): array
    {
        $offset = ($page - 1) * $perPage;
        $params = [$clinicId];

        // Temel Sorgu
        $sql = "
            SELECT 
                pm.appointment_id,
                MAX(pm.payment_date) as last_payment_date,
                MAX(a.appointment_date) as appointment_date,
                SUM(pm.amount) as total_amount,
                COUNT(pm.id) as item_count,
                 DATE(MAX(pm.payment_date)) as date_group,
                 
                -- Grup içindeki ödeme tiplerini birleştir (örn: Credit Card, Cash)
                GROUP_CONCAT(DISTINCT pm.payment_type ORDER BY pm.id DESC SEPARATOR ', ') as payment_types,
                
                -- Hasta Bilgileri
                p.id as patient_id,
                p.name as patient_name,
                p.tc_no as patient_tc,
                
                -- Doktor (Randevu varsa)
                doc.name as doctor_name
                
            FROM cln_payments pm
            JOIN ptn_cards p ON pm.patient_id = p.id
            LEFT JOIN cln_appointments a ON pm.appointment_id = a.id
            LEFT JOIN sys_users doc ON a.doctor_id = doc.id
            
            WHERE pm.clinic_id = ? AND pm.status = 'completed'
        ";

        // Filtreler
        if (!empty($filters['start_date'])) {
            $sql .= " AND DATE(pm.payment_date) >= ?";
            $params[] = $filters['start_date'];
        }

        if (!empty($filters['end_date'])) {
            $sql .= " AND DATE(pm.payment_date) <= ?";
            $params[] = $filters['end_date'];
        }

        if (!empty($filters['payment_type'])) {
            $sql .= " AND pm.payment_type = ?";
            $params[] = $filters['payment_type'];
        }

        if (!empty($filters['patient_id'])) {
            $sql .= " AND pm.patient_id = ?";
            $params[] = $filters['patient_id'];
        }

        if (!empty($filters['patient_ids'])) {
            $placeholders = implode(',', array_fill(0, count($filters['patient_ids']), '?'));
            $sql .= " AND pm.patient_id IN ($placeholders)";
            foreach ($filters['patient_ids'] as $pid) {
                $params[] = $pid;
            }
        }

        // Search (İsim veya TC No üzerinden Blind Index ile)
        if (!empty($filters['search'])) {
            $normalizedQuery = $this->crypto->normalize($filters['search']);
            $tokens = explode(' ', $normalizedQuery);
            $tokens = array_unique(array_filter($tokens));

            if (!empty($tokens)) {
                $hashes = [];
                foreach ($tokens as $token) {
                    if (mb_strlen($token) >= 2) {
                        $hashes[] = $this->crypto->blindIndex($token);

                        // Ekstra: Numerik karakterler için temizlenmiş halini de ara
                        if (preg_match('/[0-9]/', $token)) {
                            $clean = preg_replace('/[^0-9]/', '', $token);
                            if (mb_strlen($clean) >= 2 && $clean !== $token) {
                                $hashes[] = $this->crypto->blindIndex($clean);
                            }
                        }
                    }
                }

                if (!empty($hashes)) {
                    $placeholders = implode(',', array_fill(0, count($hashes), '?'));
                    $sql .= " AND EXISTS (
                        SELECT 1 FROM search_index si 
                        WHERE si.table_name = 'ptn_cards' 
                        AND si.record_id = p.id 
                        AND si.search_hash IN ($placeholders)
                    )";
                    foreach ($hashes as $h) {
                        $params[] = $h;
                    }
                }
            }
        }

        // Gruplama: Randevu Bazlı (Randevusu olanlar birleşir, olmayanlar tekil kalır)
        $sql .= "
            GROUP BY 
                CASE 
                    WHEN pm.appointment_id IS NOT NULL THEN pm.appointment_id 
                    ELSE pm.id 
                END
        ";

        // Sıralama ve Limit
        $sql .= " ORDER BY last_payment_date DESC, MAX(pm.id) DESC LIMIT ? OFFSET ?";
        $params[] = $perPage;
        $params[] = $offset;

        $rows = $this->db->fetchAll($sql, $params);

        // Decrypt ve Formatlama
        return array_map(function ($row) {
            if (!empty($row['patient_name'])) {
                $row['patient_name'] = $this->crypto->decrypt($row['patient_name']) ?? $row['patient_name'];
            }
            if (!empty($row['patient_tc'])) {
                $row['patient_tc'] = $this->crypto->decrypt($row['patient_tc']) ?? $row['patient_tc'];
            }

            // Tipleri formatla (örn: cash, credit_card -> Nakit, Kredi Kartı)
            $row['payment_types_label'] = implode(', ', array_map(function ($t) {
                return match ($t) {
                    'cash' => 'Nakit',
                    'credit_card' => 'Kredi Kartı',
                    'bank_transfer' => 'Havale/EFT',
                    'other' => 'Diğer',
                    default => $t
                };
            }, explode(', ', $row['payment_types'] ?? '')));

            return $row;
        }, $rows);
    }

    /**
     * Sayfalama için toplam kayıt sayısı
     */
    public function countDetailedTransactions(int $clinicId, array $filters = []): int
    {
        $params = [$clinicId];
        $sql = "
            SELECT COUNT(*) as total FROM (
                SELECT pm.appointment_id
                FROM cln_payments pm
                JOIN ptn_cards p ON pm.patient_id = p.id
                WHERE pm.clinic_id = ? AND pm.status = 'completed'
        ";

        if (!empty($filters['start_date'])) {
            $sql .= " AND DATE(pm.payment_date) >= ?";
            $params[] = $filters['start_date'];
        }

        if (!empty($filters['end_date'])) {
            $sql .= " AND DATE(pm.payment_date) <= ?";
            $params[] = $filters['end_date'];
        }

        if (!empty($filters['payment_type'])) {
            $sql .= " AND pm.payment_type = ?";
            $params[] = $filters['payment_type'];
        }

        if (!empty($filters['patient_id'])) {
            $sql .= " AND pm.patient_id = ?";
            $params[] = $filters['patient_id'];
        }

        if (!empty($filters['patient_ids'])) {
            $placeholders = implode(',', array_fill(0, count($filters['patient_ids']), '?'));
            $sql .= " AND pm.patient_id IN ($placeholders)";
            foreach ($filters['patient_ids'] as $pid) {
                $params[] = $pid;
            }
        }

        if (!empty($filters['search'])) {
            $normalizedQuery = $this->crypto->normalize($filters['search']);
            $tokens = explode(' ', $normalizedQuery);
            $tokens = array_unique(array_filter($tokens));

            if (!empty($tokens)) {
                $hashes = [];
                foreach ($tokens as $token) {
                    if (mb_strlen($token) >= 2) {
                        $hashes[] = $this->crypto->blindIndex($token);
                    }
                }

                if (!empty($hashes)) {
                    $placeholders = implode(',', array_fill(0, count($hashes), '?'));
                    $sql .= " AND EXISTS (
                        SELECT 1 FROM search_index si 
                        WHERE si.table_name = 'ptn_cards' 
                        AND si.record_id = p.id 
                        AND si.search_hash IN ($placeholders)
                    )";
                    foreach ($hashes as $h) {
                        $params[] = $h;
                    }
                }
            }
        }

        $sql .= " 
            GROUP BY 
                CASE 
                    WHEN pm.appointment_id IS NOT NULL THEN pm.appointment_id 
                    ELSE pm.id 
                END
        ) as grouped_table";

        $result = $this->db->fetch($sql, $params);
        return (int) ($result['total'] ?? 0);
    }

    /**
     * Randevu Detaylı Finansal Görünüm (Modal için)
     * Hizmetler ve Ödeme Geçmişini getirir.
     */
    public function getTransactionDetailWithServices(int $clinicId, int $appointmentId, ?string $paymentDate = null): array
    {
        // Önce referans randevuyu bul ki tarih ve hastayı bilelim
        $refSql = "SELECT patient_id, DATE(appointment_date) as app_date FROM cln_appointments WHERE id = ?";
        $ref = $this->db->fetch($refSql, [$appointmentId]);

        if (!$ref)
            return ['services' => [], 'payments' => [], 'summary' => []];

        $patientId = (int) $ref['patient_id'];
        $date = $paymentDate ?? $ref['app_date'];

        // 1. O güne ait TÜM Hizmet Kalemleri (Borçlar)
        $itemsSql = "
            SELECT 
                i.*, 
                s.name as service_name,
                u.name as performer_name
            FROM cln_appointment_items i
            JOIN cln_appointments a ON i.appointment_id = a.id
            LEFT JOIN cln_services s ON i.service_id = s.id
            LEFT JOIN sys_users u ON i.performer_id = u.id
            WHERE i.clinic_id = ? 
              AND i.appointment_id = ?
        ";
        $items = $this->db->fetchAll($itemsSql, [$clinicId, $appointmentId]);

        // 2. O güne ait TÜM Tahsilatlar
        // Değişiklik: Randevu varsa sadece o randevuya ait olanları getir.
        // Randevu yoksa (Tarih bazlı işlem), o günkü randevusuz ödemeleri getir.
        $paymentsSql = "
            SELECT * 
            FROM cln_payments 
            WHERE clinic_id = ? 
              AND patient_id = ? 
              AND (
                  (appointment_id IS NOT NULL AND appointment_id = ?) 
                  OR 
                  (appointment_id IS NULL AND DATE(payment_date) = ?)
              )
            ORDER BY payment_date DESC
        ";
        $payments = $this->db->fetchAll($paymentsSql, [$clinicId, $patientId, $appointmentId, $date]);

        // 3. Özet Hesaplama
        $totalDebt = 0;
        foreach ($items as $item) {
            $totalDebt += (float) $item['total_price'];
        }

        $totalPaid = 0;
        foreach ($payments as $p) {
            $totalPaid += (float) $p['amount'];
        }

        return [
            'services' => $items,
            'payments' => $payments,
            'summary' => [
                'total_debt' => $totalDebt,
                'total_paid' => $totalPaid,
                'balance' => $totalDebt - $totalPaid
            ],
            'info' => [
                'date' => $date
            ]
        ];
    }
}
