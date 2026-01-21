<?php

use Slim\App;
use App\Core\RouteRegistrar;

return function (App $app) {
    $registrar = new RouteRegistrar($app);

    // 1. Mevcut API Modülü (Domain) - KORUNUYOR
    $registrar->registerFromNamespace('App\Domain', __DIR__ . '/../src/Domain');

    // 2. Yeni WEB Modülü (Web Controllers) - OTOMATİK KEŞİF
    // src/Web/Controllers altındaki #[Route] attribute'larını okur.
    $registrar->registerFromNamespace('App\Web\Controllers', __DIR__ . '/../src/Web/Controllers');

    // /admin ana dizini için yönlendirme
    $app->get('/admin', function ($request, $response) {
        return $response->withHeader('Location', '/admin/login')->withStatus(302);
    });

    // Test rotası (Sorun analizi için)
    $app->get('/ping', function ($request, $response) {
        $response->getBody()->write('pong');
        return $response;
    });
};
