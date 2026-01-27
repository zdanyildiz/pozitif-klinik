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

    public function __construct(Twig $view)
    {
        $this->view = $view;
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
        return $this->view->render($response, 'clinic_personnel.twig', [
            'page' => 'personnel'
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
}
