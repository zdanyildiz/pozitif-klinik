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
use Throwable;

/**
 * AppointmentStatusController - Randevu Durumları Yönetimi
 */
#[Group('/platform-admin/appointment-statuses')]
#[Middleware(PlatformAdminMiddleware::class)]
class AppointmentStatusController extends BaseController
{
    private AppointmentStatusRepository $repository;

    public function __construct(ContainerInterface $container, AppointmentStatusRepository $repository)
    {
        parent::__construct($container);
        $this->repository = $repository;
    }

    /**
     * Tüm statüleri listele
     */
    #[Route('GET', '')]
    public function list(Request $request, Response $response): Response
    {
        $statuses = $this->repository->findAllSorted();
        return $this->success($response, $statuses);
    }

    /**
     * Yeni statü oluştur
     */
    #[Route('POST', '')]
    public function create(Request $request, Response $response): Response
    {
        $body = $request->getParsedBody();

        // Temel validasyon
        if (empty($body['status_code']) || empty($body['name'])) {
            return $this->error($response, 'Kod ve isim zorunludur.', 400);
        }

        // Kod benzersiz mi?
        if (!$this->repository->isCodeUnique($body['status_code'])) {
            return $this->error($response, 'Bu statü kodu zaten kullanımda.', 400);
        }

        try {
            $data = [
                'status_code' => $body['status_code'],
                'name' => $body['name'],
                'color_code' => $body['color_code'] ?? '#6c757d',
                'icon_class' => $body['icon_class'] ?? 'bi-circle',
                'sort_order' => (int) ($body['sort_order'] ?? 0),
                'is_system' => 0, // Yeni eklenenler her zaman sistem dışı
                'is_active' => (int) ($body['is_active'] ?? 1)
            ];

            $id = $this->repository->create($data);
            return $this->createdResponse($response, ['id' => $id], 'Randevu durumu oluşturuldu.');
        } catch (Throwable $e) {
            return $this->error($response, 'Oluşturma sırasında bir hata oluştu: ' . $e->getMessage());
        }
    }

    /**
     * Statü güncelle
     */
    #[Route('PUT', '/{id:[0-9]+}')]
    public function update(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];
        $body = $request->getParsedBody();

        $existing = $this->repository->findById($id);
        if (!$existing) {
            return $this->error($response, 'Statü bulunamadı.', 404);
        }

        // Validasyon
        if (isset($body['status_code']) && empty($body['status_code'])) {
            return $this->error($response, 'Kod boş olamaz.', 400);
        }

        // Kod benzersiz mi?
        if (isset($body['status_code']) && !$this->repository->isCodeUnique($body['status_code'], $id)) {
            return $this->error($response, 'Bu statü kodu zaten kullanımda.', 400);
        }

        try {
            $data = [];

            // Eğer sistem statüsü ise sadece bazı alanlar güncellenebilir (veya kod değiştirilemez)
            $isSystem = (bool) ($existing['is_system'] ?? false);

            if (!$isSystem && isset($body['status_code'])) {
                $data['status_code'] = $body['status_code'];
            }

            if (isset($body['name']))
                $data['name'] = $body['name'];
            if (isset($body['color_code']))
                $data['color_code'] = $body['color_code'];
            if (isset($body['icon_class']))
                $data['icon_class'] = $body['icon_class'];
            if (isset($body['sort_order']))
                $data['sort_order'] = (int) $body['sort_order'];
            if (isset($body['is_active']))
                $data['is_active'] = (int) $body['is_active'];

            if (empty($data)) {
                return $this->error($response, 'Güncellenecek veri bulunamadı.', 400);
            }

            $this->repository->update($id, $data);
            return $this->success($response, null, 'Randevu durumu güncellendi.');
        } catch (Throwable $e) {
            return $this->error($response, 'Güncelleme sırasında bir hata oluştu: ' . $e->getMessage());
        }
    }

    /**
     * Statü sil
     */
    #[Route('DELETE', '/{id:[0-9]+}')]
    public function delete(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        $existing = $this->repository->findById($id);
        if (!$existing) {
            return $this->error($response, 'Statü bulunamadı.', 404);
        }

        // Sistem statüsü silinemez
        if ($existing['is_system']) {
            return $this->error($response, 'Sistem tarafından kullanılan ana statüler silinemez.', 403);
        }

        try {
            $this->repository->delete($id);
            return $this->success($response, null, 'Randevu durumu silindi.');
        } catch (Throwable $e) {
            // Eğer yabancı anahtar kısıtlaması varsa (kullanımda olan statü)
            if (str_contains($e->getMessage(), 'foreign key constraint fails')) {
                return $this->error($response, 'Bu statü kullanımda olduğu için silinemez. Bunun yerine pasif yapabilirsiniz.', 400);
            }
            return $this->error($response, 'Silme işlemi sırasında bir hata oluştu.');
        }
    }
}
