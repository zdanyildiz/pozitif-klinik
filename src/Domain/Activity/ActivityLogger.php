<?php

declare(strict_types=1);

namespace App\Domain\Activity;

use App\Core\Database;

class ActivityLogger
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Aktivite logunu veritabanına kaydeder.
     * Tüm hataları yutar (Silent Fail), böylece ana akış process'i durmaz.
     */
    public function log(
        int $clinicId,
        string $action,
        string $module,
        ?int $userId = null,
        ?int $recordId = null,
        ?string $recordType = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?string $description = null
    ): void {
        try {
            $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;

            $sql = "INSERT INTO cln_activity_logs (
                clinic_id, user_id, action, module, record_id, record_type, old_values, new_values, ip_address, description
            ) VALUES (
                :clinic_id, :user_id, :action, :module, :record_id, :record_type, :old_values, :new_values, :ip_address, :description
            )";

            $this->db->query($sql, [
                'clinic_id' => $clinicId,
                'user_id' => $userId,
                'action' => $action,
                'module' => $module,
                'record_id' => $recordId,
                'record_type' => $recordType,
                'old_values' => $oldValues ? json_encode($oldValues, JSON_UNESCAPED_UNICODE) : null,
                'new_values' => $newValues ? json_encode($newValues, JSON_UNESCAPED_UNICODE) : null,
                'ip_address' => $ipAddress,
                'description' => $description
            ]);
        } catch (\Throwable $e) {
            // Log hatası bussiness logic'i bozmamalı.
            // Production ortamında error_log'a yazabiliriz.
            if (isset($_ENV['APP_DEBUG']) && $_ENV['APP_DEBUG'] === 'true') {
                error_log("ActivityLogger Error: " . $e->getMessage());
            }
        }
    }
}
