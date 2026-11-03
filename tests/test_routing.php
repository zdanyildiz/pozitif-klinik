<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use DI\ContainerBuilder;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

// Start Session globally
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$containerBuilder = new ContainerBuilder();
$containerBuilder->addDefinitions(__DIR__ . '/../config/container.php');
$container = $containerBuilder->build();

AppFactory::setContainer($container);
$app = AppFactory::create();

$app->addRoutingMiddleware();

$errorMiddleware = $app->addErrorMiddleware(true, true, true);
$errorMiddleware->setDefaultErrorHandler(
    new \App\Core\HttpErrorHandler(
        $app->getCallableResolver(),
        $app->getResponseFactory(),
        $container->get(\App\Core\Service\LoggerService::class)
    )
);

$app->add(\App\Core\Middleware\RequestLoggingMiddleware::class);
$app->addBodyParsingMiddleware();
$app->add(new \App\Core\Middleware\SecurityHeadersMiddleware());

$app->add(function ($request, $handler) use ($app) {
    if ($request->getMethod() === 'OPTIONS') {
        $response = $app->getResponseFactory()->createResponse(200);
    } else {
        $response = $handler->handle($request);
    }
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
});

$routes = require __DIR__ . '/../config/routes.php';
$routes($app);

$app->get('/test-route-ok', function ($request, $response) {
    $response->getBody()->write('ok');
    return $response;
});

$requestFactory = new ServerRequestFactory();

$tests = [
    [
        'name' => 'GET registered route returns 200',
        'method' => 'GET',
        'uri' => '/test-route-ok',
        'expected_status' => 200,
        'check_cors' => true
    ],
    [
        'name' => 'OPTIONS preflight request',
        'method' => 'OPTIONS',
        'uri' => '/api/v1/auth/login',
        'expected_status' => 200,
        'check_cors' => true
    ],
    [
        'name' => 'OPTIONS preflight on unknown path',
        'method' => 'OPTIONS',
        'uri' => '/some/unknown/path',
        'expected_status' => 200,
        'check_cors' => true
    ],
    [
        'name' => 'GET non-existent .well-known route (incident trigger returns 404, not 405)',
        'method' => 'GET',
        'uri' => '/.well-known/bbf-not-found-3a28b8b29cf99004',
        'expected_status' => 404,
        'check_cors' => true
    ],
    [
        'name' => 'GET random non-existent route returns 404',
        'method' => 'GET',
        'uri' => '/random-404-check',
        'expected_status' => 404,
        'check_cors' => true
    ],
];

$allPassed = true;

foreach ($tests as $t) {
    $req = $requestFactory->createServerRequest($t['method'], $t['uri']);
    $res = $app->handle($req);
    $status = $res->getStatusCode();
    
    $corsHeader = $res->getHeaderLine('Access-Control-Allow-Origin');
    $corsOk = (!$t['check_cors']) || ($corsHeader === '*');
    
    $pass = ($status === $t['expected_status']) && $corsOk;
    
    if ($pass) {
        echo "[PASS] {$t['name']} -> Status: {$status} (Expected: {$t['expected_status']}), CORS: {$corsHeader}\n";
    } else {
        echo "[FAIL] {$t['name']} -> Status: {$status} (Expected: {$t['expected_status']}), CORS: {$corsHeader}\n";
        $body = (string)$res->getBody();
        echo "       Body: " . substr($body, 0, 200) . "\n";
        $allPassed = false;
    }
}

if ($allPassed) {
    echo "\nAll routing integration tests PASSED successfully!\n";
    exit(0);
} else {
    echo "\nSome routing tests FAILED!\n";
    exit(1);
}
