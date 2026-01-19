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

    // Platform Admin routes
    $app->post('/admin/login', \App\Domain\Platform\PlatformAuthController::class . ':login');

    $app->group('/admin', function (RouteCollectorProxy $group) {
        $group->post('/tenants', \App\Domain\Platform\TenantController::class . ':create');
        $group->get('/tenants', \App\Domain\Platform\TenantController::class . ':list');
    })->add(\App\Middleware\PlatformAdminMiddleware::class);

    // API routes with TenantMiddleware
    $app->group('/api', function (RouteCollectorProxy $group) {
        $group->get('/test', function ($request, $response) {
            $response->getBody()->write('API Test Route');
            return $response;
        });

        // Patient routes
        $group->group('/patients', function (RouteCollectorProxy $patientGroup) {
            $patientGroup->get('', \App\Domain\Patient\PatientController::class . ':listPatients');
            $patientGroup->get('/{id:[0-9]+}', \App\Domain\Patient\PatientController::class . ':getPatient');
            $patientGroup->post('', \App\Domain\Patient\PatientController::class . ':createPatient');
            $patientGroup->put('/{id:[0-9]+}', \App\Domain\Patient\PatientController::class . ':updatePatient');
            $patientGroup->delete('/{id:[0-9]+}', \App\Domain\Patient\PatientController::class . ':deletePatient');
        });
    })->add(TenantMiddleware::class);
};
