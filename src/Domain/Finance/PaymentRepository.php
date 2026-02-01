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
            $data['payment_date'],
            $data['notes'] ?? null,
            $data['status'] ?? 'completed',
            $data['created_by'] ?? null
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Ödeme iptali (Status update)
     */
    public function cancel(int $clinicId, int $paymentId): bool
    {
        $sql = "UPDATE cln_payments SET status = 'cancelled' WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $paymentId]);
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
     * Son alının ödemeler listesi.
     */
    public function getRecentTransactions(int $clinicId, int $limit = 20): array
    {
        $sql = "SELECT 
                    pm.*,
                    p.name as patient_name,
                    u.name as staff_name
                FROM cln_payments pm
                JOIN ptn_cards p ON pm.patient_id = p.id
                LEFT JOIN sys_users u ON pm.created_by = u.id
                WHERE pm.clinic_id = ?
                ORDER BY pm.payment_date DESC
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
}
