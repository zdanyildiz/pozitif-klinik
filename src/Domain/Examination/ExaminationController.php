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
use App\Domain\Lab\LabRepository;
use App\Domain\Platform\TenantRepository;

#[Group('/api/examinations')]
#[Middleware(TenantMiddleware::class)]
class ExaminationController extends BaseController
{
    private ExaminationRepository $repository;
    private AppointmentRepository $appointmentRepository;
    private FileRepository $fileRepository;
    private LabRepository $labRepository;
    private LoggerService $logger;
    private TenantRepository $tenantRepository;

    public function __construct(
        ContainerInterface $container,
        ExaminationRepository $repository,
        AppointmentRepository $appointmentRepository,
        FileRepository $fileRepository,
        LabRepository $labRepository,
        LoggerService $logger,
        TenantRepository $tenantRepository
    ) {
        parent::__construct($container);
        $this->repository = $repository;
        $this->appointmentRepository = $appointmentRepository;
        $this->fileRepository = $fileRepository;
        $this->labRepository = $labRepository;
        $this->logger = $logger;
        $this->tenantRepository = $tenantRepository;
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

        // Lab sonuçlarını çek ve appointment_id üzerinden eşleştir
        $labResults = $this->labRepository->findAllByPatient($clinicId, $patientId);
        $labsByAppointment = [];
        foreach ($labResults as $lab) {
            if (!empty($lab['appointment_id'])) {
                $labsByAppointment[$lab['appointment_id']][] = $lab;
            }
        }

        foreach ($examinations as &$exam) {
            $exam['lab_results'] = $labsByAppointment[$exam['appointment_id']] ?? [];
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

                if ($lastExam) {
                    // Eğer veri değişmediyse yeni kayıt açma, mevcut ID'yi dön
                    if (!$this->isDataChanged($lastExam, $data)) {
                        return $this->success($response, ['id' => $lastExam['id']], 'Değişiklik saptanmadı, mevcut kayıt korundu.');
                    }

                    // İş akışı ayarını kontrol et (Mevcut olanı mı güncelleyelim, yeni mi oluşturalım?)
                    $displayConfig = $this->tenantRepository->getDisplayConfig($clinicId);
                    $updateExisting = $displayConfig['workflow']['examination_update_existing'] ?? false;

                    if ($updateExisting) {
                        // Mevcut kaydı güncelle
                        $this->repository->update($clinicId, $lastExam['id'], $data);

                        $this->logger->getLogger($clinicId)->info("Muayene formu güncellendi (Revizyon Modu): ID " . $lastExam['id'], [
                            'user_id' => $userId,
                            'appointment_id' => $appointmentId
                        ]);

                        return $this->success($response, ['id' => $lastExam['id']], 'Muayene formu başarıyla güncellendi');
                    }
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
        $id = (int) $args['id'];
        $clinicId = $this->getClinicId($request);
        $userId = $this->getUserId($request);
        $data = $request->getParsedBody();

        // 1. Ayarı Kontrol Et
        $displayConfig = $this->tenantRepository->getDisplayConfig($clinicId);
        $canEditHistory = $displayConfig['workflow']['editable_patient_history'] ?? false;

        if ($canEditHistory) {
            // Doğrudan düzenlemeye izin verilmiş, eski kaydı bulalım
            $exam = $this->repository->findById($clinicId, $id);
            if (!$exam) {
                return $this->error($response, 'Muayene kaydı bulunamadı', 404);
            }

            // Doğrudan güncelle
            $this->repository->update($clinicId, $id, $data);

            $this->logger->getLogger($clinicId)->info("Geçmiş muayene kaydı düzenlendi (Zaman Tüneli): ID $id", [
                'user_id' => $userId,
                'patient_id' => $exam['patient_id'] ?? null
            ]);

            return $this->success($response, ['id' => $id], 'Geçmiş muayene kaydı başarıyla güncellendi.');
        }

        /**
         * Tıbbi Audit Trail prensibi gereği, 'güncelleme' isteğini de 
         * 'eğer veri değiştiyse yeni kayıt ekle' mantığına (progress note) yönlendiriyoruz.
         */
        return $this->createExamination($request, $response);
    }
}
