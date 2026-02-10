<?php

declare(strict_types=1);

use Slim\App;
use App\Core\RouteRegistrar;

return function (App $app) {
    $registrar = new RouteRegistrar($app);

    // 1. Mevcut API Modülü (Domain) - KORUNUYOR
    $registrar->registerFromNamespace('App\Domain', __DIR__ . '/../src/Domain');

    // 2. Yeni WEB Modülü (Web Controllers) - OTOMATİK KEŞİF
    // src/Web/Controllers altındaki #[Route] attribute'larını okur.
    $app->group('', function (\Slim\Routing\RouteCollectorProxy $group) {
        $webRegistrar = new RouteRegistrar($group);
        $webRegistrar->registerFromNamespace('App\Web\Controllers', __DIR__ . '/../src/Web/Controllers');
    })
        ->add(\App\Core\Middleware\UISettingsMiddleware::class)
        ->add(\App\Core\Middleware\UserViewMiddleware::class)
        ->add(\App\Core\Middleware\DomainTenantMiddleware::class)
        ->add(\App\Core\Middleware\CsrfViewMiddleware::class)
        ->add(\Slim\Csrf\Guard::class);
};
