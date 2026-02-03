<?php

declare(strict_types=1);

namespace App\Domain\Sms;

use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\Attributes\Route;
use App\Core\BaseController;
use App\Middleware\TenantMiddleware;
use Psr\Container\ContainerInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Respect\Validation\Validator as v;

/**
 * TenantSmsController - Klinik Yöneticileri için SMS Ayarları
 */
#[Group('/api/settings/sms')]
#[Middleware(TenantMiddleware::class)]
class TenantSmsController extends BaseController
{
    private SmsService $service;
    private SmsRepository $repository;

    public function __construct(
        ContainerInterface $container,
        SmsService $service,
        SmsRepository $repository
    ) {
        parent::__construct($container);
        $this->service = $service;
        $this->repository = $repository;
    }

    /**
     * Kliniğin mevcut SMS ayarlarını ve seçebileceği sağlayıcıları getirir.
     */
    #[Route('GET', '')]
    public function getSettings(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);

        // 1. Tüm sağlayıcıları çek (Seçim listesi için)
        $providers = $this->repository->getActiveProviders();
        foreach ($providers as &$p) {
            $p['config_schema'] = json_decode($p['config_schema'], true);
        }

        // 2. Kliniğin aktif ayarını çek
        $currentSettings = $this->repository->getClinicSettings($clinicId);

        // Güvenlik: Kayıtlı şifreleri/keyleri client'a ASLA açık gönderme.
        // Frontend, form alanlarını doldururken "password" tipli alanları boş bırakmalı veya maskelemeli.
        // Ancak bu yapıda config_data şifreli (encrypted string). 
        // Bunu çözüp göndermiyoruz, sadece "hangisi seçili" bilgisini ve
        // public olması gereken bilgileri dönebiliriz.
        // Veya "credential var ama gizli" şeklinde işaretleyebiliriz.
        // Şimdilik sadece seçili provider ID'sini dönelim, credentials client tarafında tekrar girilmeli
        // veya "Değiştirilmediyse boş bırakınız" mantığı kurgulanmalı.
        // Basitlik için: Kullanıcı her güncellemede şifreleri tekrar girmeli veya tarayıcı hatırlamalı.

        $activeConfig = null;
        if ($currentSettings) {
            $activeConfig = [
                'provider_id' => $currentSettings['provider_id'],
                'is_active' => $currentSettings['is_active'],
                // NOT: Konfigürasyon detaylarını dönmüyoruz.
                // İleride buraya "masked" data eklenebilir.
                'updated_at' => $currentSettings['updated_at']
            ];
        }

        return $this->success($response, [
            'providers' => $providers,
            'active_settings' => $activeConfig
        ]);
    }

    /**
     * SMS Ayarlarını Günceller
     */
    #[Route('PUT', '')]
    public function updateSettings(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $data = $request->getParsedBody();

        // Validasyon
        if (empty($data['provider_id']) || empty($data['config'])) {
            return $this->error($response, 'Eksik parametreler (provider_id, config)', 400);
        }

        try {
            // Service üzerinden kaydet (Şifreleme orada yapılıyor)
            $this->service->saveSettings(
                $clinicId,
                (int) $data['provider_id'],
                $data['config']
            );

            // Log
            $this->getLogger($clinicId)->info('SMS settings updated', [
                'user_id' => $this->getUserId($request),
                'provider_id' => $data['provider_id']
            ]);

            return $this->success($response, null, 'SMS ayarları başarıyla güncellendi.');

        } catch (\Exception $e) {
            return $this->error($response, 'Ayarlar kaydedilirken hata oluştu: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Test SMS Gönderimi
     */
    #[Route('POST', '/test')]
    public function sendTestSms(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $data = $request->getParsedBody();

        if (empty($data['phone'])) {
            return $this->error($response, 'Telefon numarası gerekli', 400);
        }

        $phone = $data['phone'];
        $message = "Pozitif Klinik test mesajidir. " . date('H:i:s');

        try {
            $this->service->sendSms($clinicId, $phone, $message);
            return $this->success($response, null, 'Test mesajı başarıyla gönderildi.');
        } catch (\Exception $e) {
            return $this->error($response, 'Test gönderimi başarısız: ' . $e->getMessage(), 500);
        }
    }
}
