<?php

/**
 * Pozitif Klinik - Otomatik Rota Keşfi (Auto-Discovery Routing)
 * 
 * Bu dosya artık manuel rota tanımları içermiyor.
 * Tüm rotalar Controller sınıflarındaki PHP 8 Attributes ile tanımlanır.
 * 
 * Desteklenen Attribute'lar:
 * - #[Group('/prefix')] - Controller sınıfına URL prefix ekler
 * - #[Middleware(Class::class)] - Sınıf/Metod seviyesinde koruma
 * - #[Route('METHOD', '/path')] - Endpoint tanımı
 * 
 * @see src/Core/RouteRegistrar.php
 * @see src/Core/Attributes/
 */

use Slim\App;
use App\Core\RouteRegistrar;

return function (App $app) {

    // ══════════════════════════════════════════════════════════════════════
    // 1. HEALTH CHECK - Sabit endpoint (API'nin çalıştığını doğrulamak için)
    // ══════════════════════════════════════════════════════════════════════
    $app->get('/', function ($request, $response) {
        $response->getBody()->write(json_encode([
            'success' => true,
            'message' => 'Pozitif Klinik API',
            'version' => '1.0.0',
            'routing' => 'Auto-Discovery Active'
        ], JSON_UNESCAPED_UNICODE));

        return $response->withHeader('Content-Type', 'application/json');
    });

    // ══════════════════════════════════════════════════════════════════════
    // 2. OTOMATİK ROTA KEŞFİ BAŞLAT
    // ══════════════════════════════════════════════════════════════════════
    // RouteRegistrar, src/Domain altındaki tüm *Controller.php dosyalarını
    // tarar ve #[Route], #[Group], #[Middleware] attribute'larını okuyarak
    // rotaları otomatik olarak kaydeder.
    // ══════════════════════════════════════════════════════════════════════

    $registrar = new RouteRegistrar($app);
    $registrar->register(__DIR__ . '/../src/Domain');
};
