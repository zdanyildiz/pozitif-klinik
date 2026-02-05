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
use App\Domain\Appointment\AppointmentRepository;
use App\Domain\File\FileRepository;

#[Group('/api/examinations')]
#[Middleware(TenantMiddleware::class)]
class ExaminationController extends BaseController
{
    private ExaminationRepository $repository;
    private AppointmentRepository $appointmentRepository;
    private FileRepository $fileRepository;
    private LoggerService $logger;

    public function __construct(
        ContainerInterface $container,
        ExaminationRepository $repository,
        AppointmentRepository $appointmentRepository,
        FileRepository $fileRepository,
        LoggerService $logger
    ) {
        parent::__construct($container);
        $this->repository = $repository;
        $this->appointmentRepository = $appointmentRepository;
        $this->fileRepository = $fileRepository;
        $this->logger = $logger;
    }

    #[Route('GET', '/{id:[0-9]+}')]
    public function getExamination(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $id = (int) $args['id'];
        $examination = $this->repository->findById($clinicId, $id);

        return $this->success($response, $examination);
    }

    #[Route('GET', '/patient/{patientId:[0-9]+}')]
    public function getPatientExaminations(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $patientId = (int) $args['patientId'];
        $examinations = $this->repository->findAllByPatient($clinicId, $patientId);

        // Muayenelere bağlı dosyaları çek
        $allFiles = $this->fileRepository->searchFiles($clinicId, [
            'patient_id' => $patientId,
            'module' => 'examination'
        ]);

        $filesByExam = [];
        foreach ($allFiles as $file) {
            $filesByExam[$file['related_id']][] = $file;
        }

        foreach ($examinations as &$exam) {
            $exam['files'] = $filesByExam[$exam['id']] ?? [];
        }

        return $this->success($response, $examinations);
    }

    #[Route('GET', '/appointment/{appointmentId:[0-9]+}')]
    public function getAppointmentExamination(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $appointmentId = (int) $args['appointmentId'];
        $examination = $this->repository->findByAppointmentId($clinicId, $appointmentId);

        return $this->success($response, $examination);
    }

    /**
     * Gelen veriyi son kayıtla karşılaştırarak değişiklik olup olmadığını kontrol eder.
     */
    private function isDataChanged(?array $lastRecord, array $newData): bool
    {
        if (!$lastRecord) {
            return true;
        }

        $fields = ['anamnez', 'complaint', 'story', 'bulgular', 'diagnosis', 'treatment', 'result_note', 'specialty_code', 'specialty_data'];

        foreach ($fields as $field) {
            $lastValue = $lastRecord[$field] ?? '';
            $newValue = $newData[$field] ?? '';

            // Boşlukları temizleyip karşılaştıralım (minik format farklarını yoksayalım)
            if (trim((string) $lastValue) !== trim((string) $newValue)) {
                return true;
            }
        }

        return false;
    }

    #[Route('POST', '')]
    public function createExamination(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();
        $clinicId = $this->getClinicId($request);
        $userId = $this->getUserId($request);
        $appointmentId = isset($data['appointment_id']) ? (int) $data['appointment_id'] : null;

        $data['clinic_id'] = $clinicId;
        $data['doctor_user_id'] = $userId;

        try {
            // Audit Trail Kontrolü: Aynı randevu için son kaydı al
            if ($appointmentId) {
                $lastExam = $this->repository->findByAppointmentId($clinicId, $appointmentId);

                // Eğer veri değişmediyse yeni kayıt açma, mevcut ID'yi dön
                if (!$this->isDataChanged($lastExam, $data)) {
                    return $this->success($response, ['id' => $lastExam['id']], 'Değişiklik saptanmadı, mevcut kayıt korundu.');
                }
            }

            $id = $this->repository->create($data);

            $this->logger->getLogger($clinicId)->info("Muayene ilerleme notu eklendi (Audit Trail): ID $id", [
                'user_id' => $userId,
                'patient_id' => $data['patient_id'] ?? null,
                'appointment_id' => $appointmentId
            ]);

            // Randevu durumunu 'işlemde/muayenede' (in_test) olarak güncelle
            if ($appointmentId) {
                $this->appointmentRepository->updateStatus($clinicId, $appointmentId, 'in_test', $userId);
            }

            return $this->createdResponse($response, ['id' => $id], 'Muayene ilerleme notu kaydedildi');
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    #[Route('PUT', '/{id:[0-9]+}')]
    public function updateExamination(Request $request, Response $response, array $args): Response
    {
        /**
         * Tıbbi Audit Trail prensibi gereği, 'güncelleme' isteğini de 
         * 'eğer veri değiştiyse yeni kayıt ekle' mantığına (progress note) yönlendiriyoruz.
         */
        return $this->createExamination($request, $response);
    }
}
