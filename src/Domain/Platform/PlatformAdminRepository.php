<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\Database;

/**
 * PlatformAdminRepository - Sistem (Platform) Yöneticileri için Veri Erişimi
 */
class PlatformAdminRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Kullanıcı adına göre platform admini bulur
     *
     * @param string $username
     * @return array|null
     */
    public function findByUsername(string $username): ?array
    {
        $sql = "SELECT id, username, password_hash FROM sys_platform_admins WHERE username = :username";
        $result = $this->db->fetch($sql, ['username' => $username]);
        return $result ?: null;
    }
}
