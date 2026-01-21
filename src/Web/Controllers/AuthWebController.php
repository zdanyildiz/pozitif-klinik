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

    public function __construct(
        Twig $view,
        UserRepository $userRepository,
        CryptoService $cryptoService,
        SessionService $session
    ) {
        $this->view = $view;
        $this->userRepository = $userRepository;
        $this->cryptoService = $cryptoService;
        $this->session = $session;
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
                ->withHeader('Location', '/admin/patients')
                ->withStatus(302);
        }

        return $this->view->render($response, 'login.twig', []);
    }

    /**
     * Login işlemini yap (POST)
     */
    #[Route('POST', '/admin/login')]
    #[Middleware(\App\Core\Middleware\RateLimitMiddleware::class)]
    public function loginPost(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();
        $clinicCode = trim($data['clinic_code'] ?? '');
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';

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
            $errorMessage = match ($result['reason']) {
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

        // Şifre kontrolü
        if (!password_verify($password, $user['password_hash'])) {
            return $this->view->render($response, 'login.twig', [
                'error' => 'Kullanıcı adı veya şifre hatalı.',
                'clinic_code' => $clinicCode,
                'username' => $username
            ]);
        }

        // Hesap aktif mi?
        if ((int) $user['is_active'] !== 1) {
            return $this->view->render($response, 'login.twig', [
                'error' => 'Hesabınız pasif durumdadır. Yöneticinizle iletişime geçin.',
                'clinic_code' => $clinicCode,
                'username' => $username
            ]);
        }

        // --- GİRİŞ BAŞARILI ---

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
            ->withHeader('Location', '/admin/patients')
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
