<?php

declare(strict_types=1);

namespace App\Middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Psr7\Response as SlimResponse;
use App\Core\Service\SessionService;

class PlatformAdminMiddleware implements MiddlewareInterface
{
    private SessionService $session;

    public function __construct(SessionService $session)
    {
        $this->session = $session;
    }

    /**
     * @inheritDoc
     */
    public function process(Request $request, RequestHandler $handler): Response
    {
        $authHeader = $request->getHeaderLine('Authorization');

        if (empty($authHeader)) {
            // SSR (Session) desteği
            if ($this->session->has('user_id') && ($this->session->get('role') === 'platform_admin' || $this->session->get('role') === 'admin')) {
                $userId = (int) $this->session->get('user_id');

                // Fake payload for compatibility
                $request = $request->withAttribute('jwt_payload', (object) [
                    'sub' => $userId,
                    'is_super_admin' => true,
                    'role' => $this->session->get('role')
                ]);

                return $handler->handle($request);
            }
            return $this->errorResponse('Yetkilendirme başlığı eksik veya geçersiz', 401);
        }

        if (!preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            return $this->errorResponse('Yetkilendirme başlığı eksik veya geçersiz', 401);
        }

        $token = $matches[1];
        $secret = $_ENV['JWT_SECRET'] ?? '';

        if (empty($secret)) {
            throw new \RuntimeException('JWT_SECRET missing in environment');
        }

        try {
            $decoded = JWT::decode($token, new Key($secret, 'HS256'));

            // is_super_admin kontrolü
            if (!isset($decoded->is_super_admin) || $decoded->is_super_admin !== true) {
                return $this->errorResponse('Bu işlem için Platform Yöneticisi yetkisi gerekir', 403);
            }

            // Request'e payload'u ekle
            $request = $request->withAttribute('jwt_payload', $decoded);

        } catch (\Exception $e) {
            return $this->errorResponse('Token geçersiz veya süresi dolmuş. Hata: ' . $e->getMessage(), 401);
        }

        return $handler->handle($request);
    }

    /**
     * Hata yanıtı oluştur
     *
     * @param string $message
     * @param int $status
     * @return Response
     */
    private function errorResponse(string $message, int $status): Response
    {
        $response = new SlimResponse();
        $payload = [
            'status' => false,
            'message' => $message,
            'data' => null
        ];

        $response->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));

        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}
