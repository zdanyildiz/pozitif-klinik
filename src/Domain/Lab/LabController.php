<?php

declare(strict_types=1);

namespace App\Domain\Lab;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\BaseController;
use App\Middleware\TenantMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Respect\Validation\Validator as v;
use Psr\Container\ContainerInterface;

/**
 * LabController - Laboratuvar Sonuç Yönetimi
 *
 * Rotalar:
 * - POST   /api/lab       - Yeni laboratuvar sonucu ekle
 * - DELETE /api/lab/{id}  - Sonuç kaydını sil
 */
#[Group('/api/lab')]
#[Middleware(TenantMiddleware::class)]
class LabController extends BaseController
{
    private LabRepository $labRepository;

    public function __construct(
        ContainerInterface $container,
        LabRepository $labRepository
    ) {
        parent::__construct($container);
        $this->labRepository = $labRepository;
    }

    /**
     * Yeni laboratuvar sonucu ve test kalemlerini ekler
     */
    #[Route('POST', '')]
    public function createResult(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $data = $request->getParsedBody();

        // 1. Yetkilendirme Kontrolü (Sadece Admin ve Doktor)
        $role = $this->getJwtPayload($request)->role ?? '';
        if ($role !== 'admin' && $role !== 'doctor') {
            return $this->forbiddenResponse($response, 'Bu işlem için yetkiniz yok (Sadece Doktor veya Admin)');
        }

        // 2. Validasyon
        $validator = v::key('patient_id', v::intVal())
            ->key('result_date', v::date())
            ->key('doctor_id', v::intVal())
            ->key('items', v::arrayVal()->notEmpty());

        try {
            $validator->assert($data);

            $resultData = [
                'clinic_id' => $clinicId,
                'patient_id' => $data['patient_id'],
                'appointment_id' => $data['appointment_id'] ?? null,
                'doctor_id' => $data['doctor_id'],
                'result_date' => $data['result_date']
            ];

            // 3. Repository üzerinden İşlem (Transaction) başladık kaydedelim
            $resultId = $this->labRepository->saveFullResult($resultData, $data['items']);

            $this->getLogger($clinicId)->info('Lab result created', [
                'result_id' => $resultId,
                'patient_id' => $data['patient_id'],
                'user_id' => $this->getUserId($request)
            ]);

            return $this->createdResponse($response, [
                'id' => $resultId
            ], 'Laboratuvar sonucu başarıyla kaydedildi');

        } catch (\Respect\Validation\Exceptions\NestedValidationException $e) {
            return $this->validationErrorResponse($response, $e->getMessages());
        } catch (\Exception $e) {
            $this->getLogger($clinicId)->error('Lab result creation failed', ['error' => $e->getMessage()]);
            return $this->error($response, 'Kayıt sırasında bir hata oluştu: ' . $e->getMessage());
        }
    }

    /**
     * Hatalı girilen laboratuvar sonucunu siler
     */
    #[Route('DELETE', '/{id:[0-9]+}')]
    public function deleteResult(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $resultId = (int) $args['id'];

        // 1. Yetkilendirme Kontrolü (Sadece Admin ve Doktor)
        $role = $this->getJwtPayload($request)->role ?? '';
        if ($role !== 'admin' && $role !== 'doctor') {
            return $this->forbiddenResponse($response, 'Bu işlem için yetkiniz yok (Sadece Doktor veya Admin)');
        }

        $deleted = $this->labRepository->deleteResult($clinicId, $resultId);

        if ($deleted) {
            $this->getLogger($clinicId)->info('Lab result deleted', [
                'result_id' => $resultId,
                'user_id' => $this->getUserId($request)
            ]);
            return $this->success($response, null, 'Laboratuvar sonucu silindi');
        }

        return $this->error($response, 'Kayıt bulunamadı veya silinemedi', 404);
    }
}
