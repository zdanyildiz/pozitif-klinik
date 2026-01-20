<?php

declare(strict_types=1);

namespace App\Domain\Patient;

use App\Core\Database;
use App\Core\Security\CryptoService;

/**
 * PatientRepository - Hasta Veritabanı İşlemleri
 * 
 * Tüm hassas veriler (TC, Telefon, Email, Adres) AES-256-GCM ile
 * şifrelenerek saklanır. TC ve Telefon için blind index hash'leri
 * tutularak şifreli verilerde arama yapılabilir.
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
     * Hassas veriler decrypt edilerek döndürülür.
     */
    public function findAll(int $clinicId): array
    {
        $sql = "SELECT * FROM ptn_cards WHERE clinic_id = ? AND status = 1 ORDER BY id DESC";
        $patients = $this->db->fetchAll($sql, [$clinicId]);

        // Her hasta için hassas verileri çöz
        return array_map([$this, 'decryptPatientData'], $patients);
    }

    /**
     * ID'ye göre hasta detayını getirir
     * Hassas veriler decrypt edilerek döndürülür.
     */
    public function findById(int $clinicId, int $patientId): ?array
    {
        $sql = "SELECT * FROM ptn_cards WHERE clinic_id = ? AND id = ?";
        $result = $this->db->fetch($sql, [$clinicId, $patientId]);

        if (!$result) {
            return null;
        }

        return $this->decryptPatientData($result);
    }

    /**
     * TC Kimlik numarasına göre hasta arar
     * Blind index hash kullanarak şifreli veri üzerinde arama yapar.
     */
    public function findByTcNo(int $clinicId, string $tcNo): ?array
    {
        $tcHash = $this->crypto->blindIndex($tcNo);

        $sql = "SELECT * FROM ptn_cards WHERE clinic_id = ? AND tc_no_hash = ? AND status = 1";
        $result = $this->db->fetch($sql, [$clinicId, $tcHash]);

        if (!$result) {
            return null;
        }

        return $this->decryptPatientData($result);
    }

    /**
     * Telefon numarasına göre hasta arar
     * Blind index hash kullanarak şifreli veri üzerinde arama yapar.
     */
    public function findByPhone(int $clinicId, string $phone): ?array
    {
        $phoneHash = $this->crypto->blindIndex($phone);

        $sql = "SELECT * FROM ptn_cards WHERE clinic_id = ? AND phone_hash = ? AND status = 1";
        $result = $this->db->fetch($sql, [$clinicId, $phoneHash]);

        if (!$result) {
            return null;
        }

        return $this->decryptPatientData($result);
    }

    /**
     * Yeni hasta oluşturur
     * Hassas veriler encrypt edilerek kaydedilir.
     */
    public function create(int $clinicId, array $data): int
    {
        // Hassas verileri şifrele
        $encryptedTcNo = $this->crypto->encrypt($data['tc_no']);
        $encryptedPhone = $this->crypto->encrypt($data['phone']);
        $encryptedEmail = $this->crypto->encryptSafe($data['email'] ?? null);
        $encryptedAddress = $this->crypto->encryptSafe($data['address'] ?? null);

        // Blind index hash'lerini oluştur (arama için)
        $tcHash = $this->crypto->blindIndex($data['tc_no']);
        $phoneHash = $this->crypto->blindIndex($data['phone']);

        $sql = "INSERT INTO ptn_cards (
                    clinic_id, tc_no, tc_no_hash, name, phone, phone_hash, email, 
                    birth_date, gender, blood_type, address, notes, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)";

        $this->db->query($sql, [
            $clinicId,
            $encryptedTcNo,
            $tcHash,
            $data['name'], // İsim şifrelenmez (arama için gerekli)
            $encryptedPhone,
            $phoneHash,
            $encryptedEmail,
            $data['birth_date'] ?? null,
            $data['gender'] ?? 'U',
            $data['blood_type'] ?? null,
            $encryptedAddress,
            $data['notes'] ?? null // Notlar şifrelenmez (operasyonel gereklilik)
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Hasta bilgilerini günceller
     * Hassas veriler encrypt edilerek kaydedilir.
     */
    public function update(int $clinicId, int $patientId, array $data): bool
    {
        // Hassas verileri şifrele
        $encryptedTcNo = $this->crypto->encrypt($data['tc_no']);
        $encryptedPhone = $this->crypto->encrypt($data['phone']);
        $encryptedEmail = $this->crypto->encryptSafe($data['email'] ?? null);
        $encryptedAddress = $this->crypto->encryptSafe($data['address'] ?? null);

        // Blind index hash'lerini güncelle
        $tcHash = $this->crypto->blindIndex($data['tc_no']);
        $phoneHash = $this->crypto->blindIndex($data['phone']);

        $sql = "UPDATE ptn_cards SET 
                    tc_no = ?, 
                    tc_no_hash = ?,
                    name = ?, 
                    phone = ?, 
                    phone_hash = ?,
                    email = ?, 
                    birth_date = ?, 
                    gender = ?, 
                    blood_type = ?, 
                    address = ?, 
                    notes = ?
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $encryptedTcNo,
            $tcHash,
            $data['name'],
            $encryptedPhone,
            $phoneHash,
            $encryptedEmail,
            $data['birth_date'] ?? null,
            $data['gender'] ?? 'U',
            $data['blood_type'] ?? null,
            $encryptedAddress,
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

    /**
     * Şifreli hasta verisini çöz
     * 
     * @param array $patient Veritabanından gelen şifreli hasta kaydı
     * @return array Hassas verileri decrypt edilmiş hasta kaydı
     */
    private function decryptPatientData(array $patient): array
    {
        // Hassas alanları decrypt et
        if (!empty($patient['tc_no'])) {
            $decrypted = $this->crypto->decrypt($patient['tc_no']);
            // Eğer decrypt başarısız olduysa (eski şifrelenmemiş veri olabilir), orijinali kullan
            $patient['tc_no'] = $decrypted ?? $patient['tc_no'];
        }

        if (!empty($patient['phone'])) {
            $decrypted = $this->crypto->decrypt($patient['phone']);
            $patient['phone'] = $decrypted ?? $patient['phone'];
        }

        if (!empty($patient['email'])) {
            $decrypted = $this->crypto->decrypt($patient['email']);
            $patient['email'] = $decrypted ?? $patient['email'];
        }

        if (!empty($patient['address'])) {
            $decrypted = $this->crypto->decrypt($patient['address']);
            $patient['address'] = $decrypted ?? $patient['address'];
        }

        // Hash alanlarını frontend'e döndürmeye gerek yok
        unset($patient['tc_no_hash'], $patient['phone_hash']);

        return $patient;
    }

    /**
     * Hasta adını ID'ye göre getir (Randevu listesi için optimize)
     * Sadece isim döner, hassas veri içermez.
     */
    public function getPatientName(int $clinicId, int $patientId): ?string
    {
        $sql = "SELECT name FROM ptn_cards WHERE clinic_id = ? AND id = ?";
        $result = $this->db->fetch($sql, [$clinicId, $patientId]);

        return $result['name'] ?? null;
    }

    /**
     * Hasta sayısını getir (Dashboard için)
     */
    public function countActive(int $clinicId): int
    {
        $sql = "SELECT COUNT(*) as total FROM ptn_cards WHERE clinic_id = ? AND status = 1";
        $result = $this->db->fetch($sql, [$clinicId]);

        return (int) ($result['total'] ?? 0);
    }
}
