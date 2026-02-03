<?php

declare(strict_types=1);

namespace App\Domain\Sms;

use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\Attributes\Route;
use App\Core\BaseController;
use App\Middleware\PlatformAdminMiddleware;
use Psr\Container\ContainerInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Domain\Sms\SmsService;

/**
 * PlatformSmsController - Platform Yönetimi için SMS Sağlayıcı Ayarları
 * 
 * Bu controller sadece Platform Admin (Super Admin) erişimine açıktır.
 * Mevcut sağlayıcıları listeler (NetGSM, Generic, Twilio vb.) ve yapılandırma şemalarını döner.
 */
#[Group('/platform-admin/sms')]
#[Middleware(PlatformAdminMiddleware::class)]
class PlatformSmsController extends BaseController
{
    private SmsRepository $repository;
    private SmsService $service;

    public function __construct(ContainerInterface $container, SmsRepository $repository, SmsService $service)
    {
        parent::__construct($container);
        $this->repository = $repository;
        $this->service = $service;
    }

    /**
     * Tüm aktif SMS sağlayıcılarını listeler (Konfigürasyon şemalarıyla birlikte)
     */
    #[Route('GET', '/providers')]
    public function listProviders(Request $request, Response $response): Response
    {
        $providers = $this->repository->getActiveProviders();

        // JSON şemalarını string'den array/obje formatına çevirelim ki frontend kolay işlesin
        foreach ($providers as &$provider) {
            if (!empty($provider['config_schema'])) {
                $provider['config_schema'] = json_decode($provider['config_schema'], true);
            }
        }

        return $this->success($response, [
            'count' => count($providers),
            'providers' => $providers
        ]);
    }

    /**
     * Belirli bir klinik için SMS ayarlarını getir
     */
    #[Route('GET', '/settings/{clinicId:[0-9]+}')]
    public function getClinicSettings(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['clinicId'];

        $providers = $this->repository->getActiveProviders();
        foreach ($providers as &$p) {
            $p['config_schema'] = json_decode($p['config_schema'], true);
        }

        $currentSettings = $this->repository->getClinicSettings($clinicId);

        $activeConfig = null;
        if ($currentSettings) {
            $activeConfig = [
                'provider_id' => $currentSettings['provider_id'],
                'is_active' => $currentSettings['is_active'],
                'updated_at' => $currentSettings['updated_at']
            ];
        }

        return $this->success($response, [
            'providers' => $providers,
            'active_settings' => $activeConfig
        ]);
    }

    /**
     * Belirli bir klinik için SMS ayarlarını güncelle
     */
    #[Route('PUT', '/settings/{clinicId:[0-9]+}')]
    public function updateClinicSettings(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['clinicId'];
        $data = $request->getParsedBody();

        if (empty($data['provider_id']) || empty($data['config'])) {
            return $this->error($response, 'Eksik parametreler (provider_id, config)', 400);
        }

        try {
            $this->service->saveSettings(
                $clinicId,
                (int) $data['provider_id'],
                $data['config']
            );

            return $this->success($response, null, 'SMS ayarları güncellendi.');

        } catch (\Exception $e) {
            return $this->error($response, 'Ayarlar kaydedilirken hata oluştu: ' . $e->getMessage(), 500);
        }
    }
}
