<?php

declare(strict_types=1);

namespace App\Domain\Clinic;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\BaseController;
use App\Middleware\TenantMiddleware;
use App\Domain\Platform\TenantRepository; // Reusing the repository
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Respect\Validation\Validator as v;
use Psr\Container\ContainerInterface;

/**
 * SettingsController - Klinik Kendi Ayarları
 * 
 * Rotalar:
 * - GET /api/clinic/settings - Klinik ayarlarını getir
 * - PUT /api/clinic/settings - Klinik ayarlarını güncelle
 */
#[Group('/api/clinic/settings')]
#[Middleware(TenantMiddleware::class)]
class SettingsController extends BaseController
{
    private TenantRepository $tenantRepository;

    public function __construct(ContainerInterface $container, TenantRepository $tenantRepository)
    {
        parent::__construct($container);
        $this->tenantRepository = $tenantRepository;
    }

    /**
     * Klinik ayarlarını getir
     */
    #[Route('GET', '')]
    public function getSettings(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);

        // TenantRepository'deki getBasicInfo metodu tam olarak ihtiyacımız olan veriyi dönüyor
        $settings = $this->tenantRepository->getBasicInfo($clinicId);

        if (!$settings) {
            return $this->notFoundResponse($response, 'Klinik ayarları bulunamadı.');
        }

        return $this->success($response, $settings);
    }

    /**
     * Klinik ayarlarını güncelle
     */
    #[Route('PUT', '')]
    public function updateSettings(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $body = $request->getParsedBody();

        // Validasyon Kuralları
        $validator = v::key('name', v::optional(v::stringType()->length(3)))
            ->key('phone', v::optional(v::stringType()))
            ->key('email', v::optional(v::email()))
            ->key('website', v::optional(v::url()))
            ->key('address', v::optional(v::stringType()))
            ->key('province_id', v::optional(v::numericVal())) // string "123" is accepted
            ->key('district_id', v::optional(v::numericVal())) // string "456" is accepted
            ->key('tax_office', v::optional(v::stringType()))
            ->key('tax_number', v::optional(v::stringType()))
            ->key('description', v::optional(v::stringType()))
            ->key('working_hours', v::optional(v::arrayType()));

        try {
            $validator->assert($body);

            // TenantRepository->updateBasicInfo kullanacağız.
            $this->tenantRepository->updateBasicInfo($clinicId, $body);

            return $this->success($response, null, 'Klinik ayarları başarıyla güncellendi.');
        } catch (\Respect\Validation\Exceptions\NestedValidationException $e) {
            return $this->validationErrorResponse($response, $e->getMessages());
        } catch (\Throwable $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * Görünüm ve Erişim Ayarlarını Getir
     */
    #[Route('GET', '/display')]
    public function getDisplaySettings(Request $request, Response $response): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        // Note: The original code used $this->getClinicId($request) but I don't see BaseController content yet. 
        // Safer to use getAttribute if TenantMiddleware sets it. 
        // But let's stick to existing pattern if getClinicId exists. 
        // Assuming getClinicId extracts from Attribute or Token.
        // Let's use getClinicId since it's used above.
        $clinicId = (int) $this->getClinicId($request);

        $config = $this->tenantRepository->getDisplayConfig($clinicId);

        if (empty($config)) {
            $config = [
                'modules' => [
                    'surgery' => ['doctor' => true, 'secretary' => true],
                    'finance' => ['doctor' => true, 'admin' => true],
                    'personnel' => ['admin' => true]
                ],
                'patient_detail' => [
                    'show_finance' => ['admin' => true, 'secretary' => true],
                    'show_vitals' => ['doctor' => true, 'secretary' => true]
                ]
            ];
        }

        return $this->success($response, $config);
    }

    /**
     * Görünüm Ayarlarını Güncelle
     */
    #[Route('PUT', '/display')]
    public function updateDisplaySettings(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $body = $request->getParsedBody();

        $this->tenantRepository->updateDisplayConfig($clinicId, $body);

        return $this->success($response, null, 'Görünüm ayarları başarıyla güncellendi.');
    }
}
