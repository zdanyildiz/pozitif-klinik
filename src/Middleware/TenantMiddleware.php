<?php

declare(strict_types=1);

namespace App\Middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;
use App\Core\Service\SessionService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;
use Slim\Psr7\Response;

/**
 * Multi-Tenancy Güvenlik Katmanı (Middleware)
 * 
 * Bu middleware, gelen isteklerdeki JWT token'ı doğrular ve
 * clinic_id bilgisini request attribute olarak ekler.
 */
class TenantMiddleware implements MiddlewareInterface
{
    /**
     * JWT Secret Key
     */
    private string $jwtSecret;

    /**
     * Logger
     */
    private LoggerInterface $logger;

    /**
     * Session Service
     */
    private SessionService $session;

    /**
     * Constructor
     */
    public function __construct(LoggerInterface $logger, SessionService $session)
    {
        $this->logger = $logger;
        $this->session = $session;
        $this->jwtSecret = $_ENV['JWT_SECRET'] ?? '';

        if (empty($this->jwtSecret)) {
            throw new \RuntimeException('JWT_SECRET environment variable is not set');
        }
    }

    /**
     * PSR-15 Middleware process metodu
     *
     * @param ServerRequestInterface $request
     * @param RequestHandlerInterface $handler
     * @return ResponseInterface
     */
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        // 1. Authorization header'ını kontrol et
        $authHeader = $request->getHeaderLine('Authorization');

        if (empty($authHeader)) {
            $this->logger->warning("[TenantMiddleware] Authorization header is EMPTY.");
            // SSR (Session) desteği ekle
            if ($this->session->has('clinic_id')) {
                $clinicId = (int) $this->session->get('clinic_id');
                $userId = (int) $this->session->get('user_id');
                $this->logger->debug("[TenantMiddleware] Session based auth used. ClinicID: $clinicId, UserID: $userId");

                $request = $request->withAttribute('clinic_id', $clinicId);

                // BaseController::getUserId() ile uyumluluk için fake payload
                $request = $request->withAttribute('jwt_payload', (object) [
                    'sub' => $userId,
                    'clinic_id' => $clinicId,
                    'role' => $this->session->get('role')
                ]);

                return $handler->handle($request);
            }

            return $this->unauthorizedResponse('Authorization header bulunamadı');
        }

        // 2. Bearer token formatını kontrol et
        if (!preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
            $this->logger->error("[TenantMiddleware] Invalid Bearer format. Header: $authHeader");
            return $this->unauthorizedResponse('Geçersiz Authorization header formatı');
        }

        $token = $matches[1];
        // Debugging Token (Last 10 chars visible)
        $tokenDebug = substr($token, -10);
        $this->logger->debug("[TenantMiddleware] Processing Token ending with ...$tokenDebug");

        try {
            // 3. Token'ı decode et
            $decoded = JWT::decode($token, new Key($this->jwtSecret, 'HS256'));

            // LOG THE DECODED PAYLOAD
            $this->logger->debug("[TenantMiddleware] Token Decoded Successfully.", ['payload' => (array) $decoded]);

            // 4. clinic_id claim'ini kontrol et
            if (!isset($decoded->clinic_id)) {
                $this->logger->critical("[TenantMiddleware] 'clinic_id' claim MISSING in token payload!");
                return $this->forbiddenResponse('Klinik kimliği bulunamadı');
            }

            $clinicId = (int) $decoded->clinic_id;
            $this->logger->info("[TenantMiddleware] Clinic ID resolved: $clinicId");

            // 5. clinic_id'yi request attribute olarak ekle
            $request = $request->withAttribute('clinic_id', $clinicId);

            // Ek olarak, tüm token verilerini de ekleyelim (user_id vs. için kullanışlı olabilir)
            $request = $request->withAttribute('jwt_payload', $decoded);

        } catch (ExpiredException $e) {
            $this->logger->warning("[TenantMiddleware] Token EXPIRED: " . $e->getMessage());
            return $this->unauthorizedResponse('Token süresi dolmuş');
        } catch (SignatureInvalidException $e) {
            $this->logger->critical("[TenantMiddleware] Token SIGNATURE INVALID: " . $e->getMessage());
            return $this->unauthorizedResponse('Geçersiz token imzası');
        } catch (\Exception $e) {
            $this->logger->error("[TenantMiddleware] Token Verification Failed: " . $e->getMessage());
            return $this->unauthorizedResponse('Token doğrulama hatası: ' . $e->getMessage());
        }

        // 6. İsteği bir sonraki katmana ilet (Try-catch dışında, böylece uygulama hataları bastırılmaz)
        return $handler->handle($request);
    }

    /**
     * 401 Unauthorized yanıtı oluştur
     *
     * @param string $message
     * @return ResponseInterface
     */
    private function unauthorizedResponse(string $message): ResponseInterface
    {
        $this->logger->warning("[TenantMiddleware] Unauthorized: " . $message);

        $response = new Response();
        $response = $response->withStatus(401);
        $response = $response->withHeader('Content-Type', 'application/json');

        $body = json_encode([
            'status' => false,
            'message' => $message,
            'data' => null
        ], JSON_UNESCAPED_UNICODE);

        $response->getBody()->write($body);

        return $response;
    }

    /**
     * 403 Forbidden yanıtı oluştur
     *
     * @param string $message
     * @return ResponseInterface
     */
    private function forbiddenResponse(string $message): ResponseInterface
    {
        $this->logger->warning("[TenantMiddleware] Forbidden: " . $message);

        $response = new Response();
        $response = $response->withStatus(403);
        $response = $response->withHeader('Content-Type', 'application/json');

        $body = json_encode([
            'status' => false,
            'message' => $message,
            'data' => null
        ], JSON_UNESCAPED_UNICODE);

        $response->getBody()->write($body);

        return $response;
    }
}
