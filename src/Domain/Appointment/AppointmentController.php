<?php

declare(strict_types=1);

namespace App\Domain\Appointment;

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
 * AppointmentController - Randevu Yönetimi API
 * 
 * Randevu CRUD işlemleri ve tür yönetimi.
 * Tüm rotalar TenantMiddleware ile korunur.
 * 
 * @package App\Domain\Appointment
 */
#[Group('/api/appointments')]
#[Middleware(TenantMiddleware::class)]
class AppointmentController extends BaseController
{
    private AppointmentRepository $repository;

    public function __construct(ContainerInterface $container, AppointmentRepository $repository)
    {
        parent::__construct($container);
        $this->repository = $repository;
    }

    // ==========================================
    // RANDEVU İŞLEMLERİ
    // ==========================================

    /**
     * Randevuları listeler (Tarih filtresi ile)
     * 
     * Query Params:
     * - date: YYYY-MM-DD formatında tarih (varsayılan: bugün)
     * - start_date & end_date: Tarih aralığı (opsiyonel)
     */
    #[Route('GET', '')]
    public function list(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $params = $request->getQueryParams();

        // Tarih aralığı veya tek tarih
        if (isset($params['start_date']) && isset($params['end_date'])) {
            $appointments = $this->repository->listAppointmentsByDateRange(
                $clinicId,
                $params['start_date'],
                $params['end_date']
            );
        } else {
            $date = $params['date'] ?? date('Y-m-d');
            $appointments = $this->repository->listDailyAppointments($clinicId, $date);
        }

        return $this->success($response, [
            'date' => $params['date'] ?? date('Y-m-d'),
            'count' => count($appointments),
            'appointments' => $appointments
        ]);
    }

    /**
     * Tek bir randevuyu getirir
     */
    #[Route('GET', '/{id:[0-9]+}')]
    public function get(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];

        $appointment = $this->repository->findById($clinicId, $appointmentId);

        if (!$appointment) {
            return $this->notFoundResponse($response, 'Randevu bulunamadı');
        }

