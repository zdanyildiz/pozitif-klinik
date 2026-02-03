<?php

declare(strict_types=1);

namespace App\Domain\Sms;

use App\Core\Database;
use PDO;

class SmsRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Sistemdeki tüm aktif SMS sağlayıcılarını listeler (NetGSM, Generic vs.)
     */
    public function getActiveProviders(): array
    {
        $sql = "SELECT * FROM sys_sms_providers WHERE is_active = 1 ORDER BY name ASC";
        return $this->db->fetchAll($sql);
    }

    /**
     * Bir kliniğin SMS yapılandırmasını getirir.
     */
    public function getClinicSettings(int $clinicId): ?array
    {
        $sql = "SELECT 
                    s.*, 
                    p.driver_key, 
                    p.name as provider_name,
                    p.template_config
                FROM cln_sms_settings s
                JOIN sys_sms_providers p ON s.provider_id = p.id
                WHERE s.clinic_id = :clinic_id AND s.is_active = 1 AND p.is_active = 1";

        $result = $this->db->fetch($sql, ['clinic_id' => $clinicId]);

        return $result === false ? null : $result;
    }

    /**
     * Klinik için SMS ayarlarını kaydeder veya günceller.
     */
    public function saveClinicSettings(int $clinicId, int $providerId, string $encryptedConfigJson): void
    {
        $sql = "INSERT INTO cln_sms_settings (clinic_id, provider_id, config_data) 
                VALUES (:clinic_id, :provider_id, :config_data)
                ON DUPLICATE KEY UPDATE 
                    provider_id = VALUES(provider_id),
                    config_data = VALUES(config_data),
                    is_active = 1,
                    updated_at = NOW()";

        $this->db->query($sql, [
            'clinic_id' => $clinicId,
            'provider_id' => $providerId,
            'config_data' => $encryptedConfigJson
        ]);
    }

    /**
     * Gönderim logunu kaydeder (İleride genişletilebilir)
     */
    public function logSms(int $clinicId, string $phone, string $message, string $providerKey, string $status, ?string $error = null): void
    {
        // TODO: cln_sms_logs veya benzeri bir tabloya log atılabilir.
        // Şimdilik sadece placeholder.
    }

    /**
     * Yeni bir SMS sağlayıcısı ekler.
     */
    public function createProvider(string $name, string $driverKey, array $templateConfig, array $configSchema): int
    {
        $sql = "INSERT INTO sys_sms_providers (name, driver_key, template_config, config_schema, is_active, created_at) 
                VALUES (:name, :driverKey, :templateConfig, :configSchema, 1, NOW())";

        $this->db->query($sql, [
            'name' => $name,
            'driverKey' => $driverKey,
            'templateConfig' => json_encode($templateConfig, JSON_UNESCAPED_UNICODE),
            'configSchema' => json_encode($configSchema, JSON_UNESCAPED_UNICODE)
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Sağlayıcı detaylarını getirir.
     */
    public function getProvider(int $id): ?array
    {
        $sql = "SELECT * FROM sys_sms_providers WHERE id = :id";
        $result = $this->db->fetch($sql, ['id' => $id]);
        return $result === false ? null : $result;
    }

    /**
     * Sağlayıcıyı günceller.
     */
    public function updateProvider(int $id, string $name, string $driverKey, array $templateConfig, array $configSchema): void
    {
        $sql = "UPDATE sys_sms_providers 
                SET name = :name, 
                    driver_key = :driverKey, 
                    template_config = :templateConfig, 
                    config_schema = :configSchema,
                    updated_at = NOW()
                WHERE id = :id";

        $this->db->query($sql, [
            'id' => $id,
            'name' => $name,
            'driverKey' => $driverKey,
            'templateConfig' => json_encode($templateConfig, JSON_UNESCAPED_UNICODE),
            'configSchema' => json_encode($configSchema, JSON_UNESCAPED_UNICODE)
        ]);
    }
    /**
     * Sağlayıcıyı siler.
     * Eğer kullanımda ise hata fırlatabilir veya is_active=0 yapabiliriz.
     * Şimdilik sert silme (hard delete) yapalım, Constraint hatası verirse kullanıcı görür.
     */
    public function deleteProvider(int $id): void
    {
        $sql = "DELETE FROM sys_sms_providers WHERE id = :id";
        $this->db->query($sql, ['id' => $id]);
    }
}
