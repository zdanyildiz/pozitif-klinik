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

// Start Session globally
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

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
$twig = $container->get(\Slim\Views\Twig::class)->getEnvironment();
$twig->addGlobal('base_path', $basePath);
$twig->addGlobal('version', $container->get('settings')['settings']['version']);

/**
 * Middleware Registration (LIFO - Last Added = First Executed / Outer Most)
 * ORDER IS CRITICAL!
 */

// 1. Body Parsing (Inner-most logic helper)
$app->addBodyParsingMiddleware();

// 2. Routing (Maps URL to Controller)
$app->addRoutingMiddleware();

// 4. Error Middleware (Catches exceptions from inner layers like Routing 404s)
$displayErrorDetails = filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOLEAN);
$logError = true;
$logErrorDetails = true;

$errorMiddleware = $app->addErrorMiddleware($displayErrorDetails, $logError, $logErrorDetails);
$errorMiddleware->setDefaultErrorHandler(
    new \App\Core\HttpErrorHandler(
        $app->getCallableResolver(),
        $app->getResponseFactory(),
        $container->get(\App\Core\Service\LoggerService::class)
    )
);

// 3. Request Logging (Logs all requests, wraps Error Middleware to capture final response)
$app->add(\App\Core\Middleware\RequestLoggingMiddleware::class);

// 5. Security Headers (Adds headers to ALL responses, including Errors)
$app->add(new \App\Core\Middleware\SecurityHeadersMiddleware());

// 6. CORS (Handles cross-origin requests for everything)
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
