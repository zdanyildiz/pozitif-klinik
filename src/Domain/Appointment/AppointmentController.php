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

    /**
     * Randevuları listeler (Tarih filtresi ile)
     */
    #[Route('GET', '')]
    public function list(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $params = $request->getQueryParams();
        $date = $params['date'] ?? date('Y-m-d');

        $appointments = $this->repository->listDailyAppointments($clinicId, $date);

        return $this->success($response, [
            'date' => $date,
            'count' => count($appointments),
            'appointments' => $appointments
        ]);
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

            $id = $this->repository->createAppointment($clinicId, $data);

            return $this->createdResponse($response, ['id' => $id], 'Randevu başarıyla oluşturuldu');

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
}
