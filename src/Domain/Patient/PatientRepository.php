<?php

declare(strict_types=1);

namespace App\Domain\Patient;

use App\Core\Database;
use App\Core\Security\CryptoService;
use App\Domain\Activity\ActivityLogger;

/**
 * PatientRepository - Hasta Veritabanı İşlemleri
 * 
 * Veriler AES-256-GCM ile şifrelenir.
 * Arama işlemleri normalized blind index (search_index tablosu) üzerinden yapılır.
 * 
 * @package App\Domain\Patient
 */
class PatientRepository
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

    /**
     * Tüm aktif hastaları getirir (status = 1) - Son 20 kayıt ile sınırlı
     */
    public function findAll(int $clinicId): array
    {
        $sql = "SELECT p.*, pr.name as province_name, d.name as district_name 
                FROM ptn_cards p
                LEFT JOIN sys_provinces pr ON p.province_id = pr.id
                LEFT JOIN sys_districts d ON p.district_id = d.id
                WHERE p.clinic_id = ? AND p.status = 1 
                ORDER BY p.id DESC
                LIMIT 20";

        $patients = $this->db->fetchAll($sql, [$clinicId]);
        return array_map([$this, 'decryptPatientData'], $patients);
    }

    /**
     * Hasta istatistiklerini getirir (Cinsiyet dağılımı)
     */
    public function getStats(int $clinicId): array
    {
        $sql = "SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN gender = 'M' THEN 1 ELSE 0 END) as male,
                    SUM(CASE WHEN gender = 'F' THEN 1 ELSE 0 END) as female
                FROM ptn_cards 
                WHERE clinic_id = ? AND status = 1";

        return $this->db->fetch($sql, [$clinicId]);
    }

    /**
     * Sadece ID ve İsim döndürür (Select-box yüklemeleri için)
     */
    public function getSelectList(int $clinicId): array
    {
        $sql = "SELECT id, name, tc_no FROM ptn_cards WHERE clinic_id = ? AND status = 1 ORDER BY id DESC LIMIT 50";
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
        // 1. Şifreli Veriyi Kaydet (Hash sütunları artık kullanılmıyor, NULL geçilecek)
        $sql = "INSERT INTO ptn_cards (
                    clinic_id, tc_no, name, phone, 
                    email, birth_date, gender, blood_type, address, province_id, district_id, notes, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)";

        $this->db->query($sql, [
            $clinicId,
            $this->crypto->encrypt($data['tc_no']),
            $this->crypto->encrypt($data['name']),
            $this->crypto->encrypt($data['phone']),
            $this->crypto->encryptSafe($data['email'] ?? null),
            $data['birth_date'] ?? null,
            $data['gender'] ?? 'U',
            $data['blood_type'] ?? null,
            $this->crypto->encryptSafe($data['address'] ?? null),
            $data['province_id'] ?? null,
            $data['district_id'] ?? null,
            $this->crypto->encryptSafe($data['notes'] ?? null)
        ]);

        $patientId = (int) $this->db->getConnection()->lastInsertId();

        // 2. Arama İndeksini Oluştur (Blind Index)
        $this->updateSearchIndex($patientId, $data);

        return $patientId;
    }

    /**
     * Hasta bilgilerini günceller
     */
    public function update(int $clinicId, int $patientId, array $data): bool
    {
        $sql = "UPDATE ptn_cards SET 
                    tc_no = ?, name = ?, phone = ?, 
                    email = ?, birth_date = ?, gender = ?, blood_type = ?,
                    address = ?, province_id = ?, district_id = ?, notes = ?
                WHERE clinic_id = ? AND id = ?";

        $this->db->query($sql, [
            $this->crypto->encrypt($data['tc_no']),
            $this->crypto->encrypt($data['name']),
            $this->crypto->encrypt($data['phone']),
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

        // 2. Arama İndeksini Güncelle
        $this->updateSearchIndex($patientId, $data);

        return true;
    }

    /**
     * Arama İndeksini (search_index) günceller.
     * İsim alanını kelimelere bölerek (tokenization) kaydeder.
     */
    private function updateSearchIndex(int $patientId, array $data): void
    {
        // Önce mevcut indeksleri temizle
        $deleteSql = "DELETE FROM search_index WHERE table_name = 'ptn_cards' AND record_id = ?";
        $this->db->query($deleteSql, [$patientId]);

        $insertSql = "INSERT INTO search_index (table_name, record_id, type, search_hash) VALUES (?, ?, ?, ?)";
        $tableName = 'ptn_cards';

        // 1. İsim (Parçalı Kayıt)
        if (!empty($data['name'])) {
            // İsimleri boşluktan böl ve normalize et
            $normalizedName = $this->crypto->normalize($data['name']);
            $tokens = explode(' ', $normalizedName);
            $uniqueTokens = array_unique(array_filter($tokens)); // Boşlukları ve tekrarları temizle

            foreach ($uniqueTokens as $token) {
                // Token uzunluğu çok kısaysa atla (isteğe bağlı, şimdilik her şeyi ekleyelim)
                if (mb_strlen($token) < 2)
                    continue;

                $hash = hash_hmac('sha256', $token, hex2bin(getenv('BLIND_INDEX_KEY')));
                // CryptoService içinde blindIndex metodu private key kullanıyor, burada manuel hashlemek yerine
                // CryptoService'i public yapabiliriz ya da blindIndex metodunu kullanabiliriz.
                // Ancak CryptoService->blindIndex() metodunu kullanırsak içinde tekrar normalize edecek. 
                // Token zaten normalize olduğu için sorun yok, tekrar normalize etmesi sonucu değiştirmez (lower->lower).

                // Düzeltme: CryptoService->blindIndex() kullanın
                $hash = $this->crypto->blindIndex($token);

                $this->db->query($insertSql, [$tableName, $patientId, 'name', $hash]);
            }
        }

        // 2. TC No (Tam Eşleşme)
        if (!empty($data['tc_no'])) {
            $hash = $this->crypto->blindIndex($data['tc_no']);
            $this->db->query($insertSql, [$tableName, $patientId, 'tc_no', $hash]);
        }

        // 3. Telefon (Tam Eşleşme)
        if (!empty($data['phone'])) {
            $hash = $this->crypto->blindIndex($data['phone']);
            $this->db->query($insertSql, [$tableName, $patientId, 'phone', $hash]);
        }
    }

    /**
     * Arşivleme ve Silme metodları
     */
    public function archive(int $clinicId, int $patientId, ?int $userId = null): bool
    {
        $oldPatient = $this->findById($clinicId, $patientId);

        $sql = "UPDATE ptn_cards SET status = 0 WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $patientId]);

        if ($oldPatient) {
            $this->logger->log(
                clinicId: $clinicId,
                action: 'PATIENT_ARCHIVE',
                module: 'PATIENT',
                userId: $userId,
                recordId: $patientId,
                recordType: 'Patient',
                oldValues: ['status' => 1],
                newValues: ['status' => 0],
                description: "{$oldPatient['name']} isimli hasta arşivlendi."
            );
        }

        return true;
    }

    public function delete(int $clinicId, int $patientId, ?int $userId = null): bool
    {
        $oldPatient = $this->findById($clinicId, $patientId);

        // Önce blind indexleri temizle
        $this->db->query("DELETE FROM search_index WHERE table_name = 'ptn_cards' AND record_id = ?", [$patientId]);

        $sql = "DELETE FROM ptn_cards WHERE clinic_id = ? AND id = ?";
        $this->db->query($sql, [$clinicId, $patientId]);

        if ($oldPatient) {
            $this->logger->log(
                clinicId: $clinicId,
                action: 'PATIENT_DELETE',
                module: 'PATIENT',
                userId: $userId,
                recordId: $patientId,
                recordType: 'Patient',
                oldValues: $oldPatient,
                description: "{$oldPatient['name']} isimli hasta kalıcı olarak silindi."
            );
        }

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

        // Hash alanlarını temizle (varsa)
        unset($patient['tc_no_hash'], $patient['name_hash'], $patient['phone_hash']);
        return $patient;
    }

    /**
     * Search Index Üzerinden Hızlı Arama
     * Token-based arama destekler. Sorgudaki kelimelerden HERHANGİ BİRİ eşleşirse getirir.
     */
    public function search(int $clinicId, string $query): array
    {
        // 1. Sorguyu normalize et ve parçala
        $normalizedQuery = $this->crypto->normalize($query);
        $tokens = explode(' ', $normalizedQuery);
        $tokens = array_unique(array_filter($tokens));

        if (empty($tokens)) {
            return [];
        }

        $hashes = [];
        foreach ($tokens as $token) {
            if (mb_strlen($token) >= 2) {
                $hashes[] = $this->crypto->blindIndex($token);
            }
        }

        if (empty($hashes)) {
            return [];
        }

        // 2. Hashleri SQL'e parametre olarak hazırla
        $placeholders = implode(',', array_fill(0, count($hashes), '?'));

        // 3. Search Index Üzerinden Join
        // Sorgudaki herhangi bir token ile eşleşen (OR mantığı) kayıtları getir.
        // DISTINCT p.id ile aynı kaydın birden fazla kez gelmesini engelle.
        $sql = "SELECT DISTINCT p.*, pr.name as province_name, d.name as district_name 
                FROM ptn_cards p
                JOIN search_index si ON p.id = si.record_id
                LEFT JOIN sys_provinces pr ON p.province_id = pr.id
                LEFT JOIN sys_districts d ON p.district_id = d.id
                WHERE p.clinic_id = ? AND p.status = 1 
                AND si.table_name = 'ptn_cards'
                AND si.search_hash IN ($placeholders)
                LIMIT 50";

        // Parametreleri birleştir: [clinicId, hash1, hash2, ...]
        $params = array_merge([$clinicId], $hashes);

        $patients = $this->db->fetchAll($sql, $params);

        return array_map([$this, 'decryptPatientData'], $patients);
    }
}
