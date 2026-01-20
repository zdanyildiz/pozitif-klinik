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
            $patientGroup->patch('/{id:[0-9]+}/archive', \App\Domain\Patient\PatientController::class . ':archivePatient');
            $patientGroup->delete('/{id:[0-9]+}', \App\Domain\Patient\PatientController::class . ':deletePatient');

            // Vitals tracking
            $patientGroup->post('/{id:[0-9]+}/vitals', \App\Domain\Patient\PatientController::class . ':addVital');
        });

        // User Management (Sadece Klinik Yöneticileri İçin)
        $group->group('/users', function (RouteCollectorProxy $userGroup) {
            $userGroup->get('', \App\Domain\User\UserController::class . ':listUsers');
            $userGroup->post('', \App\Domain\User\UserController::class . ':createUser');
            $userGroup->delete('/{id:[0-9]+}', \App\Domain\User\UserController::class . ':deleteUser');
        });
    })->add(TenantMiddleware::class);
};
