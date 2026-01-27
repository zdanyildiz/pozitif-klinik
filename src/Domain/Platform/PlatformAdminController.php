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
 * PlatformAdminController - Platform Yöneticileri Yönetimi
 */
#[Group('/platform-admin/users')]
#[Middleware(PlatformAdminMiddleware::class)]
class PlatformAdminController extends BaseController
{
    private PlatformAdminRepository $platformAdminRepository;

    public function __construct(ContainerInterface $container, PlatformAdminRepository $platformAdminRepository)
    {
        parent::__construct($container);
        $this->platformAdminRepository = $platformAdminRepository;
    }

    /**
     * Tüm Platform Adminlerini Listele
     */
    #[Route('GET', '')]
    public function list(Request $request, Response $response): Response
    {
        $users = $this->platformAdminRepository->findAll();
        return $this->success($response, $users);
    }

    /**
     * Yeni Platform Admini Oluştur
     */
    #[Route('POST', '')]
    public function create(Request $request, Response $response): Response
    {
        $body = $request->getParsedBody();
        $username = $body['username'] ?? '';
        $password = $body['password'] ?? '';

        if (empty($username) || empty($password)) {
            return $this->error($response, 'Kullanıcı adı ve şifre zorunludur.', 400);
        }

        // Kullanıcı adı kontrolü
        if ($this->platformAdminRepository->findByUsername($username)) {
            return $this->error($response, 'Bu kullanıcı adı zaten kullanımda.', 400);
        }

        try {
            $id = $this->platformAdminRepository->create([
                'username' => $username,
                'password' => $password
            ]);

            return $this->createdResponse($response, ['id' => $id], 'Platform yöneticisi oluşturuldu.');
        } catch (Throwable $e) {
            return $this->error($response, 'Kullanıcı oluşturulurken bir hata oluştu.');
        }
    }

    /**
     * Platform Admini Güncelle
     */
    #[Route('PUT', '/{id:[0-9]+}')]
    public function update(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];
        $body = $request->getParsedBody();

        $data = [];
        if (!empty($body['username']))
            $data['username'] = $body['username'];
        if (!empty($body['password']))
            $data['password'] = $body['password'];

        if (empty($data)) {
            return $this->error($response, 'Güncellenecek veri bulunamadı.', 400);
        }

        try {
            $this->platformAdminRepository->update($id, $data);
            return $this->success($response, null, 'Kullanıcı başarıyla güncellendi.');
        } catch (Throwable $e) {
            return $this->error($response, 'Güncelleme sırasında bir hata oluştu.');
        }
    }

    /**
     * Platform Admini Sil
     */
    #[Route('DELETE', '/{id:[0-9]+}')]
    public function delete(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        try {
            // Son adminin silinmesini engellemek iyi bir fikir olabilir
            $all = $this->platformAdminRepository->findAll();
            if (count($all) <= 1) {
                return $this->error($response, 'Sistemdeki son yöneticiyi silemezsiniz.', 400);
            }

            $this->platformAdminRepository->delete($id);
            return $this->success($response, null, 'Kullanıcı silindi.');
        } catch (Throwable $e) {
            return $this->error($response, 'Silme işlemi sırasında bir hata oluştu.');
        }
    }
}
