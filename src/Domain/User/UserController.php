<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\BaseController;
use App\Middleware\TenantMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Respect\Validation\Validator as v;
use Psr\Container\ContainerInterface;

/**
 * UserController - Klinik Personel Yönetimi
 * 
 * Rotalar:
 * - GET    /api/users       - Personel listesi
 * - POST   /api/users       - Yeni personel ekle (admin only)
 * - DELETE /api/users/{id}  - Personel sil (admin only)
 */
#[Group('/api/users')]
#[Middleware(TenantMiddleware::class)]
class UserController extends BaseController
{
    private UserRepository $userRepository;

    public function __construct(ContainerInterface $container, UserRepository $userRepository)
    {
        parent::__construct($container);
        $this->userRepository = $userRepository;
    }

    /**
     * O kliniğe ait tüm personeli listeler
     */
    #[Route('GET', '')]
    public function listUsers(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $users = $this->userRepository->findAll($clinicId);

        return $this->success($response, [
            'count' => count($users),
            'users' => $users
        ]);
    }

    /**
     * Yeni personel ekler
     */
    #[Route('POST', '')]
    public function createUser(Request $request, Response $response): Response
    {
        // Yetki Kontrolü: Sadece admin silebilir
        $jwtPayload = $this->getJwtPayload($request);
        if (($jwtPayload->role ?? '') !== 'admin') {
            return $this->forbiddenResponse($response, 'Bu işlem için Klinik Yöneticisi (admin) yetkisi gereklidir.');
        }

        $clinicId = (int) $this->getClinicId($request);
        $data = $request->getParsedBody();

        // Validasyon
        $validator = v::key('username', v::alnum()->noWhitespace()->length(3))
            ->key('name', v::stringType()->length(2))
            ->key('password', v::stringType()->length(6))
            ->key('role', v::in(['doctor', 'secretary']));

        try {
            $validator->assert($data);

            // Kullanıcı adı kontrolü
            if ($this->userRepository->findByUsername($clinicId, $data['username'])) {
                return $this->error($response, 'Bu kullanıcı adı zaten kullanımda.', 409);
            }

            $userId = $this->userRepository->create($clinicId, $data);

            return $this->createdResponse($response, [
                'id' => $userId,
                'name' => $data['name']
            ], 'Kullanıcı başarıyla oluşturuldu.');

        } catch (\Respect\Validation\Exceptions\NestedValidationException $e) {
            return $this->validationErrorResponse($response, $e->getMessages());
        }
    }

    /**
     * Personeli siler
     */
    #[Route('DELETE', '/{id:[0-9]+}')]
    public function deleteUser(Request $request, Response $response, array $args): Response
    {
        // Yetki Kontrolü: Sadece admin silebilir
        $jwtPayload = $this->getJwtPayload($request);
        if (($jwtPayload->role ?? '') !== 'admin') {
            return $this->forbiddenResponse($response, 'Bu işlem için Klinik Yöneticisi (admin) yetkisi gereklidir.');
        }

        $clinicId = (int) $this->getClinicId($request);
        $userIdToDelete = (int) $args['id'];
        $currentUserId = (int) $this->getUserId($request);

        // Kendi kendini silemez
        if ($userIdToDelete === $currentUserId) {
            return $this->error($response, 'Kendi hesabınızı silemezsiniz.', 400);
        }

        // Hiyerarşi Kuralı: Admin başka bir admini silememeli (Opsiyonel ama güvenlik için ekliyoruz)
        $roleToDelete = $this->userRepository->findRoleById($userIdToDelete);
        if ($roleToDelete === 'admin') {
            return $this->error($response, 'Başka bir yöneticiyi silemezsiniz.', 403);
        }

        $this->userRepository->delete($clinicId, $userIdToDelete);

        return $this->success($response, null, 'Kullanıcı başarıyla silindi.');
    }
}
