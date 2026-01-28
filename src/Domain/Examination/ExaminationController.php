<?php

declare(strict_types=1);

namespace App\Domain\Examination;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Core\Attributes\Route;
use App\Core\Attributes\Middleware;
use App\Core\Attributes\Group;
use App\Core\BaseController;
use App\Middleware\TenantMiddleware;
use App\Core\Service\LoggerService;
use Psr\Container\ContainerInterface;

#[Group('/api/examinations')]
#[Middleware(TenantMiddleware::class)]
class ExaminationController extends BaseController
{
    private ExaminationRepository $repository;
    private LoggerService $logger;

    public function __construct(ContainerInterface $container, ExaminationRepository $repository, LoggerService $logger)
    {
        parent::__construct($container);
        $this->repository = $repository;
        $this->logger = $logger;
    }

    #[Route('GET', '/patient/{patientId:[0-9]+}')]
    public function getPatientExaminations(Request $request, Response $response, array $args): Response
    {
        $patientId = (int) $args['patientId'];
        $examinations = $this->repository->findAllByPatient($patientId);

        return $this->success($response, $examinations);
    }

    #[Route('GET', '/appointment/{appointmentId:[0-9]+}')]
    public function getAppointmentExamination(Request $request, Response $response, array $args): Response
    {
        $appointmentId = (int) $args['appointmentId'];
        $examination = $this->repository->findByAppointmentId($appointmentId);

        return $this->success($response, $examination);
    }

    #[Route('POST', '')]
    public function createExamination(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();
        $clinicId = $this->getClinicId($request);
        $userId = $this->getUserId($request);

        $data['clinic_id'] = $clinicId;
        $data['doctor_user_id'] = $userId;

        try {
            $id = $this->repository->create($data);

            $this->logger->getLogger($clinicId)->info("Yeni muayene kaydı oluşturuldu: ID $id", [
                'user_id' => $userId,
                'patient_id' => $data['patient_id'],
                'appointment_id' => $data['appointment_id'] ?? null
            ]);

            return $this->createdResponse($response, ['id' => $id], 'Muayene kaydedildi');
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    #[Route('PUT', '/{id:[0-9]+}')]
    public function updateExamination(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];
        $data = $request->getParsedBody();
        $clinicId = $this->getClinicId($request);

        try {
            $success = $this->repository->update($id, $data);

            if ($success) {
                $this->logger->getLogger($clinicId)->info("Muayene kaydı güncellendi: ID $id");
                return $this->success($response, null, 'Güncellendi');
            }

            return $this->error($response, 'Güncellenemedi');
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }
}
