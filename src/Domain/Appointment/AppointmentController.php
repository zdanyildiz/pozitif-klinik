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

        if (isset($params['start_date']) && isset($params['end_date'])) {
            $appointments = $this->repository->listAppointmentsByRange($clinicId, $params['start_date'], $params['end_date']);
            return $this->success($response, [
                'range' => ['start' => $params['start_date'], 'end' => $params['end_date']],
                'appointments' => $appointments
            ]);
        }

        $date = $params['date'] ?? date('Y-m-d');
        $appointments = $this->repository->listDailyAppointments($clinicId, $date);

        return $this->success($response, [
            'date' => $date,
            'appointments' => $appointments
        ]);
    }

    /**
     * Belirli bir gün için uygun randevu slotlarını döner
     * 
     * Query Params:
     *   - date (zorunlu): YYYY-MM-DD formatında tarih
     *   - doctor_id (opsiyonel): Doktor filtresi
     *   - type_id (opsiyonel): Slot süresini randevu türüne göre belirle
     *   - slot_duration (opsiyonel): Özel slot süresi (dakika, varsayılan: 30)
     */
    #[Route('GET', '/available-slots')]
    public function getAvailableSlots(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $params = $request->getQueryParams();

        $date = $params['date'] ?? date('Y-m-d');
        $doctorId = !empty($params['doctor_id']) ? (int) $params['doctor_id'] : null;
        $excludeId = !empty($params['exclude_id']) ? (int) $params['exclude_id'] : null;

        // Slot süresini belirle
        $slotDuration = 30; // Varsayılan

        if (!empty($params['type_id'])) {
            $type = $this->repository->findTypeById($clinicId, (int) $params['type_id']);
            if ($type && $type['duration_minutes']) {
                $slotDuration = (int) $type['duration_minutes'];
            }
        } elseif (!empty($params['slot_duration'])) {
            $slotDuration = (int) $params['slot_duration'];
        }

        $slots = $this->repository->getAvailableSlots($clinicId, $date, $doctorId, $slotDuration, $excludeId);

        return $this->success($response, $slots);
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

        // Randevu türünün süresini al
        $type = $this->repository->findTypeById($clinicId, (int) $data['type_id']);
        $durationMinutes = $type ? ((int) $type['duration_minutes'] ?: 30) : 30;

        // 1. Çalışma Saatleri Kontrolü
        $workingHoursCheck = $this->repository->validateWorkingHours(
            $clinicId,
            $data['appointment_date'],
            $durationMinutes
        );

        if (!$workingHoursCheck['valid']) {
            return $this->error($response, $workingHoursCheck['message'], 400);
        }

        // 2. Çakışma Kontrolü (Doktor bazlı)
        $doctorId = isset($data['doctor_id']) ? (int) $data['doctor_id'] : null;
        $conflict = $this->repository->hasConflict(
            $clinicId,
            $doctorId,
            $data['appointment_date'],
            $durationMinutes
        );

        if ($conflict) {
            $message = sprintf(
                'Bu doktorun %s saatleri arasında "%s" için randevusu var (%s).',
                $conflict['existing_time_range'],
                $conflict['patient_name'],
                $conflict['type_name']
            );
            return $this->error($response, $message, 409);
        }

        $userId = (int) $this->getUserId($request);
        $id = $this->repository->createAppointment($clinicId, $data, $userId);

        $this->getLogger($clinicId)->info('Appointment created', [
            'appointment_id' => $id,
            'user_id' => $userId
        ]);

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

        if ($data['status'] === 'completed') {
            $check = $this->repository->canMarkAsCompleted($clinicId, $appointmentId);
            if (!$check['can']) {
                return $this->error($response, $check['message'], 400);
            }
        }

        $userId = (int) $this->getUserId($request);
        $this->repository->updateStatus($clinicId, $appointmentId, $data['status'], $userId);

        $this->getLogger($clinicId)->info('Appointment status updated', [
            'appointment_id' => $appointmentId,
            'status' => $data['status'],
            'user_id' => $userId
        ]);

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

        // Randevu türünün süresini al
        $type = $this->repository->findTypeById($clinicId, (int) $data['type_id']);
        $durationMinutes = $type ? ((int) $type['duration_minutes'] ?: 30) : 30;

        // 1. Çalışma Saatleri Kontrolü
        $workingHoursCheck = $this->repository->validateWorkingHours(
            $clinicId,
            $data['appointment_date'],
            $durationMinutes
        );

        if (!$workingHoursCheck['valid']) {
            return $this->error($response, $workingHoursCheck['message'], 400);
        }

        // 2. Çakışma Kontrolü (Doktor bazlı, mevcut randevu hariç)
        $doctorId = isset($data['doctor_id']) ? (int) $data['doctor_id'] : null;
        $conflict = $this->repository->hasConflict(
            $clinicId,
            $doctorId,
            $data['appointment_date'],
            $durationMinutes,
            $appointmentId // Mevcut randevuyu hariç tut
        );

        if ($conflict) {
            $message = sprintf(
                'Bu doktorun %s saatleri arasında "%s" için randevusu var (%s).',
                $conflict['existing_time_range'],
                $conflict['patient_name'],
                $conflict['type_name']
            );
            return $this->error($response, $message, 409);
        }

        if (isset($data['status']) && $data['status'] === 'completed') {
            $check = $this->repository->canMarkAsCompleted($clinicId, $appointmentId);
            if (!$check['can']) {
                return $this->error($response, $check['message'], 400);
            }
        }

        $this->repository->updateAppointment($clinicId, $appointmentId, $data);

        $this->getLogger($clinicId)->info('Appointment updated', [
            'appointment_id' => $appointmentId,
            'user_id' => $this->getUserId($request)
        ]);

        return $this->success($response, null, 'Randevu güncellendi.');
    }

    #[Route('DELETE', '/{id:[0-9]+}')]
    public function delete(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];
        $userId = (int) $this->getUserId($request);

        $this->repository->deleteAppointment($clinicId, $appointmentId, $userId);

        $this->getLogger($clinicId)->warning('Appointment deleted', [
            'appointment_id' => $appointmentId,
            'user_id' => $userId
        ]);

        return $this->success($response, null, 'Randevu silindi.');
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

        $userId = (int) $this->getUserId($request);
        $itemId = $this->repository->addItem($clinicId, $appointmentId, $data, $userId);

        $this->getLogger($clinicId)->info('Appointment item added', [
            'appointment_id' => $appointmentId,
            'item_id' => $itemId,
            'user_id' => $userId
        ]);

        return $this->success($response, ['id' => $itemId], 'Hizmet eklendi.');
    }

    #[Route('DELETE', '/{id:[0-9]+}/items/{itemId:[0-9]+}')]
    public function removeItem(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];
        $itemId = (int) $args['itemId'];
        $userId = (int) $this->getUserId($request);

        $this->repository->removeItem($clinicId, $appointmentId, $itemId, $userId);

        $this->getLogger($clinicId)->info('Appointment item removed', [
            'appointment_id' => $appointmentId,
            'item_id' => $itemId,
            'user_id' => $userId
        ]);

        return $this->success($response, null, 'Hizmet silindi.');
    }

    #[Route('PUT', '/{id:[0-9]+}/items/{itemId:[0-9]+}')]
    public function updateItem(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];
        $itemId = (int) $args['itemId'];
        $data = $request->getParsedBody();

        if (empty($data['item_name']) || empty($data['unit_price'])) {
            return $this->error($response, 'Hizmet adı ve fiyat gereklidir.', 400);
        }

        $calcTotal = ($data['unit_price'] * ($data['quantity'] ?? 1));

        // Frontend total_price gönderiyorsa ona güvenilebilir, ama backend doğrulaması daha iyidir.
        // Ancak indirim varsa iş değişir.
        // İstemci tarafında: total_price = (unit * qty)
        // İndirim backend'de ayrı tutuluyor.
        $data['total_price'] = $calcTotal;

        $userId = (int) $this->getUserId($request);
        $this->repository->updateItem($clinicId, $appointmentId, $itemId, $data, $userId);

        return $this->success($response, null, 'Hizmet güncellendi.');
    }

    #[Route('PUT', '/{id:[0-9]+}/discount')]
    public function updateDiscount(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['id'];
        $data = $request->getParsedBody();

        $amount = (float) ($data['amount'] ?? 0);
        $note = $data['note'] ?? null;
        $userId = (int) $this->getUserId($request);

        $this->repository->updateGeneralDiscount($clinicId, $appointmentId, $amount, $note, $userId);

        return $this->success($response, null, 'Genel indirim güncellendi.');
    }

    #[Route('GET', '/statuses')]
    public function listStatuses(Request $request, Response $response): Response
    {
        $statuses = $this->repository->listStatuses();
        return $this->success($response, $statuses);
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

        $this->getLogger($clinicId)->info('Appointment type created', [
            'type_id' => $id,
            'user_id' => $this->getUserId($request)
        ]);

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

        $this->getLogger($clinicId)->info('Appointment type updated', [
            'type_id' => $typeId,
            'user_id' => $this->getUserId($request)
        ]);

        return $this->success($response, null, 'Randevu türü güncellendi.');
    }

    #[Route('DELETE', '/types/{id:[0-9]+}')]
    public function deleteType(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $typeId = (int) $args['id'];

        try {
            $this->repository->deleteType($clinicId, $typeId);

            $this->getLogger($clinicId)->warning('Appointment type deleted', [
                'type_id' => $typeId,
                'user_id' => $this->getUserId($request)
            ]);

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
