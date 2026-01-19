<?php

use App\Middleware\TenantMiddleware;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

return function (App $app) {
    // Health check
    $app->get('/', function ($request, $response) {
        $response->getBody()->write('Pozitif Klinik Backend is Running!');
        return $response;
    });

    // Public routes
    $app->post('/auth/login', \App\Domain\Auth\AuthController::class . ':login');

    // API routes with TenantMiddleware
    $app->group('/api', function (RouteCollectorProxy $group) {
        $group->get('/test', function ($request, $response) {
            $response->getBody()->write('API Test Route');
            return $response;
        });
    })->add(TenantMiddleware::class);
};
