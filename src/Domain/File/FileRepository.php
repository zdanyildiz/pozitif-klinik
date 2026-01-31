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
    /**
     * Dosyaları filtreleyerek arar.
     */
    public function searchFiles(int $clinicId, array $filters): array
    {
        $params = [$clinicId];

        // Temel sorgu ve JOIN'ler
        // Not: Yeni modüller eklendikçe buraya JOIN eklenmelidir.
        $sql = "SELECT f.*, 
                       CASE 
                           WHEN f.module = 'patient' THEN p.name 
                           WHEN f.module = 'examination' THEN p_exam.name
                           ELSE NULL 
                       END as patient_name
                FROM sys_files f
                LEFT JOIN ptn_cards p ON f.module = 'patient' AND f.related_id = p.id
                LEFT JOIN cln_examinations e ON f.module = 'examination' AND f.related_id = e.id
                LEFT JOIN ptn_cards p_exam ON e.patient_id = p_exam.id
                WHERE f.clinic_id = ? AND f.deleted_at IS NULL";

        // Filtre: Hasta ID
        if (!empty($filters['patient_id'])) {
            $sql .= " AND (p.id = ? OR p_exam.id = ?)";
            $params[] = $filters['patient_id'];
            $params[] = $filters['patient_id'];
        }

        // Filtre: Modül
        if (!empty($filters['module'])) {
            $sql .= " AND f.module = ?";
            $params[] = $filters['module'];
        }

        // Filtre: Dosya Türü
        if (!empty($filters['type'])) {
            if ($filters['type'] === 'image') {
                $sql .= " AND f.mime_type LIKE 'image/%'";
            } elseif ($filters['type'] === 'pdf') {
                $sql .= " AND f.mime_type = 'application/pdf'";
            } elseif ($filters['type'] === 'document') {
                $sql .= " AND (f.mime_type LIKE 'application/msword' 
                              OR f.mime_type LIKE 'application/vnd.openxmlformats-officedocument%' 
                              OR f.mime_type = 'application/pdf')";
            }
        }

        // Sıralama
        $sql .= " ORDER BY f.created_at DESC";

        // Limit
        if (isset($filters['limit'])) {
            $sql .= " LIMIT " . (int) $filters['limit'];
        }

        return $this->db->fetchAll($sql, $params);
    }
}
