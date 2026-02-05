<?php

declare(strict_types=1);

namespace App\Web\Controllers\Platform;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;

use App\Middleware\PlatformAdminMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;
use App\Domain\Platform\MedicalSpecialtyRepository;

#[Group('/platform/specialties')]
class SpecialtyController
{
    private Twig $view;
    private MedicalSpecialtyRepository $repository;

    public function __construct(Twig $view, MedicalSpecialtyRepository $repository)
    {
        $this->view = $view;
        $this->repository = $repository;
    }

    #[Route('GET', '')]
    public function index(Request $request, Response $response): Response
    {
        $specialties = $this->repository->getAll();

        return $this->view->render($response, 'platform/specialties/index.twig', [
            'page' => 'specialties',
            'page_title' => 'Tıbbi Branşlar',
            'specialties' => $specialties
        ]);
    }
}
