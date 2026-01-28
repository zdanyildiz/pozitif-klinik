<?php

declare(strict_types=1);

namespace App\Domain\Activity;

use App\Core\Database;

class ActivityLogRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Klinik loglarını listeler (Filtreleme ve Sayfalama ile)
     */
    public function findAll(int $clinicId, array $filters = [], int $limit = 50, int $offset = 0): array
    {
        $sql = "SELECT l.*, u.name as user_name 
                FROM cln_activity_logs l
                LEFT JOIN sys_users u ON l.user_id = u.id
                WHERE l.clinic_id = ?";

        $params = [$clinicId];

        // Filtreler
        if (!empty($filters['module'])) {
            $sql .= " AND l.module = ?";
            $params[] = $filters['module'];
        }

        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $sql .= " AND DATE(l.created_at) BETWEEN ? AND ?";
            $params[] = $filters['start_date'];
            $params[] = $filters['end_date'];
        }

        $sql .= " ORDER BY l.id DESC LIMIT ? OFFSET ?";

        // Debug Log
        error_log("ActivityLogRepository SQL: $sql, Params: " . json_encode($params));

        // LIMIT ve OFFSET parametreleri (PDO için integer bind gereklidir, ancak basitlik adına query stringe gömmüyoruz, array ile veriyoruz ama PDO bazen string olarak algılayabilir, bu yüzden cast ediyoruz veya direkt execute ile geçiyoruz)
        // PDO execute array ile parametre gönderdiğimizde hepsi string olarak gider ve LIMIT çalışmaz. 
        // Bu yüzden LIMIT/OFFSET'i bindValue ile bağlamak daha doğrudur veya doğrudan SQL string ine güvenli bir şekilde (int cast ile) gömmeliyiz.
        // Güvenlik için int cast yapıp stringe ekliyorum.

        $sql = str_replace('LIMIT ? OFFSET ?', "LIMIT $limit OFFSET $offset", $sql);

        return $this->db->fetchAll($sql, $params);
    }

    /**
     * Toplam kayıt sayısını döner (Pagination için)
     */
    public function count(int $clinicId, array $filters = []): int
    {
        $sql = "SELECT COUNT(*) as total FROM cln_activity_logs WHERE clinic_id = ?";
        $params = [$clinicId];

        if (!empty($filters['module'])) {
            $sql .= " AND module = ?";
            $params[] = $filters['module'];
        }

        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $sql .= " AND DATE(created_at) BETWEEN ? AND ?";
            $params[] = $filters['start_date'];
            $params[] = $filters['end_date'];
        }

        $result = $this->db->fetch($sql, $params);
        return (int) ($result['total'] ?? 0);
    }
}
