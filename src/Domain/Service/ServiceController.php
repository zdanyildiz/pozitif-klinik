<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Core\BaseController;
use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Middleware\TenantMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

#[Group('/api/services')]
#[Middleware(TenantMiddleware::class)]
class ServiceController extends BaseController
{
    private ServiceRepository $repository;

    public function __construct(ServiceRepository $repository)
    {
        $this->repository = $repository;
    }

    #[Route('GET', '')]
    public function list(Request $request, Response $response): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        $services = $this->repository->findAll($clinicId);

        return $this->success($response, $services);
    }

    #[Route('POST', '')]
    public function create(Request $request, Response $response): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        $data = $request->getParsedBody();

        if (empty($data['name'])) {
            return $this->error($response, 'Hizmet adı gereklidir.', 400);
        }

        $id = $this->repository->create($clinicId, $data);
        return $this->success($response, ['id' => $id], 'Hizmet başarıyla oluşturuldu.', 201);
    }

    #[Route('PUT', '/{id:[0-9]+}')]
    public function update(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        $serviceId = (int) $args['id'];
        $data = $request->getParsedBody();

        if (empty($data['name'])) {
            return $this->error($response, 'Hizmet adı gereklidir.', 400);
        }

        $this->repository->update($clinicId, $serviceId, $data);
        return $this->success($response, null, 'Hizmet güncellendi.');
    }

    #[Route('DELETE', '/{id:[0-9]+}')]
    public function delete(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        $serviceId = (int) $args['id'];

        $this->repository->delete($clinicId, $serviceId);
        return $this->success($response, null, 'Hizmet silindi.');
    }
}
