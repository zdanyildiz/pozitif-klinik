<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;
use App\Core\Attributes\Route;

class PlatformWebController
{
    private Twig $view;

    public function __construct(Twig $view)
    {
        $this->view = $view;
    }

    /**
     * Platform (Süper Admin) Giriş Sayfası
     */
    #[Route('GET', '/platform/login')]
    public function loginPage(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'platform_login.twig', []);
    }

    /**
     * Platform (Süper Admin) Dashboard
     */
    #[Route('GET', '/platform/dashboard')]
    public function dashboard(Request $request, Response $response): Response
    {
        // Not: Token kontrolü JS tarafında yapılıyor (Legacy uyumluluk)
        return $this->view->render($response, 'platform_dashboard.twig', []);
    }

    /**
     * Klinik (Tenant) Ayarları
     */
    #[Route('GET', '/platform/clinic-settings')]
    public function clinicSettings(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'platform_clinic_settings.twig', []);
    }
}
