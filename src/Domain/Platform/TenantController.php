<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\BaseController;
use App\Middleware\PlatformAdminMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Throwable;
use Psr\Container\ContainerInterface;

/**
 * TenantController - Klinik (Tenant) Yönetimi
 * 
 * Rotalar:
 * - POST /admin/tenants - Yeni klinik oluştur
 * - GET  /admin/tenants - Tüm klinikleri listele
 * 
 * NOT: Bu controller PlatformAdminMiddleware ile korunur.
 * Sadece Platform (Super) Admin'ler erişebilir.
 */
#[Group('/admin/tenants')]
#[Middleware(PlatformAdminMiddleware::class)]
class TenantController extends BaseController
{
    private TenantRepository $tenantRepository;

    public function __construct(ContainerInterface $container, TenantRepository $tenantRepository)
    {
        parent::__construct($container);
        $this->tenantRepository = $tenantRepository;
    }

    /**
     * Yeni Klinik ve Admin Oluştur
     */
    #[Route('POST', '')]
    public function create(Request $request, Response $response): Response
    {
        $body = $request->getParsedBody();
        $name = $body['name'] ?? '';
        $domain_prefix = $body['domain_prefix'] ?? '';
        $admin_username = $body['admin_username'] ?? '';
        $admin_password = $body['admin_password'] ?? '';

        // Temel validasyon
        if (empty($name) || empty($domain_prefix) || empty($admin_username) || empty($admin_password)) {
            return $this->error($response, 'Tüm alanlar (name, domain_prefix, admin_username, admin_password) gereklidir', 400);
        }

        // Domain prefix kontrolü
        if ($this->tenantRepository->findByDomain($domain_prefix)) {
            return $this->error($response, "Bu domain prefix ('$domain_prefix') zaten kullanımda", 400);
        }

        try {
            $clinicId = $this->tenantRepository->createTenantWithAdmin(
                ['name' => $name, 'domain_prefix' => $domain_prefix],
                ['username' => $admin_username, 'password' => $admin_password]
            );

            return $this->createdResponse($response, [
                'clinic_id' => $clinicId,
                'name' => $name,
                'domain_prefix' => $domain_prefix,
                'admin_username' => $admin_username
            ], 'Klinik ve Yönetici başarıyla oluşturuldu');

        } catch (Throwable $e) {
            // Detaylı hatayı loglayıp genel hata dönmek daha güvenli olabilir, 
            // ama geliştirme aşamasında hatayı görmek için fırlatıyoruz.
            throw $e;
        }
    }

    /**
     * Tüm Klinikleri Listele
     */
    #[Route('GET', '')]
    public function list(Request $request, Response $response): Response
    {
        $tenants = $this->tenantRepository->findAll();
        return $this->success($response, $tenants);
    }

    /**
     * Klinik Güncelle (İsim, Durum ve Yönetici Bilgileri)
     */
    #[Route('PUT', '/{id:[0-9]+}')]
    public function update(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];
        $body = $request->getParsedBody();

        $name = $body['name'] ?? '';
        $isActive = isset($body['is_active']) ? (int) $body['is_active'] : 1;

        // Yönetici güncelleme bilgileri (opsiyonel)
        $adminUsername = $body['admin_username'] ?? null;
        $adminPassword = $body['admin_password'] ?? null;

        if (empty($name)) {
            return $this->error($response, 'Klinik adı zorunludur.', 400);
        }

        // Klinik var mı?
        $existing = $this->tenantRepository->findById($id);
        if (!$existing) {
            return $this->error($response, 'Klinik bulunamadı.', 404);
        }

        $tenantData = [
            'name' => $name,
            'is_active' => $isActive
        ];

        $adminData = [];
        if (!empty($adminUsername)) {
            $adminData['username'] = $adminUsername;
        }
        if (!empty($adminPassword)) {
            $adminData['password'] = $adminPassword;
        }

        // Güncelle
        $this->tenantRepository->update($id, $tenantData, $adminData);

        return $this->success($response, null, 'Klinik bilgileri başarıyla güncellendi.');
    }
}
