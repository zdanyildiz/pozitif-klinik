<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\BaseController;
use Firebase\JWT\JWT;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class PlatformAuthController extends BaseController
{
    /**
     * Platform Admin Login
     *
     * @param Request $request
     * @param Response $response
     * @return Response
     */
    public function login(Request $request, Response $response): Response
    {
        $body = $request->getParsedBody();
        $username = $body['username'] ?? '';
        $password = $body['password'] ?? '';

        if (empty($username) || empty($password)) {
            return $this->error($response, 'Kullanıcı adı ve şifre gereklidir', 400);
        }

        // sys_platform_admins tablosunda ara
        $admin = $this->db->fetch(
            "SELECT * FROM sys_platform_admins WHERE username = :username",
            ['username' => $username]
        );

        if (!$admin || !password_verify($password, $admin['password_hash'])) {
            return $this->error($response, 'Geçersiz kullanıcı adı veya şifre', 401);
        }

        // Token Oluştur
        $secret = $_ENV['JWT_SECRET'] ?? 'changeme';
        $payload = [
            'iat' => time(),
            'exp' => time() + (60 * 60 * 12), // 12 saat
            'sub' => $admin['id'],
            'username' => $admin['username'],
            'is_super_admin' => true
        ];

        $token = JWT::encode($payload, $secret, 'HS256');

        return $this->success($response, [
            'access_token' => $token,
            'token_type' => 'Bearer',
            'expires_in' => 60 * 60 * 12
        ], 'Giriş başarılı');
    }
}
