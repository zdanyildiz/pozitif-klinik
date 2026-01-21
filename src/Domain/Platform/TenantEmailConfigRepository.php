<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\Database;

/**
 * TenantEmailConfigRepository
 * 
 * Klinik bazlı e-posta SMTP yapılandırmaları için Repository sınıfı.
 */
class TenantEmailConfigRepository
{
    public function __construct(
        private readonly Database $db
    ) {
    }

    /**
     * Klinik için e-posta config'ini getirir
     */
    public function findByClinicId(int $clinicId): ?array
    {
        $sql = "SELECT 
                    id,
                    clinic_id,
                    smtp_host,
                    smtp_port,
                    smtp_username,
                    smtp_password_encrypted,
                    smtp_encryption,
                    from_email,
                    from_name,
                    is_active,
                    created_at,
                    updated_at
                FROM sys_tenant_email_configs 
                WHERE clinic_id = ?
                LIMIT 1";

        $result = $this->db->fetch($sql, [$clinicId]);

        return $result ?: null;
    }

    /**
     * E-posta config'ini şifre olmadan getirir (görüntüleme için)
     */
    public function findByClinicIdWithoutPassword(int $clinicId): ?array
    {
        $sql = "SELECT 
                    smtp_host,
                    smtp_port,
                    smtp_username,
                    smtp_encryption,
                    from_email,
                    from_name,
                    is_active,
                    created_at,
                    updated_at
                FROM sys_tenant_email_configs 
                WHERE clinic_id = ?
                LIMIT 1";

        $result = $this->db->fetch($sql, [$clinicId]);

        return $result ?: null;
    }

    /**
     * Şifrelenmiş parolayı getirir
     */
    public function getEncryptedPassword(int $clinicId): ?string
    {
        $sql = "SELECT smtp_password_encrypted 
                FROM sys_tenant_email_configs 
                WHERE clinic_id = ?";

        $result = $this->db->fetch($sql, [$clinicId]);

        return $result['smtp_password_encrypted'] ?? null;
    }

    /**
     * Klinik için e-posta config'i var mı kontrol eder
     */
    public function exists(int $clinicId): bool
    {
        $sql = "SELECT 1 FROM sys_tenant_email_configs WHERE clinic_id = ? LIMIT 1";
        return (bool) $this->db->fetch($sql, [$clinicId]);
    }

    /**
     * E-posta config'ini siler (varsayılana dön)
     */
    public function deleteByClinicId(int $clinicId): bool
    {
        $sql = "DELETE FROM sys_tenant_email_configs WHERE clinic_id = ?";
        $this->db->query($sql, [$clinicId]);
        return true;
    }
}
