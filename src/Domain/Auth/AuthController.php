<?php

declare(strict_types=1);

namespace App\Domain\Auth;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\BaseController;
use App\Domain\User\UserRepository;
use App\Core\Attributes\Middleware;
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
    private \App\Domain\Platform\TenantRepository $tenantRepository;
    private \Psr\Log\LoggerInterface $logger;

    public function __construct(
        ContainerInterface $container,
        UserRepository $userRepository,
        \App\Domain\Platform\TenantRepository $tenantRepository,
        \Psr\Log\LoggerInterface $logger
    ) {
        parent::__construct($container);
        $this->userRepository = $userRepository;
        $this->tenantRepository = $tenantRepository;
        $this->logger = $logger;
    }

    /**
     * Kullanıcı girişi ve JWT token üretimi
     */
    #[Route('POST', '/login')]
    #[Middleware(\App\Core\Middleware\RateLimitMiddleware::class)]
    public function login(Request $request, Response $response): Response
    {
        // 1. Request body'den verileri al
        $data = $request->getParsedBody();
        $rawClinicCode = $data['clinic_code'] ?? '';
        $clinicCode = strtolower((string) $rawClinicCode);
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';

        $this->logger->info("[AuthController] Login attempt", [
            'raw_clinic' => $rawClinicCode,
            'clinic_code' => $clinicCode,
            'username' => $username
        ]);

        if (empty($clinicCode) || empty($username) || empty($password)) {
            $this->logger->warning("[AuthController] Missing credentials");
            return $this->error($response, 'Kurum kodu, kullanıcı adı ve şifre zorunludur.', 400);
        }

        // 2. Kullanıcıyı ara (Tenant Aware arama)
        $result = $this->userRepository->findUserByTenantAndUsername($clinicCode, $username);

        if ($result['status'] === 'error') {
            $reason = $result['reason'];

            $this->logger->warning("[AuthController] Login failed", [
                'reason' => $reason,
                'clinic_code' => $clinicCode,
                'username' => $username
            ]);

            $message = match ($reason) {
                'tenant_not_found' => 'Girdiğiniz Kurum Kodu sisteme kayıtlı değil.',
                'tenant_inactive' => 'Kurum hesabı pasif durumda. Yönetici ile iletişime geçin.',
                'user_not_found' => 'Bu kurumda belirtilen kullanıcı adı bulunamadı.',
                default => 'Giriş bilgileri hatalı.'
            };

            return $this->error($response, $message, 401);
        }

        $user = $result['user'];

        // 3. Kullanıcı pasif kontrolü
        if ((int) $user['is_active'] !== 1) {
            $this->logger->warning("[AuthController] User inactive", ['username' => $username]);
            return $this->error($response, 'Kullanıcı hesabı pasif durumda.', 401);
        }

        // 4. Şifre kontrolü
        if (!password_verify($password, $user['password_hash'])) {
            $this->logger->warning("[AuthController] Password mismatch", ['username' => $username]);
            return $this->error($response, 'Girilen şifre hatalı.', 401);
        }

        // 5. JWT Token üret
        $secretKey = $_ENV['JWT_SECRET'] ?? '';

        if (empty($secretKey)) {
            $this->logger->critical("[AuthController] JWT Secret missing");
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
            $this->logger->error("[AuthController] Token generation failed: " . $e->getMessage());
            return $this->error($response, 'Token oluşturulamadı: ' . $e->getMessage(), 500);
        }

        $this->logger->info("[AuthController] Login successful", ['username' => $username, 'clinic_id' => $user['clinic_id']]);

        // 6. Başarılı yanıt
        return $this->success($response, [
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'name' => $user['name'] ?? $user['username'],
                'role' => $user['role']
            ]
        ], 'Giriş başarılı');
    }
}
