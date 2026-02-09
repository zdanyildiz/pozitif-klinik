<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;
use App\Domain\User\UserRepository;
use App\Core\Security\CryptoService;
use App\Core\Service\SessionService;
use App\Core\Attributes\Route;
use App\Core\Attributes\Middleware;

class AuthWebController
{
    private Twig $view;
    private UserRepository $userRepository;
    private CryptoService $cryptoService;
    private SessionService $session;
    private \Psr\Log\LoggerInterface $logger;

    public function __construct(
        Twig $view,
        UserRepository $userRepository,
        CryptoService $cryptoService,
        SessionService $session,
        \Psr\Log\LoggerInterface $logger
    ) {
        $this->view = $view;
        $this->userRepository = $userRepository;
        $this->cryptoService = $cryptoService;
        $this->session = $session;
        $this->logger = $logger;
    }

    /**
     * Login sayfasını göster (GET)
     */
    #[Route('GET', '/admin/login')]
    public function loginPage(Request $request, Response $response): Response
    {
        // Eğer zaten giriş yapmışsa dashboard'a yönlendir
        if ($this->session->has('user_id')) {
            return $response
                ->withHeader('Location', '/admin/dashboard')
                ->withStatus(302);
        }

        $tenant = $request->getAttribute('identified_tenant');
        $clinicCode = $tenant ? $tenant['domain_prefix'] : '';

        return $this->view->render($response, 'login.twig', [
            'clinic_code' => $clinicCode,
            'is_domain_identified' => !empty($clinicCode)
        ]);
    }

    /**
     * Login işlemini yap (POST)
     */
    #[Route('POST', '/admin/login')]
    #[Middleware(\App\Core\Middleware\RateLimitMiddleware::class)]
    public function loginPost(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();
        $tenant = $request->getAttribute('identified_tenant');

        // Eğer domain'den tespit edildiyse onu kullan, yoksa formdan gelen kodu kullan
        $clinicCode = $tenant ? $tenant['domain_prefix'] : strtolower(trim((string) ($data['clinic_code'] ?? '')));
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';

        $this->logger->debug("Login attempt data", [
            'clinic_code' => $clinicCode,
            'username' => $username
        ]);

        if (empty($clinicCode) || empty($username) || empty($password)) {
            return $this->view->render($response, 'login.twig', [
                'error' => 'Lütfen tüm alanları doldurun.',
                'clinic_code' => $clinicCode,
                'username' => $username
            ]);
        }

        // Kullanıcıyı doğrula (Tenant-Aware)
        $result = $this->userRepository->findUserByTenantAndUsername($clinicCode, $username);

        if ($result['status'] === 'error') {
            $reason = $result['reason'];
            $this->logger->warning("[AuthWebController] User lookup failed", ['reason' => $reason, 'clinic' => $clinicCode, 'user' => $username]);

            $errorMessage = match ($reason) {
                'tenant_not_found' => 'Kurum bulunamadı.',
                'tenant_inactive' => 'Kurum hesabı aktif değil.',
                'user_not_found' => 'Kullanıcı adı veya şifre hatalı.',
                default => 'Giriş başarısız.'
            };

            return $this->view->render($response, 'login.twig', [
                'error' => $errorMessage,
                'clinic_code' => $clinicCode,
                'username' => $username
            ]);
        }

        $user = $result['user'];

        $passwordVerify = password_verify($password, $user['password_hash']);

        $this->logger->debug("Login Auth Verification Result", [
            'verify_result' => $passwordVerify ? 'MATCH' : 'MISMATCH',
            'clinic_id' => $user['clinic_id']
        ]);

        // Şifre kontrolü
        if (!$passwordVerify) {
            $this->logger->warning("[AuthWebController] Password verification failed", ['user' => $username]);
            return $this->view->render($response, 'login.twig', [
                'error' => 'Kullanıcı adı veya şifre hatalı.',
                'clinic_code' => $clinicCode,
                'username' => $username
            ]);
        }

        // Hesap aktif mi?
        if ((int) $user['is_active'] !== 1) {
            $this->logger->warning("[AuthWebController] User inactive", ['user' => $username]);
            return $this->view->render($response, 'login.twig', [
                'error' => 'Hesabınız pasif durumdadır. Yöneticinizle iletişime geçin.',
                'clinic_code' => $clinicCode,
                'username' => $username
            ]);
        }

        // --- GİRİŞ BAŞARILI ---
        $this->logger->info("[AuthWebController] Login successful", ['user' => $username, 'clinic_id' => $user['clinic_id']]);

        // Session ID yenile (Fixation koruması)
        $this->session->regenerate(true);

        // Session verilerini yaz
        $this->session->set('user_id', $user['id']);
        $this->session->set('clinic_id', $user['clinic_id']);
        $this->session->set('username', $user['username']);
        $this->session->set('role', $user['role']);
        $this->session->set('logged_in_at', time());

        // Yönlendir
        return $response
            ->withHeader('Location', '/admin/dashboard')
            ->withStatus(302);
    }

    /**
     * Çıkış yap (GET)
     */
    #[Route('GET', '/admin/logout')]
    public function logout(Request $request, Response $response): Response
    {
        // Session'ı yok et
        $this->session->destroy();

        // Login sayfasına yönlendir
        return $response
            ->withHeader('Location', '/admin/login')
            ->withStatus(302);
    }
}
