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

        // İstatistikleri çek ve formatla
        $rawCounts = $this->fileService->getFileCounts($clinicId);
        $stats = [
            'total' => 0,
            'patient' => 0,
            'examination' => 0,
            'lab' => 0,
            'other' => 0
        ];

        foreach ($rawCounts as $c) {
            $stats[$c['module']] = $c['count'];
            $stats['total'] += $c['count'];
        }

        // Sayfa ilk yüklendiğinde dosya listesi boş olsun (Kullanıcı etkileşimi bekleniyor)
        $files = [];

        return $this->view->render($response, 'clinic_files.twig', [
            'files' => $files,
            'stats' => $stats,
            'filters' => $queryParams,
            'pageTitle' => 'Dijital Arşiv',
            'page' => 'files'
        ]);
    }
}
