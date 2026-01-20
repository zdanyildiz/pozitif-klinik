<?php

declare(strict_types=1);

namespace App\Domain\Auth;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\BaseController;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Firebase\JWT\JWT;
use DateTimeImmutable;

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
    /**
     * Kullanıcı girişi ve JWT token üretimi
     *
     * @param Request $request
     * @param Response $response
     * @return Response
     */
    #[Route('POST', '/login')]
    public function login(Request $request, Response $response): Response
    {
        // 1. Request body'den verileri al
        $data = $request->getParsedBody();
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($username) || empty($password)) {
            return $this->error($response, 'Kullanıcı adı ve şifre zorunludur.', 400);
        }

        // 2. sys_users tablosunda kullanıcı ara
        $sql = "SELECT * FROM sys_users WHERE username = ? AND is_active = 1";
        $user = $this->db->fetch($sql, [$username]);

        // 3. Kullanıcı bulunamazsa hata dön
        if (!$user) {
            return $this->error($response, 'Kullanıcı bulunamadı', 401);
        }

        // 4. Şifre kontrolü
        if (!password_verify($password, $user['password_hash'])) {
            // Güvenlik notu: Asla şifreyi loglama
            return $this->error($response, 'Hatalı şifre', 401);
        }

        // 5. JWT Token üret
        $secretKey = $_ENV['JWT_SECRET'] ?? '';

        if (empty($secretKey)) {
            // Uygulama hatası: Secret key tanımlanmamış
            return $this->error($response, 'Sunucu yapılandırma hatası (JWT Secret eksik).', 500);
        }

        $now = new DateTimeImmutable();
        $payload = [
            'iss' => 'pozitif-klinik',
            'iat' => $now->getTimestamp(),
            'exp' => $now->modify('+4 hours')->getTimestamp(),
            'sub' => $user['id'],
            'clinic_id' => $user['clinic_id'], // ÇOK ÖNEMLİ!
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
