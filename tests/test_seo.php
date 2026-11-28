<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Domain\Email\EmailService;
use App\Domain\Platform\TenantRepository;
use DI\ContainerBuilder;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$_ENV['DB_HOST'] ??= '127.0.0.1';
$_ENV['DB_NAME'] ??= 'pozitif_test';
$_ENV['DB_USER'] ??= 'test';
$_ENV['DB_PASS'] ??= 'test';
$_ENV['APP_KEY'] ??= str_repeat('a', 64);
$_ENV['BLIND_INDEX_KEY'] ??= str_repeat('b', 64);

$containerBuilder = new ContainerBuilder();
$containerBuilder->addDefinitions(__DIR__ . '/../config/container.php');
$containerBuilder->addDefinitions([
    \App\Core\Database::class => function () {
        return (new ReflectionClass(\App\Core\Database::class))->newInstanceWithoutConstructor();
    },
    PDO::class => function () {
        return new class extends PDO {
            public function __construct()
            {
            }
        };
    },
    TenantRepository::class => function () {
        return new class extends TenantRepository {
            public function __construct()
            {
            }

            public function findByDomain(string $domain): ?array
            {
                return null;
            }
        };
    },
    EmailService::class => function () {
        return (new ReflectionClass(EmailService::class))->newInstanceWithoutConstructor();
    },
]);
$container = $containerBuilder->build();

AppFactory::setContainer($container);
$app = AppFactory::create();
$app->addRoutingMiddleware();

$routes = require __DIR__ . '/../config/routes.php';
$routes($app);

$requestFactory = new ServerRequestFactory();
$allPassed = true;

$assert = function (bool $condition, string $label) use (&$allPassed): void {
    if ($condition) {
        echo "[PASS] {$label}\n";
    } else {
        echo "[FAIL] {$label}\n";
        $allPassed = false;
    }
};

// 1. Sitemap XML (dinamik host)
$reqSitemap = $requestFactory->createServerRequest('GET', 'https://example-clinic.test/sitemap.xml');
$resSitemap = $app->handle($reqSitemap);
$sitemapBody = (string) $resSitemap->getBody();

$assert($resSitemap->getStatusCode() === 200, 'GET /sitemap.xml returns 200');
$assert(str_contains($resSitemap->getHeaderLine('Content-Type'), 'application/xml'), 'GET /sitemap.xml returns application/xml');
$xmlObj = @simplexml_load_string($sitemapBody);
$assert($xmlObj !== false, 'GET /sitemap.xml is valid XML');
$assert(str_contains($sitemapBody, '<loc>https://example-clinic.test/</loc>'), 'Sitemap contains dynamic root URL');
$assert(str_contains($sitemapBody, '<loc>https://example-clinic.test/hakkimizda</loc>'), 'Sitemap contains /hakkimizda');
$assert(str_contains($sitemapBody, '<loc>https://example-clinic.test/iletisim</loc>'), 'Sitemap contains /iletisim');
$assert(str_contains($sitemapBody, '<loc>https://example-clinic.test/kvkk</loc>'), 'Sitemap contains /kvkk');
$assert(str_contains($sitemapBody, '<loc>https://example-clinic.test/acik-riza-metni</loc>'), 'Sitemap contains /acik-riza-metni');
$assert(str_contains($sitemapBody, '<loc>https://example-clinic.test/aydinlatma-metni</loc>'), 'Sitemap contains /aydinlatma-metni');

// 2. Halka açık sayfalarda dinamik canonical ve index, follow kontrolü
$publicPages = ['/', '/hakkimizda', '/iletisim', '/kvkk', '/acik-riza-metni', '/aydinlatma-metni'];
foreach ($publicPages as $path) {
    $req = $requestFactory->createServerRequest('GET', 'https://example-clinic.test' . $path . '?utm_source=test');
    $res = $app->handle($req);
    $html = (string) $res->getBody();

    $assert($res->getStatusCode() === 200, "GET {$path} returns 200");
    $assert(str_contains($html, '<link rel="canonical" href="https://example-clinic.test' . $path . '">'), "GET {$path} has clean dynamic canonical");
    $assert(str_contains($html, '<meta name="robots" content="index, follow">'), "GET {$path} has index, follow");
}

// 3. Giriş sayfalarında noindex, nofollow kontrolü
foreach (['/admin/login', '/platform/login'] as $loginPath) {
    $req = $requestFactory->createServerRequest('GET', 'https://example-clinic.test' . $loginPath);
    $res = $app->handle($req);
    $html = (string) $res->getBody();

    $assert($res->getStatusCode() === 200, "GET {$loginPath} returns 200");
    $assert(str_contains($html, '<meta name="robots" content="noindex, nofollow">'), "GET {$loginPath} has noindex, nofollow");
}

exit($allPassed ? 0 : 1);
