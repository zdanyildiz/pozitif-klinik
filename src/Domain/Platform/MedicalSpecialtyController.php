<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\BaseController;
use App\Middleware\PlatformAdminMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;

#[Group('/platform-api/specialties')]
#[Middleware(PlatformAdminMiddleware::class)]
class MedicalSpecialtyController extends BaseController
{
    private MedicalSpecialtyRepository $repository;

    public function __construct(ContainerInterface $container, MedicalSpecialtyRepository $repository)
    {
        parent::__construct($container);
        $this->repository = $repository;
    }

    #[Route('GET', '')]
    public function list(Request $request, Response $response): Response
    {
        $specialties = $this->repository->getAll();
        return $this->success($response, $specialties);
    }

    #[Route('GET', '/{id}')]
    public function get(Request $request, Response $response, array $args): Response
    {
        $specialty = $this->repository->findById((int) $args['id']);
        if (!$specialty) {
            return $this->error($response, 'Branş bulunamadı', 404);
        }
        return $this->success($response, $specialty);
    }

    #[Route('POST', '')]
    public function create(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();

        // Validation (Basic)
        if (empty($data['code']) || empty($data['name'])) {
            return $this->error($response, 'Kod ve İsim zorunludur', 400);
        }

        try {
            $id = $this->repository->create($data);
            return $this->success($response, ['id' => $id], 'Branş başarıyla oluşturuldu', 201);
        } catch (\PDOException $e) {
            if ($e->getCode() == 23000) { // Duplicate entry
                return $this->error($response, 'Bu branş kodu zaten kullanımda', 409);
            }
            throw $e;
        }
    }

    #[Route('PUT', '/{id}')]
    public function update(Request $request, Response $response, array $args): Response
    {
        $data = $request->getParsedBody();
        $id = (int) $args['id'];

        $success = $this->repository->update($id, $data);

        if ($success) {
            return $this->success($response, ['message' => 'Branş güncellendi']);
        }
        return $this->error($response, 'Güncelleme başarısız', 500);
    }

    #[Route('DELETE', '/{id}')]
    public function delete(Request $request, Response $response, array $args): Response
    {
        $this->repository->delete((int) $args['id']);
        return $this->success($response, ['message' => 'Branş silindi']);
    }
}
