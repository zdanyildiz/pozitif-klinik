<?php

declare(strict_types=1);

namespace App\Domain\Patient;

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
 * PatientController - Hasta Yönetimi ve Yaşam Bulguları
 * 
 * Rotalar:
 * - GET    /api/patients            - Hasta listesi
 * - GET    /api/patients/{id}       - Hasta detayı
 * - POST   /api/patients            - Yeni hasta
 * - PUT    /api/patients/{id}       - Hasta güncelle
 * - PATCH  /api/patients/{id}/archive - Hastayı arşivle
 * - DELETE /api/patients/{id}       - Hasta sil
 * - POST   /api/patients/{id}/vitals - Yaşam bulgusu ekle
 */
#[Group('/api/patients')]
#[Middleware(TenantMiddleware::class)]
class PatientController extends BaseController
{
    private PatientRepository $patientRepository;
    private PatientVitalsRepository $vitalsRepository;

    public function __construct(
        ContainerInterface $container,
        PatientRepository $patientRepository,
        PatientVitalsRepository $vitalsRepository
    ) {
        parent::__construct($container);
        $this->patientRepository = $patientRepository;
        $this->vitalsRepository = $vitalsRepository;
    }

    /**
     * Aktif hastaları listeler
     */
    #[Route('GET', '')]
    public function listPatients(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $patients = $this->patientRepository->findAll($clinicId);

        return $this->success($response, [
            'count' => count($patients),
            'patients' => $patients
        ]);
    }

    /**
     * Hasta detayını ve son yaşam bulgularını getirir
     */
    #[Route('GET', '/{id:[0-9]+}')]
    public function getPatient(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $patientId = (int) $args['id'];

        $patient = $this->patientRepository->findById($clinicId, $patientId);

        if (!$patient) {
            return $this->notFoundResponse($response, 'Hasta bulunamadı');
        }

        // Opsiyonel: Son 5 yaşam bulgusunu (vitals) yanıta ekle
        $vitalsHistory = $this->vitalsRepository->getHistory($clinicId, $patientId, 5);
        $patient['vitals_history'] = $vitalsHistory;

        return $this->success($response, $patient);
    }

    /**
     * Yeni hasta kaydı oluşturur
     */
    #[Route('POST', '')]
    public function createPatient(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $data = $request->getParsedBody();

        // Validasyon Kuralları
        $validator = v::key('name', v::stringType()->length(3))
            ->key('tc_no', v::digit()->length(11, 11))
            ->key('phone', v::stringType())
            ->key('email', v::optional(v::email()))
            ->key('birth_date', v::optional(v::date()))
            ->key('gender', v::optional(v::in(['M', 'F', 'U'])))
            ->key('blood_type', v::optional(v::in(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'])))
            ->key('address', v::optional(v::stringType()))
            ->key('notes', v::optional(v::stringType()));

        try {
            $validator->assert($data);

            $patientId = $this->patientRepository->create($clinicId, $data);

            return $this->createdResponse($response, [
                'id' => $patientId
            ], 'Hasta başarıyla oluşturuldu');

        } catch (\Respect\Validation\Exceptions\NestedValidationException $e) {
            return $this->validationErrorResponse($response, $e->getMessages());
        }
    }

    /**
     * Hasta bilgilerini günceller
     */
    #[Route('PUT', '/{id:[0-9]+}')]
    public function updatePatient(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $patientId = (int) $args['id'];
        $data = $request->getParsedBody();

        // Aynı validasyon kuralları geçerli
        $validator = v::key('name', v::stringType()->length(3))
            ->key('tc_no', v::digit()->length(11, 11))
            ->key('phone', v::stringType())
            ->key('email', v::optional(v::email()))
            ->key('birth_date', v::optional(v::date()))
            ->key('gender', v::optional(v::in(['M', 'F', 'U'])))
            ->key('blood_type', v::optional(v::in(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'])))
            ->key('address', v::optional(v::stringType()))
            ->key('notes', v::optional(v::stringType()));

        try {
            $validator->assert($data);

            $this->patientRepository->update($clinicId, $patientId, $data);

            return $this->success($response, null, 'Hasta bilgileri güncellendi');

        } catch (\Respect\Validation\Exceptions\NestedValidationException $e) {
            return $this->validationErrorResponse($response, $e->getMessages());
        }
    }

    /**
     * Hastaya yaşam bulgusu (Vital) ekler
     */
    #[Route('POST', '/{id:[0-9]+}/vitals')]
    public function addVital(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $patientId = (int) $args['id'];
        $data = $request->getParsedBody();

        // Validasyon
        $validator = v::key('height', v::optional(v::intVal()->positive()))
            ->key('weight', v::optional(v::numericVal()->positive()))
            ->key('systolic_bp', v::optional(v::intVal()->positive()))
            ->key('diastolic_bp', v::optional(v::intVal()->positive()))
            ->key('heart_rate', v::optional(v::intVal()->positive()));

        try {
            $validator->assert($data);

            // Ölçümü giren personel ID'sini (user_id) JWT payload'dan alabiliriz
            $data['created_by'] = $this->getUserId($request);

            $vitalId = $this->vitalsRepository->addVital($clinicId, $patientId, $data);

            return $this->createdResponse($response, [
                'id' => $vitalId
            ], 'Yaşam bulgusu başarıyla eklendi');

        } catch (\Respect\Validation\Exceptions\NestedValidationException $e) {
            return $this->validationErrorResponse($response, $e->getMessages());
        }
    }

    /**
     * Hastayı arşivler (status = 0)
     */
    #[Route('PATCH', '/{id:[0-9]+}/archive')]
    public function archivePatient(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $patientId = (int) $args['id'];

        $this->patientRepository->archive($clinicId, $patientId);

        return $this->success($response, null, 'Hasta arşivlendi');
    }

    /**
     * Hastayı tamamen siler
     */
    #[Route('DELETE', '/{id:[0-9]+}')]
    public function deletePatient(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $patientId = (int) $args['id'];

        $this->patientRepository->delete($clinicId, $patientId);

        return $this->success($response, null, 'Hasta tamamen silindi');
    }
}
