<?php

declare(strict_types=1);

namespace App\Core\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use App\Core\Service\LoggerService;

/**
 * RequestLoggingMiddleware
 * 
 * Sistemdeki HER İSTEĞİ (404, 500 veya 200 fark etmeksizin) detaylıca loglar.
 * "Biz neyi logluyoruz?" sorusunun cevabıdır.
 */
class RequestLoggingMiddleware implements MiddlewareInterface
{
    private LoggerService $loggerService;

    public function __construct(LoggerService $loggerService)
    {
        $this->loggerService = $loggerService;
    }

    public function process(Request $request, RequestHandler $handler): Response
    {
        // İstek Başladı (Logla)
        $startTime = microtime(true);
        $method = $request->getMethod();
        $uri = (string) $request->getUri();
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';

        // Body'den şifre gibi hassas verileri gizle
        $body = $request->getParsedBody();
        if (is_array($body)) {
            if (isset($body['password']))
                $body['password'] = '***';
            if (isset($body['admin_password']))
                $body['admin_password'] = '***';
        }

        // İlk girişte ana sistem loguna debug seviyesinde yaz
        $this->loggerService->getMainLogger()->debug("Incoming Request: [$method] $uri", [
            'ip' => $ip,
            'body' => $body
        ]);

        // İşlemi gerçekleştir
        $response = $handler->handle($request);

        // İstek Bitti (Logla)
        $duration = round((microtime(true) - $startTime) * 1000, 2);
        $statusCode = $response->getStatusCode();

        // Eğer TenantMiddleware tarafından clinic_id atanmışsa, klinik bazlı logla
        $clinicId = $request->getAttribute('clinic_id');
        $logger = $this->loggerService->getLogger($clinicId ? (int) $clinicId : null);

        $logger->debug("Response Sent: [$statusCode] in {$duration}ms", [
            'method' => $method,
            'uri' => $uri,
            'clinic_id' => $clinicId
        ]);

        return $response;
    }
}
