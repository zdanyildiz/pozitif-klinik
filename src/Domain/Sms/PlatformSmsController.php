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
            if (!empty($provider['template_config'])) {
                $provider['template_config'] = json_decode($provider['template_config'], true);
            }
        }

        return $this->success($response, [
            'count' => count($providers),
            'providers' => $providers
        ]);
    }

    /**
     * Tek bir sağlayıcının detaylarını getirir (Edit için)
     */
    #[Route('GET', '/providers/{id:[0-9]+}')]
    public function getProvider(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];
        $provider = $this->service->getProvider($id);

        if (!$provider) {
            return $this->error($response, 'Sağlayıcı bulunamadı', 404);
        }

        // JSON decode
        $provider['config_schema'] = !empty($provider['config_schema']) ? json_decode($provider['config_schema'], true) : [];
        $provider['template_config'] = !empty($provider['template_config']) ? json_decode($provider['template_config'], true) : [];

        return $this->success($response, ['provider' => $provider]);
    }

    /**
     * Sağlayıcıyı günceller
     */
    #[Route('PUT', '/providers/{id:[0-9]+}')]
    public function updateProvider(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];
        $data = $request->getParsedBody();

        if (empty($data['name']) || empty($data['driver_key']) || empty($data['template_config']) || empty($data['config_schema'])) {
            return $this->error($response, 'Eksik parametreler', 400);
        }

        try {
            $this->service->updateProvider(
                $id,
                $data['name'],
                $data['driver_key'],
                $data['template_config'],
                $data['config_schema']
            );

            return $this->success($response, null, 'SMS Sağlayıcısı güncellendi.');
        } catch (\Exception $e) {
            return $this->error($response, 'Güncelleme hatası: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Yeni bir SMS sağlayıcısı tanımlar (Provider Builder)
     */
    #[Route('POST', '/providers')]
    public function createProvider(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();

        if (empty($data['name']) || empty($data['driver_key']) || empty($data['template_config']) || empty($data['config_schema'])) {
            return $this->error($response, 'Eksik parametreler (name, driver_key, template_config, config_schema)', 400);
        }

        try {
            $id = $this->service->createProvider(
                $data['name'],
                $data['driver_key'],
                $data['template_config'], // Array olarak gelmeli
                $data['config_schema']    // Array olarak gelmeli
            );

            return $this->success($response, ['id' => $id], 'SMS Sağlayıcısı başarıyla oluşturuldu.');
        } catch (\Exception $e) {
            return $this->error($response, 'Sağlayıcı oluşturulurken hata: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Yapılandırılmış ama kaydedilmemiş bir sağlayıcıyı test eder.
     * Bu endpoint, "Provider Builder" ekranında "Test Et" butonuna basınca çalışır.
     */
    #[Route('POST', '/validate-provider')]
    public function validateProvider(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();

        // Gerekli: driver_key, template_config (URL vb), test_values (User/Pass), test_phone
        if (empty($data['driver_key']) || empty($data['template_config']) || empty($data['test_values']) || empty($data['test_phone'])) {
            return $this->error($response, 'Eksik test parametreleri.', 400);
        }

        try {
            // Template ile Test Değerlerini Birleştir
            $fullConfig = array_merge($data['template_config'], $data['test_values']);

            $success = $this->service->testConnection(
                $data['driver_key'],
                $fullConfig,
                $data['test_phone']
            );

            if ($success) {
                return $this->success($response, null, 'Test SMS başarıyla gönderildi.');
            } else {
                return $this->error($response, 'Test SMS gönderilemedi (API hata dönmedi ama başarısız).', 500);
            }

        } catch (\Exception $e) {
            return $this->error($response, 'Test başarısız: ' . $e->getMessage(), 400);
        }
    }

    /**
     * Kliniğin mevcut (veya formdaki) ayarlarıyla test SMS gönderir.
     */
    #[Route('POST', '/test/{clinicId:[0-9]+}')]
    public function testClinicSms(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['clinicId'];
        $data = $request->getParsedBody();

        if (empty($data['provider_id']) || empty($data['phone'])) {
            return $this->error($response, 'Eksik parametreler (provider_id veya phone)', 400);
        }

        try {
            // Sağlayıcıyı al (driver_key ve template_config için)
            $provider = $this->repository->getProvider((int) $data['provider_id']);
            if (!$provider) {
                return $this->error($response, 'Sağlayıcı bulunamadı.', 404);
            }

            $templateConfig = !empty($provider['template_config']) ? json_decode($provider['template_config'], true) : [];

            // Eğer formdan temiz (boş) bir config geldiyse, kayıtlı olanı kullanmayı deneyelim
            $formConfig = $data['config'] ?? [];
            if (empty($formConfig)) {
                $savedSettings = $this->repository->getClinicSettings($clinicId);
                if ($savedSettings && $savedSettings['provider_id'] == $data['provider_id']) {
                    // Kayıtlı şifreli veriyi çöz
                    $formConfig = $this->service->getClinicSettings($clinicId)['config'];
                }
            }

            if (empty($formConfig)) {
                return $this->error($response, 'Test için yapılandırma bilgisi bulunamadı. Lütfen formu doldurun veya ayarları kaydedin.', 400);
            }

            // Template + Kullanıcı değerlerini birleştir
            $fullConfig = array_merge($templateConfig, $formConfig);

            $success = $this->service->testConnection(
                $provider['driver_key'],
                $fullConfig,
                $data['phone']
            );

            if ($success) {
                return $this->success($response, null, 'Test SMS başarıyla gönderildi.');
            }

            return $this->error($response, 'Test SMS gönderilemedi.', 500);

        } catch (\Exception $e) {
            return $this->error($response, 'Test hatası: ' . $e->getMessage(), 400);
        }
    }

    /**
     * Sağlayıcıyı siler
     */
    #[Route('DELETE', '/providers/{id:[0-9]+}')]
    public function deleteProvider(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        try {
            $this->service->deleteProvider($id);
            return $this->success($response, null, 'SMS Sağlayıcısı silindi.');
        } catch (\Exception $e) {
            return $this->error($response, 'Silme işlemi başarısız: ' . $e->getMessage(), 500);
        }
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
            $p['config_schema'] = !empty($p['config_schema']) ? json_decode($p['config_schema'], true) : [];
            $p['template_config'] = !empty($p['template_config']) ? json_decode($p['template_config'], true) : [];
        }

        $currentSettings = $this->repository->getClinicSettings($clinicId);

        $activeConfig = null;
        if ($currentSettings) {
            $activeConfig = [
                'provider_id' => $currentSettings['provider_id'],
                'is_active' => $currentSettings['is_active'],
                'updated_at' => $currentSettings['updated_at']
                // Not: Güvenlik gereği encrypted config'i client'a dönmüyoruz.
                // İstemci tarafı form alanlarını boş görür, doldurursa update olur.
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

        if (empty($data['provider_id']) || !isset($data['config'])) {
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
