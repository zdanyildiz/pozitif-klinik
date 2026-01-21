<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;
use App\Domain\User\UserRepository;
use App\Core\Security\CryptoService;
use App\Core\Attributes\Route;

class AuthWebController
{
    private Twig $view;
    private UserRepository $userRepository;
    private CryptoService $cryptoService;

    public function __construct(Twig $view, UserRepository $userRepository, CryptoService $cryptoService)
    {
        $this->view = $view;
        $this->userRepository = $userRepository;
        $this->cryptoService = $cryptoService;
    }

    /**
     * Login sayfasını göster (GET)
     */
    #[Route('GET', '/admin/login')]
    public function loginPage(Request $request, Response $response): Response
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        // Eğer zaten giriş yapmışsa dashboard'a yönlendir
        if (!empty($_SESSION['user_id'])) {
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

        // Session başlat ve ID yenile (Fixation koruması)
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        session_regenerate_id(true);

        // Session verilerini yaz
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['clinic_id'] = $user['clinic_id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['logged_in_at'] = time();

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
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        // Session'ı temizle ve yok et
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params["path"],
                $params["domain"],
                $params["secure"],
                $params["httponly"]
            );
        }
        session_destroy();

        // Login sayfasına yönlendir
        return $response
            ->withHeader('Location', '/admin/login')
            ->withStatus(302);
    }
}
