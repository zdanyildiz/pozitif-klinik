<?php

declare(strict_types=1);

namespace App\Domain\Patient;

use App\Core\Database;
use App\Core\Security\CryptoService;

/**
 * PatientRepository - Hasta Veritabanı İşlemleri
 * 
 * TÜM KİŞİSEL VERİLER (Ad, TC, Telefon, Email, Adres) AES-256-GCM ile
 * şifrelenerek saklanır. Arama için blind index hash'leri kullanılır.
 * 
 * ⚠️ GÜVENLİK: Tüm sorgular clinic_id filtresi ile çalışır (multi-tenancy)
 * 
 * @package App\Domain\Patient
 */
class PatientRepository
{
    private Database $db;
    private CryptoService $crypto;

    public function __construct(Database $db, CryptoService $crypto)
    {
        $this->db = $db;
        $this->crypto = $crypto;
    }

    /**
     * Tüm aktif hastaları getirir (status = 1)
     */
    public function findAll(int $clinicId): array
    {
        $sql = "SELECT p.*, pr.name as province_name, d.name as district_name 
                FROM ptn_cards p
                LEFT JOIN sys_provinces pr ON p.province_id = pr.id
                LEFT JOIN sys_districts d ON p.district_id = d.id
                WHERE p.clinic_id = ? AND p.status = 1 
                ORDER BY p.id DESC";

        $patients = $this->db->fetchAll($sql, [$clinicId]);
        return array_map([$this, 'decryptPatientData'], $patients);
    }

    /**
     * Sadece ID ve İsim döndürür (Select-box yüklemeleri için)
     */
    public function getSelectList(int $clinicId): array
    {
        $sql = "SELECT id, name, tc_no FROM ptn_cards WHERE clinic_id = ? AND status = 1 ORDER BY id DESC";
        $patients = $this->db->fetchAll($sql, [$clinicId]);
        return array_map([$this, 'decryptPatientData'], $patients);
    }

    /**
     * ID'ye göre hasta detayını getirir
     */
    public function findById(int $clinicId, int $patientId): ?array
    {
        $sql = "SELECT p.*, pr.name as province_name, d.name as district_name 
                FROM ptn_cards p
                LEFT JOIN sys_provinces pr ON p.province_id = pr.id
                LEFT JOIN sys_districts d ON p.district_id = d.id
                WHERE p.clinic_id = ? AND p.id = ?";

        $result = $this->db->fetch($sql, [$clinicId, $patientId]);

        if (!$result) {
            return null;
        }

        return $this->decryptPatientData($result);
    }

    /**
     * Yeni hasta oluşturur
     */
    public function create(int $clinicId, array $data): int
    {
        $sql = "INSERT INTO ptn_cards (
                    clinic_id, tc_no, tc_no_hash, name, name_hash, phone, phone_hash, 
                    email, birth_date, gender, blood_type, address, province_id, district_id, notes, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)";

        $this->db->query($sql, [
            $clinicId,
            $this->crypto->encrypt($data['tc_no']),
            $this->crypto->blindIndex($data['tc_no']),
            $this->crypto->encrypt($data['name']),
            $this->crypto->blindIndex($data['name']),
            $this->crypto->encrypt($data['phone']),
            $this->crypto->blindIndex($data['phone']),
            $this->crypto->encryptSafe($data['email'] ?? null),
            $data['birth_date'] ?? null,
            $data['gender'] ?? 'U',
            $data['blood_type'] ?? null,
            $this->crypto->encryptSafe($data['address'] ?? null),
            $data['province_id'] ?? null,
            $data['district_id'] ?? null,
            $this->crypto->encryptSafe($data['notes'] ?? null)
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Hasta bilgilerini günceller
     */
    public function update(int $clinicId, int $patientId, array $data): bool
    {
        $sql = "UPDATE ptn_cards SET 
                    tc_no = ?, tc_no_hash = ?, 
                    name = ?, name_hash = ?, 
                    phone = ?, phone_hash = ?, 
                    email = ?, birth_date = ?, gender = ?, blood_type = ?,
                    address = ?, province_id = ?, district_id = ?, notes = ?
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $this->crypto->encrypt($data['tc_no']),
            $this->crypto->blindIndex($data['tc_no']),
            $this->crypto->encrypt($data['name']),
            $this->crypto->blindIndex($data['name']),
            $this->crypto->encrypt($data['phone']),
            $this->crypto->blindIndex($data['phone']),
            $this->crypto->encryptSafe($data['email'] ?? null),
            $data['birth_date'] ?? null,
            $data['gender'] ?? 'U',
            $data['blood_type'] ?? null,
            $this->crypto->encryptSafe($data['address'] ?? null),
            $data['province_id'] ?? null,
            $data['district_id'] ?? null,
            $this->crypto->encryptSafe($data['notes'] ?? null),
            $clinicId,
            $patientId
        ]);

        return true;
    }

    /**
     * Arşivleme ve Silme metodları (Aynı kalabilir)
     */
    public function archive(int $clinicId, int $patientId): bool
    {
        $sql = "UPDATE ptn_cards SET status = 0 WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $patientId]);
        return true;
    }

    public function delete(int $clinicId, int $patientId): bool
    {
        $sql = "DELETE FROM ptn_cards WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $patientId]);
        return true;
    }

    /**
     * Şifreli verileri çözer
     */
    private function decryptPatientData(array $patient): array
    {
        $fields = ['tc_no', 'name', 'phone', 'email', 'address', 'notes'];
        foreach ($fields as $field) {
            if (!empty($patient[$field])) {
                $decrypted = $this->crypto->decrypt($patient[$field]);
                $patient[$field] = $decrypted ?? $patient[$field];
            }
        }

        unset($patient['tc_no_hash'], $patient['name_hash'], $patient['phone_hash']);
        return $patient;
    }

    /**
     * Hastaları TC, Telefon veya İsim Hash'i ile arar (Tam Eşleşme)
     */
    public function search(int $clinicId, string $query): array
    {
        $hash = $this->crypto->blindIndex($query);

        $sql = "SELECT p.*, pr.name as province_name, d.name as district_name 
                FROM ptn_cards p
                LEFT JOIN sys_provinces pr ON p.province_id = pr.id
                LEFT JOIN sys_districts d ON p.district_id = d.id
                WHERE p.clinic_id = ? AND p.status = 1 
                AND (p.tc_no_hash = ? OR p.phone_hash = ? OR p.name_hash = ?)
                LIMIT 20";

        $patients = $this->db->fetchAll($sql, [$clinicId, $hash, $hash, $hash]);

        return array_map([$this, 'decryptPatientData'], $patients);
    }
}
