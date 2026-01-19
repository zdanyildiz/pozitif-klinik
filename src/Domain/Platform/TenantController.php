<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\BaseController;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Throwable;

class TenantController extends BaseController
{
    /**
     * Yeni Klinik ve Admin Oluştur
     *
     * @param Request $request
     * @param Response $response
     * @return Response
     */
    public function create(Request $request, Response $response): Response
    {
        $body = $request->getParsedBody();
        $name = $body['name'] ?? '';
        $domain_prefix = $body['domain_prefix'] ?? '';
        $admin_username = $body['admin_username'] ?? '';
        $admin_password = $body['admin_password'] ?? '';

        // Temel validasyon
        if (empty($name) || empty($domain_prefix) || empty($admin_username) || empty($admin_password)) {
            return $this->errorResponse($response, 'Tüm alanlar (name, domain_prefix, admin_username, admin_password) gereklidir', 400);
        }

        // Domain prefix kontrolü
        $existingTenant = $this->db->fetch(
            "SELECT id FROM sys_tenants WHERE domain_prefix = :prefix",
            ['prefix' => $domain_prefix]
        );

        if ($existingTenant) {
            return $this->errorResponse($response, "Bu domain prefix ('$domain_prefix') zaten kullanımda", 400);
        }

        $connection = $this->db->getConnection();

        try {
            $connection->beginTransaction();

            // 1. sys_tenants tablosuna kliniği ekle
            $sqlTenant = "INSERT INTO sys_tenants (name, domain_prefix) VALUES (:name, :prefix)";
            $stmtTenant = $connection->prepare($sqlTenant);
            $stmtTenant->execute([
                'name' => $name,
                'prefix' => $domain_prefix
            ]);

            $clinicId = $connection->lastInsertId();

            // 2. sys_users tablosuna admin kullanıcısını ekle
            $sqlUser = "INSERT INTO sys_users (clinic_id, username, password_hash, role) 
                        VALUES (:clinic_id, :username, :password_hash, 'admin')";
            $stmtUser = $connection->prepare($sqlUser);
            $stmtUser->execute([
                'clinic_id' => $clinicId,
                'username' => $admin_username,
                'password_hash' => password_hash($admin_password, PASSWORD_BCRYPT)
            ]);

            $connection->commit();

            return $this->createdResponse($response, [
                'clinic_id' => $clinicId,
                'name' => $name,
                'domain_prefix' => $domain_prefix,
                'admin_username' => $admin_username
            ], 'Klinik ve Yönetici başarıyla oluşturuldu');

        } catch (Throwable $e) {
            $connection->rollBack();
            // Silent failure YASAK dendiği için hatayı fırlatıyoruz (HttpErrorHandler yakalayacak)
            throw $e;
        }
    }

    /**
     * Tüm Klinikleri Listele
     *
     * @param Request $request
     * @param Response $response
     * @return Response
     */
    public function list(Request $request, Response $response): Response
    {
        $tenants = $this->db->fetchAll("SELECT * FROM sys_tenants ORDER BY created_at DESC");
        return $this->successResponse($response, $tenants);
    }
}
