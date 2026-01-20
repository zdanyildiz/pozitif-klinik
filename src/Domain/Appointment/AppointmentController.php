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
 * AppointmentController - Randevu ve Adisyon Yönetimi
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

    #[Route('GET', '')]
    public function list(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $params = $request->getQueryParams();

        $date = $params['date'] ?? date('Y-m-d');
        $appointments = $this->repository->listDailyAppointments($clinicId, $date);

        return $this->success($response, [
            'date' => $date,
            'appointments' => $appointments
        ]);
    }

    #[Route('GET', '/{id:[0-9]+}')]
    public function get(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];

        $appointment = $this->repository->findById($clinicId, $appointmentId);

        if (!$appointment) {
            return $this->error($response, 'Randevu bulunamadı', 404);
        }

        return $this->success($response, $appointment);
    }

    #[Route('POST', '')]
    public function create(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $data = $request->getParsedBody();

        if (empty($data['patient_id']) || empty($data['type_id']) || empty($data['appointment_date'])) {
            return $this->error($response, 'Eksik bilgi: Hasta, Tür ve Tarih zorunludur.', 400);
        }

        $id = $this->repository->createAppointment($clinicId, $data);
        return $this->success($response, ['id' => $id], 'Randevu oluşturuldu.', 201);
    }

    #[Route('PUT', '/{id:[0-9]+}/status')]
    public function updateStatus(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];
        $data = $request->getParsedBody();

        if (empty($data['status'])) {
            return $this->error($response, 'Durum bilgisi eksik.', 400);
        }

        $this->repository->updateStatus($clinicId, $appointmentId, $data['status']);
        return $this->success($response, null, 'Randevu durumu güncellendi.');
    }

    #[Route('PUT', '/{id:[0-9]+}')]
    public function update(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];
        $data = $request->getParsedBody();

        if (empty($data['type_id']) || empty($data['appointment_date'])) {
            return $this->error($response, 'Eksik bilgi: Tür ve Tarih zorunludur.', 400);
        }

        $this->repository->updateAppointment($clinicId, $appointmentId, $data);
        return $this->success($response, null, 'Randevu güncellendi.');
    }

    // ==========================================
    // ADİSYON (ITEM) İŞLEMLERİ
    // ==========================================

    #[Route('POST', '/{id:[0-9]+}/items')]
    public function addItem(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];
        $data = $request->getParsedBody();

        if (empty($data['item_name']) || empty($data['unit_price'])) {
            return $this->error($response, 'Hizmet adı ve fiyat gereklidir.', 400);
        }

        $data['total_price'] = ($data['unit_price'] * ($data['quantity'] ?? 1));

        $itemId = $this->repository->addItem($clinicId, $appointmentId, $data);
        return $this->success($response, ['id' => $itemId], 'Hizmet eklendi.');
    }

    #[Route('DELETE', '/{id:[0-9]+}/items/{itemId:[0-9]+}')]
    public function removeItem(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];
        $itemId = (int) $args['itemId'];

        $this->repository->removeItem($clinicId, $appointmentId, $itemId);
        return $this->success($response, null, 'Hizmet silindi.');
    }

    // ==========================================
    // RANDEVU TÜRLERİ
    // ==========================================

    #[Route('GET', '/types')]
    public function listTypes(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $types = $this->repository->listTypes($clinicId);
        return $this->success($response, $types);
    }

    #[Route('POST', '/types')]
    public function createType(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $data = $request->getParsedBody();

        if (empty($data['name'])) {
            return $this->error($response, 'Tür adı gereklidir.', 400);
        }

        $id = $this->repository->createType($clinicId, $data);
        return $this->success($response, ['id' => $id], 'Randevu türü oluşturuldu.', 201);
    }

    #[Route('PUT', '/types/{id:[0-9]+}')]
    public function updateType(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $typeId = (int) $args['id'];
        $data = $request->getParsedBody();

        if (empty($data['name'])) {
            return $this->error($response, 'Tür adı gereklidir.', 400);
        }

        $this->repository->updateType($clinicId, $typeId, $data);
        return $this->success($response, null, 'Randevu türü güncellendi.');
    }

    #[Route('DELETE', '/types/{id:[0-9]+}')]
    public function deleteType(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $typeId = (int) $args['id'];

        try {
            $this->repository->deleteType($clinicId, $typeId);
            return $this->success($response, null, 'Randevu türü silindi.');
        } catch (\Exception $e) {
            return $this->error($response, 'Bu tür silinemez, kullanımda olabilir.', 400);
        }
    }

    #[Route('GET', '/stats/today')]
    public function getStats(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $date = date('Y-m-d');
        $stats = $this->repository->getStats($clinicId, $date);

        return $this->success($response, $stats);
    }
}
