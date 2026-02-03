<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;
use App\Domain\Surgery\SurgeryRepository;
use App\Domain\User\UserRepository;
use App\Core\Service\SessionService;
use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;

#[Group('/admin')]
#[Middleware(\App\Web\Middleware\SessionAuthMiddleware::class)]
class SurgeryWebController
{
    private Twig $view;
    private SurgeryRepository $repository;
    private UserRepository $userRepository;
    private SessionService $session;

    public function __construct(
        Twig $view,
        SurgeryRepository $repository,
        UserRepository $userRepository,
        SessionService $session
    ) {
        $this->view = $view;
        $this->repository = $repository;
        $this->userRepository = $userRepository;
        $this->session = $session;
    }

    #[Route('GET', '/surgeries')]
    public function index(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->session->get('clinic_id');
        $params = $request->getQueryParams();

        // Varsayılan olarak bugünden itibaren olan planlı ameliyatlar veya tümü
        $surgeries = $this->repository->list($clinicId, $params);

        // Doktor listesi (Dropdown için)
        $doctors = $this->userRepository->listUsers($clinicId, 'doctor');

        return $this->view->render($response, 'clinic_surgeries.twig', [
            'surgeries' => $surgeries,
            'doctors' => $doctors,
            'pageTitle' => 'Ameliyat Takibi',
            'page' => 'surgeries',
            'filters' => $params
        ]);
    }
}
