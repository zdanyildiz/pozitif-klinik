<?php

declare(strict_types=1);

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

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

// Set Base Path if app is not in the root
// Örn: http://localhost/pozitif-klinik/public/ -> /pozitif-klinik/public
$scriptName = $_SERVER['SCRIPT_NAME']; // /pozitif-klinik/public/index.php
$basePath = str_replace('/index.php', '', $scriptName);
$app->setBasePath($basePath);

// Inject BasePath to Twig
$container->get(\Slim\Views\Twig::class)->getEnvironment()->addGlobal('base_path', $basePath);

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

// Add Routing Middleware (required for Slim to resolve routes)
$app->addRoutingMiddleware();

// Add Body Parsing Middleware (required for JSON request body parsing)
$app->addBodyParsingMiddleware();

// CORS Middleware (Basic)
$app->add(function ($request, $handler) {
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
});



// Register routes
$routes = require __DIR__ . '/../config/routes.php';
$routes($app);

// Handle OPTIONS requests for CORS (Catch-all)
$app->options('/{routes:.+}', function ($request, $response, $args) {
    return $response;
});

$app->run();
