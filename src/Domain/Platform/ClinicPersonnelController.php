<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\BaseController;
use App\Middleware\PlatformAdminMiddleware;
use App\Domain\User\UserRepository;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;
use Throwable;

/**
 * ClinicPersonnelController - Platform yönetimi altından klinik personelini yönetmek için
 */
#[Group('/platform-admin/tenants/{clinicId:[0-9]+}/users')]
#[Middleware(PlatformAdminMiddleware::class)]
class ClinicPersonnelController extends BaseController
{
    private UserRepository $userRepository;

    public function __construct(ContainerInterface $container, UserRepository $userRepository)
    {
        parent::__construct($container);
        $this->userRepository = $userRepository;
    }

    /**
     * Kliniğe Ait Tüm Personelleri Listele
     */
    #[Route('GET', '')]
    public function list(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['clinicId'];
        $users = $this->userRepository->findAll($clinicId);
        return $this->success($response, $users);
    }

    /**
     * Kliniğe Yeni Personel Ekle
     */
    #[Route('POST', '')]
    public function create(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['clinicId'];
        $body = $request->getParsedBody();

        $username = $body['username'] ?? '';
        $name = $body['name'] ?? '';
        $password = $body['password'] ?? '';
        $role = $body['role'] ?? 'secretary';
        $specialty = $body['specialty'] ?? null;

        if (empty($username) || empty($password) || empty($role)) {
            return $this->error($response, 'Kullanıcı adı, şifre ve rol zorunludur.', 400);
        }

        // Çakışma kontrolü
        if ($this->userRepository->findByUsername($clinicId, $username)) {
            return $this->error($response, 'Bu kullanıcı adı bu klinikte zaten kullanımda.', 400);
        }

        try {
            // Doktor ise branş kontrolü
            if ($role === 'doctor' && empty($specialty)) {
                return $this->error($response, 'Doktor için branş (uzmanlık) seçilmesi zorunludur.', 400);
            }

            $id = $this->userRepository->create($clinicId, [
                'username' => $username,
                'name' => $name,
                'password' => $password,
                'role' => $role,
                'specialty' => $role === 'doctor' ? $specialty : null
            ]);
            return $this->createdResponse($response, ['id' => $id], 'Personel oluşturuldu.');
        } catch (Throwable $e) {
            return $this->error($response, 'Kullanıcı oluşturulurken bir hata oluştu: ' . $e->getMessage());
        }
    }

    /**
     * Personeli Güncelle
     */
    #[Route('PUT', '/{userId:[0-9]+}')]
    public function update(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['clinicId'];
        $userId = (int) $args['userId'];
        $body = $request->getParsedBody();

        $existing = $this->userRepository->findById($clinicId, $userId);
        if (!$existing) {
            return $this->error($response, 'Personel bulunamadı.', 404);
        }

        $role = $body['role'] ?? $existing['role'];
        $specialty = $body['specialty'] ?? $existing['specialty'];

        // Doktor ise branş kontrolü
        if ($role === 'doctor' && empty($specialty)) {
            return $this->error($response, 'Doktor için branş (uzmanlık) seçilmesi zorunludur.', 400);
        }

        $data = [
            'username' => $body['username'] ?? $existing['username'],
            'name' => $body['name'] ?? $existing['name'],
            'role' => $role,
            'specialty' => $role === 'doctor' ? $specialty : null,
            'is_active' => isset($body['is_active']) ? (int) $body['is_active'] : $existing['is_active'],
            'password' => $body['password'] ?? null
        ];

        try {
            $this->userRepository->update($clinicId, $userId, $data);
            return $this->success($response, null, 'Personel güncellendi.');
        } catch (Throwable $e) {
            return $this->error($response, 'Güncelleme sırasında bir hata oluştu: ' . $e->getMessage());
        }
    }

    /**
     * Personeli Sil
     */
    #[Route('DELETE', '/{userId:[0-9]+}')]
    public function delete(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['clinicId'];
        $userId = (int) $args['userId'];

        try {
            $this->userRepository->delete($clinicId, $userId);
            return $this->success($response, null, 'Personel silindi.');
        } catch (Throwable $e) {
            return $this->error($response, 'Silme sırasında bir hata oluştu.');
        }
    }
}
