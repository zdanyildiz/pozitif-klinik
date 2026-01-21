<?php

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;
use App\Domain\Patient\PatientRepository;
use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;

#[Group('/admin')]
#[Middleware(\App\Web\Middleware\SessionAuthMiddleware::class)]
class PatientWebController
{
    private Twig $view;
    private PatientRepository $repository;

    public function __construct(Twig $view, PatientRepository $repository)
    {
        $this->view = $view;
        $this->repository = $repository;
    }

    #[Route('GET', '/patients')]
    public function index(Request $request, Response $response): Response
    {
        // 1. Veriyi Çek
        // Session'dan clinic_id'yi al (Middleware bu kontrolü yaptığı için burada var varsayıyoruz)
        $clinicId = $_SESSION['clinic_id'];
        $patients = $this->repository->findAll($clinicId);

        // 2. View'a Gönder
        return $this->view->render($response, 'patients.twig', [
            'patients' => $patients,
            'pageTitle' => 'Hasta Listesi',
            'page' => 'patients' // for active sidebar
        ]);
    }
}
