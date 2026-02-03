<?php

declare(strict_types=1);

namespace App\Domain\Surgery;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\BaseController;
use App\Middleware\TenantMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;

/**
 * SurgeryController - Ameliyat Yönetimi API
 */
#[Group('/api/surgeries')]
#[Middleware(TenantMiddleware::class)]
class SurgeryController extends BaseController
{
    private SurgeryRepository $repository;

    public function __construct(ContainerInterface $container, SurgeryRepository $repository)
    {
        parent::__construct($container);
        $this->repository = $repository;
    }

    #[Route('GET', '')]
    public function list(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $params = $request->getQueryParams();

        $surgeries = $this->repository->list($clinicId, $params);

        return $this->success($response, $surgeries);
    }

    #[Route('GET', '/{id:[0-9]+}')]
    public function get(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $id = (int) $args['id'];

        $surgery = $this->repository->findById($clinicId, $id);

        if (!$surgery) {
            return $this->error($response, 'Ameliyat kaydı bulunamadı', 404);
        }

        return $this->success($response, $surgery);
    }

    #[Route('POST', '')]
    public function create(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $data = $request->getParsedBody();
        $userId = (int) $this->getUserId($request);

        if (empty($data['patient_id']) || empty($data['doctor_id']) || empty($data['surgery_date'])) {
            return $this->error($response, 'Hasta, Doktor ve Tarih alanları zorunludur.', 400);
        }

        $id = $this->repository->create($clinicId, $data, $userId);

        return $this->success($response, ['id' => $id], 'Ameliyat başarıyla planlandı.', 201);
    }

    #[Route('PUT', '/{id:[0-9]+}')]
    public function update(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $id = (int) $args['id'];
        $data = $request->getParsedBody();
        $userId = (int) $this->getUserId($request);

        if (empty($data['patient_id']) || empty($data['doctor_id']) || empty($data['surgery_date'])) {
            return $this->error($response, 'Hasta, Doktor ve Tarih alanları zorunludur.', 400);
        }

        $this->repository->update($clinicId, $id, $data, $userId);

        return $this->success($response, null, 'Ameliyat bilgileri güncellendi.');
    }

    #[Route('PUT', '/{id:[0-9]+}/status')]
    public function updateStatus(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $id = (int) $args['id'];
        $data = $request->getParsedBody();
        $userId = (int) $this->getUserId($request);

        if (empty($data['status'])) {
            return $this->error($response, 'Durum bilgisi zorunludur.', 400);
        }

        $this->repository->updateStatus($clinicId, $id, $data['status'], $userId);

        return $this->success($response, null, 'Ameliyat durumu güncellendi.');
    }

    #[Route('DELETE', '/{id:[0-9]+}')]
    public function delete(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $id = (int) $args['id'];
        $userId = (int) $this->getUserId($request);

        $this->repository->delete($clinicId, $id, $userId);

        return $this->success($response, null, 'Ameliyat kaydı silindi.');
    }
}
