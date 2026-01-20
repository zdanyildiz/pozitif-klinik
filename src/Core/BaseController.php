<?php

declare(strict_types=1);

namespace App\Core;

use Psr\Container\ContainerInterface;
use Psr\Http\Message\ResponseInterface as Response;

/**
 * Base Controller
 * 
 * Tüm controller sınıfları bu sınıftan türer.
 * Standart JSON response metodları ve ortak işlevler içerir.
 */
abstract class BaseController
{
    /**
     * DI Container
     */
    protected ContainerInterface $container;

    /**
     * Veritabanı bağlantısı
     */
    protected Database $db;

    /**
     * Constructor
     *
     * @param ContainerInterface $container DI Container
     */
    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        $this->db = $container->get(Database::class);
    }

    /**
     * JSON Response oluştur
     * 
     * Tüm API yanıtlarını standartlaştırır.
     *
     * @param Response $response PSR-7 Response objesi
     * @param mixed $payload JSON'a çevrilecek veri
     * @param int $status HTTP status kodu
     * @return Response
     */
    private function jsonResponse(Response $response, mixed $payload, int $status = 200): Response
    {
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $response->getBody()->write($json);

        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }

    /**
     * Başarılı işlem yanıtı
     * 
     * Format: {"status": true, "message": "...", "data": ...}
     *
     * @param Response $response PSR-7 Response objesi
     * @param mixed $data Yanıt verisi (nullable)
     * @param string $message Başarı mesajı
     * @param int $code HTTP status kodu
     * @return Response
     */
    protected function success(
        Response $response,
        mixed $data = null,
        string $message = 'İşlem başarılı',
        int $code = 200
    ): Response {
        $payload = [
            'status' => true,
            'message' => $message,
            'data' => $data
        ];

        return $this->jsonResponse($response, $payload, $code);
    }

    /**
     * Hatalı işlem yanıtı
     * 
     * Format: {"status": false, "message": "...", "data": ...}
     *
     * @param Response $response PSR-7 Response objesi
     * @param string $message Hata mesajı
     * @param int $code HTTP status kodu
     * @param mixed $data Hata detayları (validation errors vs.)
     * @return Response
     */
    protected function error(
        Response $response,
        string $message,
        int $code = 400,
        mixed $data = null
    ): Response {
        $payload = [
            'status' => false,
            'message' => $message,
            'data' => $data
        ];

        return $this->jsonResponse($response, $payload, $code);
    }

    /**
     * Request'ten clinic_id al
     * 
     * TenantMiddleware tarafından eklenen clinic_id attribute'unu döner.
     *
     * @param \Psr\Http\Message\ServerRequestInterface $request
     * @return int|null
     */
    protected function getClinicId(\Psr\Http\Message\ServerRequestInterface $request): ?int
    {
        return $request->getAttribute('clinic_id');
    }

    /**
     * Request'ten JWT payload al
     * 
     * TenantMiddleware tarafından eklenen jwt_payload attribute'unu döner.
     *
     * @param \Psr\Http\Message\ServerRequestInterface $request
     * @return object|null
     */
    protected function getJwtPayload(\Psr\Http\Message\ServerRequestInterface $request): ?object
    {
        return $request->getAttribute('jwt_payload');
    }

    /**
     * Request'ten user_id al
     * 
     * JWT payload içindeki user_id claim'ini döner.
     *
     * @param \Psr\Http\Message\ServerRequestInterface $request
     * @return int|null
     */
    protected function getUserId(\Psr\Http\Message\ServerRequestInterface $request): ?int
    {
        $payload = $this->getJwtPayload($request);
        return $payload?->sub ?? null;
    }

    /**
     * 404 Not Found yanıtı
     *
     * @param Response $response
     * @param string $message
     * @return Response
     */
    protected function notFoundResponse(Response $response, string $message = 'Kayıt bulunamadı'): Response
    {
        return $this->error($response, $message, 404);
    }

    /**
     * 403 Forbidden yanıtı
     *
     * @param Response $response
     * @param string $message
     * @return Response
     */
    protected function forbiddenResponse(Response $response, string $message = 'Bu işlem için yetkiniz yok'): Response
    {
        return $this->error($response, $message, 403);
    }

    /**
     * 201 Created yanıtı
     *
     * @param Response $response
     * @param mixed $data Oluşturulan kayıt
     * @param string $message
     * @return Response
     */
    protected function createdResponse(Response $response, mixed $data = null, string $message = 'Kayıt oluşturuldu'): Response
    {
        return $this->success($response, $data, $message, 201);
    }

    /**
     * Validation hatası yanıtı
     *
     * @param Response $response
     * @param array $errors Validation hataları
     * @return Response
     */
    protected function validationErrorResponse(Response $response, array $errors): Response
    {
        return $this->error($response, 'Doğrulama hatası', 422, $errors);
    }
}
