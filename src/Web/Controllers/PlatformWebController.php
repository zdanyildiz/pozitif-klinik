<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;
use App\Core\Attributes\Route;

/**
 * Platform (Süper Admin) Web Arayüzü
 * 
 * NOT: Bu controller üzerindeki rotalar CSRF korumalıdır (routes.php üzerinden).
 * Yetkilendirme kontrolü JS tarafında localStorage üzerinden yapılmaktadır.
 */
class PlatformWebController
{
    private Twig $view;

    public function __construct(Twig $view)
    {
        $this->view = $view;
    }

    /**
     * Platform Giriş Sayfası
     */
    #[Route('GET', '/platform/login')]
    public function loginPage(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'platform_login.twig', []);
    }

    /**
     * Platform Dashboard
     */
    #[Route('GET', '/platform/dashboard')]
    public function dashboard(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'platform_dashboard.twig', [
            'page' => 'dashboard'
        ]);
    }

    /**
     * Randevu Durumları Yönetimi
     */
    #[Route('GET', '/platform/appointment-statuses')]
    public function appointmentStatusesPage(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'platform_appointment_statuses.twig', [
            'page' => 'appointment-statuses'
        ]);
    }

    /**
     * Klinik (Tenant) Ayarları
     */
    #[Route('GET', '/platform/clinic-settings')]
    public function clinicSettings(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'platform_clinic_settings.twig', [
            'page' => 'settings'
        ]);
    }

    /**
     * Platform Log Görüntüleme Sayfası
     */
    #[Route('GET', '/platform/logs')]
    public function logsPage(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'platform_logs.twig', [
            'page' => 'logs'
        ]);
    }

    /**
     * Platform Yöneticileri Sayfası
     */
    #[Route('GET', '/platform/users')]
    public function usersPage(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'platform_users.twig', [
            'page' => 'users'
        ]);
    }
    /**
     * SMS Sağlayıcı Yönetimi Sayfası
     */
    #[Route('GET', '/platform/sms-providers')]
    public function smsProvidersPage(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'platform_sms_providers.twig', [
            'page' => 'sms-providers'
        ]);
    }
}
