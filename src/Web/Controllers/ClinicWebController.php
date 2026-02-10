<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;
use App\Core\Attributes\Route;
use App\Core\Attributes\Middleware;
use App\Web\Middleware\SessionAuthMiddleware;

class ClinicWebController
{
    private Twig $view;
    private \App\Core\Service\SessionService $session;
    private \App\Domain\Appointment\AppointmentRepository $appointmentRepository;
    private \App\Domain\Surgery\SurgeryRepository $surgeryRepository;
    private \App\Domain\User\UserRepository $userRepository;
    private \App\Domain\Platform\TenantRepository $tenantRepository;
    private \App\Domain\System\GeneralRepository $generalRepository;

    public function __construct(
        Twig $view,
        \App\Core\Service\SessionService $session,
        \App\Domain\Appointment\AppointmentRepository $appointmentRepository,
        \App\Domain\Surgery\SurgeryRepository $surgeryRepository,
        \App\Domain\User\UserRepository $userRepository,
        \App\Domain\Platform\TenantRepository $tenantRepository,
        \App\Domain\System\GeneralRepository $generalRepository
    ) {
        $this->view = $view;
        $this->session = $session;
        $this->appointmentRepository = $appointmentRepository;
        $this->surgeryRepository = $surgeryRepository;
        $this->userRepository = $userRepository;
        $this->tenantRepository = $tenantRepository;
        $this->generalRepository = $generalRepository;
    }

    /**
     * Klinik Dashboard
     */
    #[Route('GET', '/admin/dashboard')]
    #[Middleware(SessionAuthMiddleware::class)]
    public function dashboard(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->session->get('clinic_id');
        $dashboardStats = $this->appointmentRepository->getDashboardStats($clinicId);

        // Planlanan ameliyatları getir
        $plannedSurgeries = $this->surgeryRepository->list($clinicId, [
            'status' => 'planned',
            'start_date' => date('Y-m-d') // Bugünden itibaren olanlar
        ]);

        return $this->view->render($response, 'clinic_dashboard.twig', [
            'page' => 'dashboard',
            'stats' => $dashboardStats['stats'],
            'next_appointment' => $dashboardStats['next_appointment'],
            'planned_surgeries' => $plannedSurgeries
        ]);
    }

    /**
     * Klinik Randevu Yönetimi
     */
    #[Route('GET', '/admin/appointments')]
    #[Middleware(SessionAuthMiddleware::class)]
    public function appointments(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'clinic_appointments.twig', [
            'page' => 'appointments'
        ]);
    }

    /**
     * Klinik Personel Yönetimi
     */
    #[Route('GET', '/admin/personnel')]
    #[Middleware(SessionAuthMiddleware::class)]
    public function personnel(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->session->get('clinic_id');
        $users = $this->userRepository->findAll($clinicId);

        return $this->view->render($response, 'clinic_personnel.twig', [
            'page' => 'personnel',
            'users' => $users
        ]);
    }

    /**
     * Klinik Hizmet Tanımları
     */
    #[Route('GET', '/admin/services')]
    #[Middleware(SessionAuthMiddleware::class)]
    public function services(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'clinic_services.twig', [
            'page' => 'services'
        ]);
    }

    /**
     * Klinik Genel Ayarları
     */
    #[Route('GET', '/admin/settings')]
    #[Middleware(SessionAuthMiddleware::class)]
    public function settings(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->session->get('clinic_id');

        $settings = $this->tenantRepository->getBasicInfo($clinicId);
        $displayConfig = $this->tenantRepository->getDisplayConfig($clinicId);
        $provinces = $this->generalRepository->getProvinces();

        // Eğer displayConfig boşsa varsayılanları dolduralım (Frontend ile uyumlu)
        if (empty($displayConfig)) {
            $displayConfig = [
                'modules' => [
                    'surgery' => ['doctor' => true, 'secretary' => true],
                    'finance' => ['doctor' => true, 'admin' => true],
                    'personnel' => ['admin' => true]
                ],
                'patient_detail' => [
                    'show_finance' => ['admin' => true, 'secretary' => true],
                    'show_vitals' => ['doctor' => true, 'secretary' => true]
                ]
            ];
        }

        // Seçili ilin ilçelerini de getirelim (Interactivity için ilk yüklemede lazım olabilir ama JS zaten province change'de çekiyor)
        // Ancak SSR kuralına göre ilk yüklemede seçili olan gelmeli.
        $districts = [];
        if (!empty($settings['province_id'])) {
            $districts = $this->generalRepository->getDistricts((int) $settings['province_id']);
        }

        return $this->view->render($response, 'clinic_settings.twig', [
            'page' => 'settings',
            'settings' => $settings,
            'display_config' => $displayConfig,
            'provinces' => $provinces,
            'districts' => $districts
        ]);
    }

    /**
     * İşlem Geçmişi (Denetim Kayıtları)
     */
    #[Route('GET', '/admin/logs')]
    #[Middleware(SessionAuthMiddleware::class)]
    public function logs(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'clinic_logs.twig', [
            'page' => 'logs'
        ]);
    }

    /**
     * Muayene Ekranı
     */
    #[Route('GET', '/admin/examination')]
    #[Middleware(SessionAuthMiddleware::class)]
    public function examination(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'clinic_examination.twig', [
            'page' => 'examination',
            'appointment_id' => $request->getQueryParams()['appointment_id'] ?? null
        ]);
    }
}
