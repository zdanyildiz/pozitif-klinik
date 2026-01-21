<?php

declare(strict_types=1);

namespace App\Core\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use App\Core\Database;
use Slim\Psr7\Response as SlimResponse;

class RateLimitMiddleware implements MiddlewareInterface
{
    private Database $db;
    private int $limit;
    private int $window;

    public function __construct(Database $db, int $limit = 60, int $window = 60)
    {
        $this->db = $db;
        $this->limit = $limit;
        $this->window = $window;
    }

    public function process(Request $request, Handler $handler): Response
    {
        $ip = $this->getClientIp($request);

        $routeContext = \Slim\Routing\RouteContext::fromRequest($request);
        $route = $routeContext->getRoute();
        $routeName = $route ? $route->getName() : $request->getUri()->getPath();
        $routeHash = md5($routeName ?? $request->getUri()->getPath());

        $pdo = $this->db->getConnection();

        // Mevcut kaydı bul
        $stmt = $pdo->prepare("SELECT request_count, reset_at FROM sys_rate_limits WHERE ip_address = :ip AND route_hash = :hash");
        $stmt->execute(['ip' => $ip, 'hash' => $routeHash]);
        $rateLimit = $stmt->fetch();

        $now = time();

        if ($rateLimit) {
            $resetAt = strtotime($rateLimit['reset_at']);

            if ($now > $resetAt) {
                // Süre dolmuş, sıfırla
                $stmt = $pdo->prepare("UPDATE sys_rate_limits SET request_count = 1, reset_at = FROM_UNIXTIME(:reset) WHERE ip_address = :ip AND route_hash = :hash");
                $stmt->execute([
                    'reset' => $now + $this->window,
                    'ip' => $ip,
                    'hash' => $routeHash
                ]);
            } else {
                if ($rateLimit['request_count'] >= $this->limit) {
                    $response = new SlimResponse();
                    $response->getBody()->write(json_encode([
                        'error' => 'Too Many Requests',
                        'message' => 'Hız sınırını aştınız. Lütfen daha sonra tekrar deneyin.'
                    ], JSON_UNESCAPED_UNICODE));
                    return $response
                        ->withStatus(429)
                        ->withHeader('Content-Type', 'application/json')
                        ->withHeader('X-RateLimit-Limit', (string) $this->limit)
                        ->withHeader('X-RateLimit-Reset', (string) $resetAt);
                }

                // Sayacı artır
                $stmt = $pdo->prepare("UPDATE sys_rate_limits SET request_count = request_count + 1 WHERE ip_address = :ip AND route_hash = :hash");
                $stmt->execute(['ip' => $ip, 'hash' => $routeHash]);
            }
        } else {
            // Yeni kayıt oluştur
            $stmt = $pdo->prepare("INSERT INTO sys_rate_limits (ip_address, route_hash, request_count, reset_at) VALUES (:ip, :hash, 1, FROM_UNIXTIME(:reset))");
            $stmt->execute([
                'ip' => $ip,
                'hash' => $routeHash,
                'reset' => $now + $this->window
            ]);
        }

        return $handler->handle($request);
    }

    private function getClientIp(Request $request): string
    {
        $serverParams = $request->getServerParams();

        if (!empty($serverParams['HTTP_CLIENT_IP'])) {
            return $serverParams['HTTP_CLIENT_IP'];
        }

        if (!empty($serverParams['HTTP_X_FORWARDED_FOR'])) {
            return explode(',', $serverParams['HTTP_X_FORWARDED_FOR'])[0];
        }

        return $serverParams['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}
