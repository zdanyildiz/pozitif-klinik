<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;
use App\Domain\Patient\PatientRepository;
use App\Domain\System\GeneralRepository;
use App\Core\Service\SessionService;
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

    public function __construct(
        Twig $view,
        PatientRepository $repository,
        GeneralRepository $generalRepository,
        SessionService $session
    ) {
        $this->view = $view;
        $this->repository = $repository;
        $this->generalRepository = $generalRepository;
        $this->session = $session;
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
}