        return $this->success($response, $appointment);
    }

    /**
     * Yeni randevu oluşturur
     */
    #[Route('POST', '')]
    public function create(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $data = $request->getParsedBody();

        $validator = v::key('patient_id', v::intVal()->positive())
            ->key('type_id', v::intVal()->positive())
            ->key('appointment_date', v::dateTime())
            ->key('doctor_id', v::optional(v::intVal()->positive()))
            ->key('notes', v::optional(v::stringType()));

        try {
            $validator->assert($data);

            // Çakışma kontrolü
            $doctorId = isset($data['doctor_id']) ? (int) $data['doctor_id'] : null;
            if ($this->repository->checkConflict($clinicId, $data['appointment_date'], $doctorId)) {
                return $this->error($response, 'Bu zaman diliminde doktorun başka bir randevusu var', 409);
            }

            $id = $this->repository->createAppointment($clinicId, $data);

            return $this->createdResponse($response, ['id' => $id], 'Randevu başarıyla oluşturuldu');

        } catch (\Respect\Validation\Exceptions\NestedValidationException $e) {
            return $this->validationErrorResponse($response, $e->getMessages());
        }
    }

    /**
     * Randevuyu günceller
     */
    #[Route('PUT', '/{id:[0-9]+}')]
    public function update(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];
        $data = $request->getParsedBody();

        $validator = v::key('patient_id', v::intVal()->positive())
            ->key('type_id', v::intVal()->positive())
            ->key('appointment_date', v::dateTime())
            ->key('doctor_id', v::optional(v::intVal()->positive()))
            ->key('notes', v::optional(v::stringType()));

        try {
            $validator->assert($data);

            // Mevcut randevuyu kontrol et
            $existing = $this->repository->findById($clinicId, $appointmentId);
            if (!$existing) {
                return $this->notFoundResponse($response, 'Randevu bulunamadı');
            }

            // Çakışma kontrolü (kendi ID'sini hariç tut)
            $doctorId = isset($data['doctor_id']) ? (int) $data['doctor_id'] : null;
            if ($this->repository->checkConflict($clinicId, $data['appointment_date'], $doctorId, $appointmentId)) {
                return $this->error($response, 'Bu zaman diliminde doktorun başka bir randevusu var', 409);
            }

            $this->repository->updateAppointment($clinicId, $appointmentId, $data);

            return $this->success($response, null, 'Randevu başarıyla güncellendi');

        } catch (\Respect\Validation\Exceptions\NestedValidationException $e) {
            return $this->validationErrorResponse($response, $e->getMessages());
        }
    }

    /**
     * Randevu durumunu günceller
     */
    #[Route('PUT', '/{id:[0-9]+}/status')]
    public function updateStatus(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];
        $data = $request->getParsedBody();

        $validator = v::key('status', v::in(['pending', 'confirmed', 'waiting', 'in_test', 'completed', 'cancelled', 'no_show']));

        try {
            $validator->assert($data);

            $this->repository->updateStatus($clinicId, $appointmentId, $data['status']);

            return $this->success($response, null, 'Randevu durumu güncellendi');

        } catch (\Respect\Validation\Exceptions\NestedValidationException $e) {
            return $this->validationErrorResponse($response, $e->getMessages());
        }
    }

    /**
     * Randevuyu siler
     */
    #[Route('DELETE', '/{id:[0-9]+}')]
    public function delete(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];

        // Mevcut randevuyu kontrol et
        $existing = $this->repository->findById($clinicId, $appointmentId);
        if (!$existing) {
            return $this->notFoundResponse($response, 'Randevu bulunamadı');
        }

        $this->repository->deleteAppointment($clinicId, $appointmentId);

        return $this->success($response, null, 'Randevu başarıyla silindi');
    }

    // ==========================================
    // RANDEVU TÜRLERİ
    // ==========================================

    /**
     * Randevu türlerini listeler (Dropdown için)
     */
    #[Route('GET', '/types')]
    public function listTypes(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $types = $this->repository->listTypes($clinicId);

        return $this->success($response, $types);
    }

    /**
     * Yeni randevu türü ekler
     */
    #[Route('POST', '/types')]
    public function createType(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $data = $request->getParsedBody();

        $validator = v::key('name', v::stringType()->length(1))
            ->key('color_code', v::optional(v::stringType()))
            ->key('duration_minutes', v::optional(v::intVal()->positive()));

        try {
            $validator->assert($data);

            $id = $this->repository->createType($clinicId, $data);

            return $this->createdResponse($response, ['id' => $id], 'Randevu türü başarıyla oluşturuldu');

        } catch (\Respect\Validation\Exceptions\NestedValidationException $e) {
            return $this->validationErrorResponse($response, $e->getMessages());
        }
    }

    /**
     * Randevu türünü günceller
     */
    #[Route('PUT', '/types/{id:[0-9]+}')]
    public function updateType(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $typeId = (int) $args['id'];
        $data = $request->getParsedBody();

        $validator = v::key('name', v::stringType()->length(1))
            ->key('color_code', v::optional(v::stringType()))
            ->key('duration_minutes', v::optional(v::intVal()->positive()));

        try {
            $validator->assert($data);

            // Mevcut türü kontrol et
            $existing = $this->repository->findTypeById($clinicId, $typeId);
            if (!$existing) {
                return $this->notFoundResponse($response, 'Randevu türü bulunamadı');
            }

            $this->repository->updateType($clinicId, $typeId, $data);

            return $this->success($response, null, 'Randevu türü güncellendi');

        } catch (\Respect\Validation\Exceptions\NestedValidationException $e) {
            return $this->validationErrorResponse($response, $e->getMessages());
        }
    }

    /**
     * Randevu türünü siler (soft delete)
     */
    #[Route('DELETE', '/types/{id:[0-9]+}')]
    public function deleteType(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $typeId = (int) $args['id'];

        // Mevcut türü kontrol et
        $existing = $this->repository->findTypeById($clinicId, $typeId);
        if (!$existing) {
            return $this->notFoundResponse($response, 'Randevu türü bulunamadı');
        }

        $this->repository->deleteType($clinicId, $typeId);

        return $this->success($response, null, 'Randevu türü silindi');
    }

    // ==========================================
    // İSTATİSTİKLER
    // ==========================================

    /**
     * Bugünkü randevu sayısını getirir
     */
    #[Route('GET', '/stats/today')]
    public function todayStats(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);

        $todayCount = $this->repository->countTodayAppointments($clinicId);
        $pendingCount = $this->repository->countPendingAppointments($clinicId);

        return $this->success($response, [
            'today' => $todayCount,
            'pending' => $pendingCount
        ]);
    }

    /**
     * Hastanın randevularını listeler
     */
    #[Route('GET', '/patient/{patientId:[0-9]+}')]
    public function patientAppointments(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $patientId = (int) $args['patientId'];

        $appointments = $this->repository->listPatientAppointments($clinicId, $patientId);

        return $this->success($response, [
            'patient_id' => $patientId,
            'count' => count($appointments),
            'appointments' => $appointments
        ]);
    }
}
