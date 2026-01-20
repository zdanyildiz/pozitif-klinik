<?php

declare(strict_types=1);

namespace App\Domain\Patient;

use App\Core\Database;

class PatientRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Tüm aktif hastaları getirir (status = 1)
     */
    public function findAll(int $clinicId): array
    {
        $sql = "SELECT * FROM ptn_cards WHERE clinic_id = ? AND status = 1 ORDER BY id DESC";
        return $this->db->fetchAll($sql, [$clinicId]);
    }

    /**
     * ID'ye göre hasta detayını getirir
     */
    public function findById(int $clinicId, int $patientId): ?array
    {
        $sql = "SELECT * FROM ptn_cards WHERE clinic_id = ? AND id = ?";
        $result = $this->db->fetch($sql, [$clinicId, $patientId]);
        return $result ?: null;
    }

    /**
     * Yeni hasta oluşturur
     */
    public function create(int $clinicId, array $data): int
    {
        $sql = "INSERT INTO ptn_cards (
                    clinic_id, tc_no, name, phone, email, 
                    birth_date, gender, blood_type, address, notes, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)";

        $this->db->query($sql, [
            $clinicId,
            $data['tc_no'],
            $data['name'],
            $data['phone'],
            $data['email'] ?? null,
            $data['birth_date'] ?? null,
            $data['gender'] ?? 'U',
            $data['blood_type'] ?? null,
            $data['address'] ?? null,
            $data['notes'] ?? null
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Hasta bilgilerini günceller
     */
    public function update(int $clinicId, int $patientId, array $data): bool
    {
        // Dinamik update query oluşturulabilir ama basitlik için tam güncelleme yapıyoruz
        $sql = "UPDATE ptn_cards SET 
                    tc_no = ?, 
                    name = ?, 
                    phone = ?, 
                    email = ?, 
                    birth_date = ?, 
                    gender = ?, 
                    blood_type = ?, 
                    address = ?, 
                    notes = ?
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $data['tc_no'],
            $data['name'],
            $data['phone'],
            $data['email'] ?? null,
            $data['birth_date'] ?? null,
            $data['gender'] ?? 'U',
            $data['blood_type'] ?? null,
            $data['address'] ?? null,
            $data['notes'] ?? null,
            $clinicId,
            $patientId
        ]);

        return true;
    }

    /**
     * Hastayı arşivler (status = 0)
     */
    public function archive(int $clinicId, int $patientId): bool
    {
        $sql = "UPDATE ptn_cards SET status = 0 WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $patientId]);
        return true;
    }

    /**
     * Hastayı veritabanından tamamen siler
     */
    public function delete(int $clinicId, int $patientId): bool
    {
        $sql = "DELETE FROM ptn_cards WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $patientId]);
        return true;
    }
}
