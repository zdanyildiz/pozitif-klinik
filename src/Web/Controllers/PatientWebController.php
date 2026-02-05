<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;
use App\Domain\Patient\PatientRepository;
use App\Domain\System\GeneralRepository;
use App\Core\Service\SessionService;
use App\Domain\Appointment\AppointmentRepository;
use App\Domain\Examination\ExaminationRepository;
use App\Domain\Lab\LabRepository;
use App\Domain\Finance\PaymentRepository;
use App\Domain\File\FileRepository;
use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;

#[Group('/admin')]
#[Middleware(\App\Web\Middleware\SessionAuthMiddleware::class)]
class PatientWebController
{
    private Twig $view;
    private PatientRepository $repository;
    private GeneralRepository $generalRepository;
    private SessionService $session;
    private AppointmentRepository $appointmentRepository;
    private ExaminationRepository $examinationRepository;
    private LabRepository $labRepository;
    private PaymentRepository $paymentRepository;
    private FileRepository $fileRepository;

    public function __construct(
        Twig $view,
        PatientRepository $repository,
        GeneralRepository $generalRepository,
        SessionService $session,
        AppointmentRepository $appointmentRepository,
        ExaminationRepository $examinationRepository,
        LabRepository $labRepository,
        PaymentRepository $paymentRepository,
        FileRepository $fileRepository
    ) {
        $this->view = $view;
        $this->repository = $repository;
        $this->generalRepository = $generalRepository;
        $this->session = $session;
        $this->appointmentRepository = $appointmentRepository;
        $this->examinationRepository = $examinationRepository;
        $this->labRepository = $labRepository;
        $this->paymentRepository = $paymentRepository;
        $this->fileRepository = $fileRepository;
    }

    #[Route('GET', '/patients')]
    public function index(Request $request, Response $response): Response
    {
        // 1. Veriyi Çek
        $clinicId = (int) $this->session->get('clinic_id');

        $patients = $this->repository->findAll($clinicId);
        $stats = $this->repository->getStats($clinicId);
        $provinces = $this->generalRepository->getProvinces();

        // 2. View'a Gönder
        return $this->view->render($response, 'patients.twig', [
            'patients' => $patients,
            'stats' => $stats,
            'provinces' => $provinces,
            'pageTitle' => 'Hasta Listesi',
            'page' => 'patients' // for active sidebar
        ]);
    }

    #[Route('GET', '/patients/{id}')]
    public function detail(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->session->get('clinic_id');
        $patientId = (int) $args['id'];

        // 1. Hasta Detayı
        $patient = $this->repository->findById($clinicId, $patientId);

        if (!$patient) {
            return $response->withHeader('Location', '/admin/patients')->withStatus(302);
        }

        // 2. Geçmiş Randevular (Timeline için temel)
        $appointments = $this->appointmentRepository->findAllByPatient($clinicId, $patientId);

        // 3. Finansal Özet (YENİ SİSTEM)
        $financeStats = $this->paymentRepository->getPatientBalance($clinicId, $patientId);
        $totalDebt = $financeStats['total_debt'];
        $totalPaid = $financeStats['total_paid'];
        $balance = $financeStats['balance'];

        // 4. Muayene Kayıtları
        $examinations = $this->examinationRepository->findAllByPatient($clinicId, $patientId);

        // 4. Laboratuvar Sonuçları
        $labResults = $this->labRepository->findAllByPatient($clinicId, $patientId);

        // 5. Dosyalar (Tüm dökümanları çek ve grupla)
        $allFiles = $this->fileRepository->searchFiles($clinicId, ['patient_id' => $patientId]);
        $filesByModule = [];
        foreach ($allFiles as $file) {
            $filesByModule[$file['module']][$file['related_id']][] = $file;
        }

        // 6. Hibrit Zaman Tüneli Hazırlığı
        $timeline = [];
        $mappedExamIds = [];

        // 1. Randevuları baz alarak eşleşen muayeneleri bağla
        $examMap = [];
        foreach ($examinations as $exam) {
            if (!empty($exam['appointment_id'])) {
                $examMap[$exam['appointment_id']] = $exam;
            }
        }

        foreach ($appointments as $appt) {
            $exam = $examMap[$appt['id']] ?? null;
            if ($exam) {
                $mappedExamIds[] = $exam['id'];
            }

            $timeline[] = [
                'entry_type' => 'appointment',
                'date' => $appt['appointment_date'],
                'doctor_name' => $appt['doctor_name'],
                'title' => $appt['type_name'],
                'color' => $appt['color_code'] ?? '#6366f1',
                'status_name' => $appt['status_name'] ?? $appt['status'],
                'status_color' => $appt['status_color'] ?? '#6c757d',
                'notes' => $appt['notes'],
                'appointment_id' => $appt['id'],
                'examination' => $exam,
                'files' => array_merge(
                    $filesByModule['appointment'][$appt['id']] ?? [],
                    $exam ? ($filesByModule['examination'][$exam['id']] ?? []) : []
                )
            ];
        }

        // 2. Herhangi bir randevuya bağlı OLMAYAN muayeneleri ekle
        foreach ($examinations as $exam) {
            if (!in_array($exam['id'], $mappedExamIds)) {
                $timeline[] = [
                    'entry_type' => 'examination',
                    'date' => $exam['created_at'],
                    'doctor_name' => $exam['doctor_name'] ?? 'Doktor Notu',
                    'title' => 'Tıbbi Muayene Kaydı',
                    'color' => '#10b981',
                    'status_name' => 'Tamamlandı',
                    'status_color' => '#10b981',
                    'notes' => $exam['complaint'],
                    'examination_id' => $exam['id'],
                    'examination' => $exam,
                    'files' => $filesByModule['examination'][$exam['id']] ?? []
                ];
            }
        }

        // 3. Tarihe göre sırala (Yeniden Eskiye)
        usort($timeline, function ($a, $b) {
            return strcmp($b['date'], $a['date']);
        });

        return $this->view->render($response, 'patient_detail.twig', [
            'patient' => $patient,
            'timeline' => $timeline,
            'labResults' => $labResults,
            'totalDebt' => $totalDebt,
            'totalPaid' => $totalPaid,
            'balance' => $balance,
            'pageTitle' => $patient['name'] . ' - Hasta Detayı',
            'page' => 'patients'
        ]);
    }
}
