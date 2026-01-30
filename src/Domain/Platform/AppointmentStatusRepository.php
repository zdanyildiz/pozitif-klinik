<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\Database;

class AppointmentStatusRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * ID'ye göre statü bulur
     */
    public function findById(int $id): ?array
    {
        $sql = "SELECT * FROM sys_appointment_statuses WHERE id = ?";
        $result = $this->db->fetch($sql, [$id]);
        return $result ?: null;
    }

    /**
     * Tüm statüleri sıralı olarak getirir
     */
    public function findAllSorted(): array
    {
        $sql = "SELECT * FROM sys_appointment_statuses ORDER BY sort_order ASC, name ASC";
        return $this->db->fetchAll($sql);
    }

    /**
     * Yeni statü ekler
     */
    public function create(array $data): int
    {
        $sql = "INSERT INTO sys_appointment_statuses (status_code, name, color_code, icon_class, sort_order, is_system, is_active) 
                VALUES (:status_code, :name, :color_code, :icon_class, :sort_order, :is_system, :is_active)";

        $this->db->query($sql, $data);
        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Statü günceller
     */
    public function update(int $id, array $data): bool
    {
        $updates = [];
        $params = ['id' => $id];

        foreach ($data as $key => $value) {
            $updates[] = "$key = :$key";
            $params[$key] = $value;
        }

        if (empty($updates)) {
            return false;
        }

        $sql = "UPDATE sys_appointment_statuses SET " . implode(', ', $updates) . " WHERE id = :id";
        return (bool) $this->db->query($sql, $params);
    }

    /**
     * Statü siler
     */
    public function delete(int $id): bool
    {
        $sql = "DELETE FROM sys_appointment_statuses WHERE id = ?";
        return (bool) $this->db->query($sql, [$id]);
    }

    /**
     * Statü kodu benzersiz mi kontrol eder
     */
    public function isCodeUnique(string $code, ?int $excludeId = null): bool
    {
        $sql = "SELECT COUNT(*) as count FROM sys_appointment_statuses WHERE status_code = :code";
        $params = ['code' => $code];

        if ($excludeId) {
            $sql .= " AND id != :id";
            $params['id'] = $excludeId;
        }

        $result = $this->db->fetch($sql, $params);
        return (int) ($result['count'] ?? 0) === 0;
    }
}
