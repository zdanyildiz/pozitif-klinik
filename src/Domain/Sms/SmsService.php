<?php

declare(strict_types=1);

namespace App\Domain\Sms;

use App\Core\Security\CryptoService;
use App\Core\Sms\Drivers\GenericHttpDriver;
use App\Core\Sms\Drivers\NetgsmDriver;
use App\Core\Sms\SmsDriverInterface;
use RuntimeException;

class SmsService
{
    private SmsRepository $repository;
    private CryptoService $crypto;

    public function __construct(SmsRepository $repository, CryptoService $crypto)
    {
        $this->repository = $repository;
        $this->crypto = $crypto;
    }

    /**
     * Kliniğin yapılandırmasını kullanarak SMS gönderir.
     *
     * @param int $clinicId
     * @param string $phone
     * @param string $message
     * @return bool
     * @throws RuntimeException
     */
    public function sendSms(int $clinicId, string $phone, string $message): bool
    {
        // 1. Ayarları Getir
        $settings = $this->repository->getClinicSettings($clinicId);
        if (!$settings) {
            // Klinik ayarı yoksa, varsayılan bir davranış sergilenebilir veya hata dönülür.
            // Şimdilik fail ediyoruz.
            // TODO: Belki "Global Platform SMS" fallback olarak düşünülebilir.
            throw new RuntimeException("Clinic #{$clinicId} does not have an active SMS configuration.");
        }

        // 2. Şifreli Konfigürasyonu Çöz
        $encryptedConfig = $settings['config_data'];
        $decryptedJson = $this->crypto->decrypt($encryptedConfig);

        if (!$decryptedJson) {
            throw new RuntimeException("Failed to decrypt SMS configuration for Clinic #{$clinicId}. Check encryption keys.");
        }

        $config = json_decode($decryptedJson, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException("Invalid JSON in SMS configuration.");
        }

        // Merge with Template Config if available (for Provider Builder)
        if (!empty($settings['template_config'])) {
            $templateConfig = json_decode($settings['template_config'], true);
            if (is_array($templateConfig)) {
                $config = array_merge($templateConfig, $config);
            }
        }

        // 3. Driver'ı Seç (Factory Logic)
        $driverKey = $settings['driver_key'];
        $driver = $this->createDriver($driverKey);

        // 4. Gönderimi Yap
        // Telefon numarasını normalize et (Opsiyonel: +90, 05 vs temizliği)
        $cleanPhone = $this->normalizePhone($phone);

        try {
            $result = $driver->send($cleanPhone, $message, $config);

            // 5. Başarı Logu
            $this->repository->logSms($clinicId, $cleanPhone, $message, $driverKey, 'sent', null);

            return $result;
        } catch (\Exception $e) {
            // 6. Hata Logu
            $this->repository->logSms($clinicId, $cleanPhone, $message, $driverKey, 'failed', $e->getMessage());

            // Hatayı yukarı fırlat (Controller yakalasın)
            throw $e;
        }
    }

    /**
     * Verilen konfigürasyonla (Kaydedilmemiş) SMS gönderimini test eder.
     * 
     * @param string $driverKey
     * @param array $fullConfig (Template + User Values merged)
     * @param string $phone
     * @return bool
     */
    public function testConnection(string $driverKey, array $fullConfig, string $phone): bool
    {
        $driver = $this->createDriver($driverKey);
        $cleanPhone = $this->normalizePhone($phone);

        return $driver->send($cleanPhone, "Test SMS - Pozitif Klinik Entegrasyon Kontrolu", $fullConfig);
    }

    /**
     * Driver anahtarına göre sınıfı üretir.
     * Bu kısım ileride bir "DriverRegistry" veya DI Factory içine taşınabilir.
     */
    private function createDriver(string $key): SmsDriverInterface
    {
        return match ($key) {
            'netgsm' => new NetgsmDriver(),
            'generic_http' => new GenericHttpDriver(),
            default => throw new RuntimeException("Unsupported SMS driver: {$key}"),
        };
    }

    /**
     * Telefon numarasını temizler (Sadece rakamlar)
     * Örn: (0532) 123 45 67 -> 05321234567
     * Driver'lar genelde ham format bekler, 90 eklemek gerekirse driver içinde config'e eklenebilir.
     */
    private function normalizePhone(string $phone): string
    {
        return preg_replace('/[^0-9]/', '', $phone);
    }

    /**
     * Klinik SMS ayarlarını şifreleyerek kaydeder.
     * Boş bırakılan alanlar mevcut değerlerini korur.
     * 
     * @param int $clinicId
     * @param int $providerId
     * @param array $configData Ham (açık) konfigürasyon verisi
     */
    public function saveSettings(int $clinicId, int $providerId, array $configData): void
    {
        // 1. Mevcut ayarları al
        $existing = $this->repository->getClinicSettings($clinicId);
        $finalConfig = $configData;

        // 2. Eğer mevcut ayar varsa ve provider aynıysa merge yap
        if ($existing && (int) $existing['provider_id'] === $providerId) {
            $decryptedJson = $this->crypto->decrypt($existing['config_data']);
            $oldConfig = json_decode($decryptedJson, true) ?: [];

            // Eğer yeni veri boşsa eskisini koru
            foreach ($oldConfig as $key => $value) {
                if (!isset($configData[$key]) || $configData[$key] === '') {
                    $finalConfig[$key] = $value;
                }
            }
        }

        $json = json_encode($finalConfig);
        if ($json === false) {
            throw new RuntimeException("Invalid configuration data");
        }

        $encrypted = $this->crypto->encrypt($json);
        $this->repository->saveClinicSettings($clinicId, $providerId, $encrypted);
    }

    /**
     * Yeni bir SMS Sağlayıcı tanımlar (Provider Builder)
     */
    public function createProvider(string $name, string $driverKey, array $templateConfig, array $configSchema): int
    {
        return $this->repository->createProvider($name, $driverKey, $templateConfig, $configSchema);
    }
}
