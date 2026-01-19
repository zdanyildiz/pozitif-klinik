<?php

declare(strict_types=1);

use DI\ContainerBuilder;
use Slim\Factory\AppFactory;
use Slim\Exception\HttpNotFoundException;

require __DIR__ . '/../vendor/autoload.php';

// Load Environment Variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

// Instantiate PHP-DI ContainerBuilder
$containerBuilder = new ContainerBuilder();

if (filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
    // Config dev settings
} else {
    $containerBuilder->enableCompilation(__DIR__ . '/../var/cache');
}

// Add definitions
$containerBuilder->addDefinitions(__DIR__ . '/../config/container.php');

// Build Container
$container = $containerBuilder->build();

// Instantiate the App
AppFactory::setContainer($container);
$app = AppFactory::create();

// Add Error Middleware
$displayErrorDetails = filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOLEAN);
$logError = true;
$logErrorDetails = true;

$errorMiddleware = $app->addErrorMiddleware($displayErrorDetails, $logError, $logErrorDetails);
$errorMiddleware->setDefaultErrorHandler(
    new \App\Core\HttpErrorHandler(
        $app->getCallableResolver(),
        $app->getResponseFactory(),
        $container->get(\Psr\Log\LoggerInterface::class)
    )
);

// CORS Middleware (Basic)
$app->add(function ($request, $handler) {
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
});

// Handle OPTIONS requests for CORS
$app->options('/{routes:.+}', function ($request, $response, $args) {
    return $response;
});

// Register routes
$routes = require __DIR__ . '/../config/routes.php';
$routes($app);

$app->run();
