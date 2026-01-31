<?php

declare(strict_types=1);

namespace App\Domain\File;

use App\Core\Database;

/**
 * FileRepository
 * 
 * sys_files tablosu veritabanı işlemleri.
 */
class FileRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Dosya metadata kaydı oluşturur.
     */
    public function create(array $data): int
    {
        $sql = "INSERT INTO sys_files (
                    clinic_id, module, related_id, original_name, storage_path, 
                    file_hash, mime_type, size_kb, uuid, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $this->db->query($sql, [
            $data['clinic_id'],
            $data['module'],
            $data['related_id'],
            $data['original_name'],
            $data['storage_path'],
            $data['file_hash'],
            $data['mime_type'],
            $data['size_kb'],
            $data['uuid'],
            $data['created_by']
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * UUID ile dosya bulur (Klinik izolasyonu ile).
     */
    public function findByUuid(int $clinicId, string $uuid): ?array
    {
        $sql = "SELECT * FROM sys_files WHERE clinic_id = ? AND uuid = ? AND deleted_at IS NULL";
        return $this->db->fetch($sql, [$clinicId, $uuid]);
    }

    /**
     * ID ile dosya bulur.
     */
    public function findById(int $clinicId, int $id): ?array
    {
        $sql = "SELECT * FROM sys_files WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL";
        return $this->db->fetch($sql, [$clinicId, $id]);
    }

    /**
     * Modül ve ilgili kayda göre dosya listesi getirir.
     */
    public function getByRelatedId(int $clinicId, string $module, int $relatedId): array
    {
        $sql = "SELECT * FROM sys_files 
                WHERE clinic_id = ? AND module = ? AND related_id = ? AND deleted_at IS NULL 
                ORDER BY created_at DESC";
        return $this->db->fetchAll($sql, [$clinicId, $module, $relatedId]);
    }

    /**
     * Dosyayı soft-delete yapar.
     */
    public function softDelete(int $clinicId, string $uuid, ?int $userId): bool
    {
        $sql = "UPDATE sys_files SET deleted_at = NOW() WHERE clinic_id = ? AND uuid = ?";
        // user_id loglama vs için eklenebilir ama şu an basit tutuyoruz
        $this->db->query($sql, [$clinicId, $uuid]);
        return true;
    }
}
