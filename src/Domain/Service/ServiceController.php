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

    /**
     * Hizmetleri listeler (opsiyonel: includeInactive=1 ile pasifler de dahil)
     */
    #[Route('GET', '')]
    public function list(Request $request, Response $response): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        $params = $request->getQueryParams();

        $page = isset($params['page']) ? (int) $params['page'] : 1;
        $limit = isset($params['limit']) ? (int) $params['limit'] : 20;
        $search = $params['q'] ?? null;
        $category = $params['category'] ?? null;
        $includeInactive = isset($params['includeInactive']) && $params['includeInactive'] === '1';

        $result = $this->repository->findAllPaginated($clinicId, $page, $limit, $search, $category, $includeInactive);

        return $this->success($response, $result);
    }

    /**
     * Hizmet arama (GET /api/services/search?q=xxx)
     */
    #[Route('GET', '/search')]
    public function search(Request $request, Response $response): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        $queryParams = $request->getQueryParams();
        $query = $queryParams['q'] ?? '';

        if (strlen($query) < 2) {
            return $this->error($response, 'Arama terimi en az 2 karakter olmalıdır.', 400);
        }

        $services = $this->repository->search($clinicId, $query);
        return $this->success($response, $services);
    }

    /**
     * Kategori listesi (GET /api/services/categories)
     */
    #[Route('GET', '/categories')]
    public function categories(Request $request, Response $response): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        $categories = $this->repository->getCategories($clinicId);

        return $this->success($response, $categories);
    }

    /**
     * İstatistikler (GET /api/services/stats)
     */
    #[Route('GET', '/stats')]
    public function stats(Request $request, Response $response): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        $stats = $this->repository->getStats($clinicId);

        return $this->success($response, $stats);
    }

    /**
     * Tek hizmet detayı (GET /api/services/{id})
     */
    #[Route('GET', '/{id:[0-9]+}')]
    public function get(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        $serviceId = (int) $args['id'];

        $service = $this->repository->findById($clinicId, $serviceId);

        if (!$service) {
            return $this->error($response, 'Hizmet bulunamadı.', 404);
        }

        return $this->success($response, $service);
    }

    /**
     * Yeni hizmet oluştur (POST /api/services)
     */
    #[Route('POST', '')]
    public function create(Request $request, Response $response): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        $data = $request->getParsedBody();

        if (empty($data['name'])) {
            return $this->error($response, 'Hizmet adı gereklidir.', 400);
        }

        // Kod benzersizlik kontrolü
        if (!empty($data['code'])) {
            $existing = $this->repository->findByCode($clinicId, $data['code']);
            if ($existing) {
                return $this->error($response, 'Bu hizmet kodu zaten kullanılıyor.', 400);
            }
        }

        $id = $this->repository->create($clinicId, $data);
        return $this->success($response, ['id' => $id], 'Hizmet başarıyla oluşturuldu.', 201);
    }

    /**
     * Hizmet güncelle (PUT /api/services/{id})
     */
    #[Route('PUT', '/{id:[0-9]+}')]
    public function update(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        $serviceId = (int) $args['id'];
        $data = $request->getParsedBody();

        if (empty($data['name'])) {
            return $this->error($response, 'Hizmet adı gereklidir.', 400);
        }

        // Mevcut hizmeti kontrol et
        $existing = $this->repository->findById($clinicId, $serviceId);
        if (!$existing) {
            return $this->error($response, 'Hizmet bulunamadı.', 404);
        }

        // Kod benzersizlik kontrolü (kendi kodu hariç)
        if (!empty($data['code'])) {
            $codeCheck = $this->repository->findByCode($clinicId, $data['code']);
            if ($codeCheck && $codeCheck['id'] !== $serviceId) {
                return $this->error($response, 'Bu hizmet kodu zaten kullanılıyor.', 400);
            }
        }

        $this->repository->update($clinicId, $serviceId, $data);
        return $this->success($response, null, 'Hizmet güncellendi.');
    }

    /**
     * Hizmeti pasif yap (DELETE /api/services/{id})
     */
    #[Route('DELETE', '/{id:[0-9]+}')]
    public function delete(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $request->getAttribute('clinic_id');
        $serviceId = (int) $args['id'];

        $existing = $this->repository->findById($clinicId, $serviceId);
        if (!$existing) {
            return $this->error($response, 'Hizmet bulunamadı.', 404);
        }

        $this->repository->delete($clinicId, $serviceId);
        return $this->success($response, null, 'Hizmet silindi.');
    }
}
