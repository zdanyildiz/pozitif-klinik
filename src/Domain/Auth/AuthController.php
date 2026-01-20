<?php

declare(strict_types=1);

namespace App\Domain\Auth;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\BaseController;
use App\Domain\User\UserRepository;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Firebase\JWT\JWT;
use DateTimeImmutable;
use Psr\Container\ContainerInterface;

/**
 * AuthController - Klinik Kullanıcıları için Kimlik Doğrulama
 * 
 * Rotalar:
 * - POST /auth/login - Kullanıcı girişi ve JWT token üretimi
 * 
 * NOT: Bu controller public'tir, TenantMiddleware gerektirmez.
 */
#[Group('/auth')]
class AuthController extends BaseController
{
    private UserRepository $userRepository;

    public function __construct(ContainerInterface $container, UserRepository $userRepository)
    {
        parent::__construct($container);
        $this->userRepository = $userRepository;
    }

    /**
     * Kullanıcı girişi ve JWT token üretimi
     */
    #[Route('POST', '/login')]
    public function login(Request $request, Response $response): Response
    {
        // 1. Request body'den verileri al
        $data = $request->getParsedBody();
        $clinicCode = $data['clinic_code'] ?? '';
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($clinicCode) || empty($username) || empty($password)) {
            return $this->error($response, 'Kurum kodu, kullanıcı adı ve şifre zorunludur.', 400);
        }

        // 2. Kullanıcıyı ara (Tenant Aware arama)
        // Önce tenant kodu ile aktif tenant aranır, sonra o tenant altında kullanıcı aranır.
        $user = $this->userRepository->findUserByTenantAndUsername($clinicCode, $username);

        // 3. Kullanıcı bulunamazsa veya pasifse hata dön (Güvenlik: Detay verme)
        if (!$user || (int) $user['is_active'] !== 1) {
            return $this->error($response, 'Giriş bilgileri hatalı veya kurum pasif.', 401);
        }

        // 4. Şifre kontrolü
        if (!password_verify($password, $user['password_hash'])) {
            return $this->error($response, 'Giriş bilgileri hatalı veya kurum pasif.', 401);
        }

        // 5. JWT Token üret
        $secretKey = $_ENV['JWT_SECRET'] ?? '';

        if (empty($secretKey)) {
            return $this->error($response, 'Sunucu yapılandırma hatası (JWT Secret eksik).', 500);
        }

        $now = new DateTimeImmutable();
        $payload = [
            'iss' => 'pozitif-klinik',
            'iat' => $now->getTimestamp(),
            'exp' => $now->modify('+4 hours')->getTimestamp(),
            'sub' => $user['id'],
            'clinic_id' => $user['clinic_id'],
            'role' => $user['role']
        ];

        try {
            $token = JWT::encode($payload, $secretKey, 'HS256');
        } catch (\Exception $e) {
            return $this->error($response, 'Token oluşturulamadı: ' . $e->getMessage(), 500);
        }

        // 6. Başarılı yanıt
        return $this->success($response, ['token' => $token], 'Giriş başarılı');
    }
}
