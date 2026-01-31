<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;
use App\Domain\File\FileService;
use App\Core\Service\SessionService;
use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Web\Middleware\SessionAuthMiddleware;

use App\Domain\Patient\PatientRepository;

#[Group('/admin')]
#[Middleware(SessionAuthMiddleware::class)]
class FileWebController
{
    private Twig $view;
    private FileService $fileService;
    private SessionService $session;
    private PatientRepository $patientRepository;

    public function __construct(
        Twig $view,
        FileService $fileService,
        SessionService $session,
        PatientRepository $patientRepository
    ) {
        $this->view = $view;
        $this->fileService = $fileService;
        $this->session = $session;
        $this->patientRepository = $patientRepository;
    }

    #[Route('GET', '/files')]
    public function index(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->session->get('clinic_id');
        $queryParams = $request->getQueryParams();

        $filters = [
            'module' => $queryParams['module'] ?? null,
            'type' => $queryParams['type'] ?? null,
            'limit' => 100
        ];

        if (!empty($queryParams['q'])) {
            $patients = $this->patientRepository->search($clinicId, $queryParams['q']);
            if (!empty($patients)) {
                $filters['patient_id'] = $patients[0]['id'];
            } else {
                $filters['patient_id'] = 0; // Bulunamadı
            }
        }

        // Verileri çek (SSR)
        $files = $this->fileService->searchFiles($clinicId, $filters);

        return $this->view->render($response, 'clinic_files.twig', [
            'files' => $files,
            'filters' => $queryParams,
            'pageTitle' => 'Dijital Arşiv',
            'page' => 'files' // Sidebar aktifliği için
        ]);
    }
}
