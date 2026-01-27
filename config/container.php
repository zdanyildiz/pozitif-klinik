<?php

declare(strict_types=1);

use Psr\Container\ContainerInterface;
use App\Core\Database;
use App\Core\Security\CryptoService;
use App\Core\Service\SessionService;
use App\Domain\Email\EmailService;
use App\Domain\Platform\TenantRepository;
use App\Domain\Platform\TenantEmailConfigRepository;
use App\Domain\Platform\TenantSettingsController;
use Slim\Views\Twig;
use Slim\Factory\AppFactory;
use Psr\Http\Message\ResponseFactoryInterface;

return [
        // Twig View Engine
    Twig::class => function (ContainerInterface $c) {
        $settings = $c->get('settings');
        // Cache false for development
        return Twig::create(__DIR__ . '/../src/Views', ['cache' => false]);
    },

    'settings' => function () {
        return require __DIR__ . '/settings.php';
    },

    Database::class => function (ContainerInterface $c) {
        $settings = $c->get('settings');
        // We pass the 'db' settings specifically
        return Database::getInstance($settings['settings']['db']);
    },

    // Alias for PDO if needed directly
    PDO::class => function (ContainerInterface $c) {
        return $c->get(Database::class)->getConnection();
    },

    \Psr\Log\LoggerInterface::class => function (ContainerInterface $c) {
        $settings = $c->get('settings');
        return \App\Core\LoggerFactory::create($settings['settings']['logger']);
    },

        // Kriptografi Servisi (AES-256-GCM)
        // Hassas hasta verileri için şifreleme altyapısı
    CryptoService::class => function (ContainerInterface $c) {
        $appKey = $_ENV['APP_KEY'] ?? getenv('APP_KEY');

        if (empty($appKey)) {
            throw new \RuntimeException(
                'APP_KEY environment variable is not set. ' .
                'Generate a 64-character hex string for AES-256 encryption.'
            );
        }

        return new CryptoService($appKey);
    },

        // E-Posta Gönderim Servisi
        // Multi-tenant SMTP yapılandırması destekler
    EmailService::class => function (ContainerInterface $c) {
        return new EmailService(
            $c->get(Database::class),
            $c->get(CryptoService::class),
            $c->get(\Psr\Log\LoggerInterface::class)
        );
    },

        // Tenant (Klinik) Repository
    TenantRepository::class => function (ContainerInterface $c) {
        return new TenantRepository(
            $c->get(Database::class)
        );
    },

        // Tenant E-posta Config Repository
    TenantEmailConfigRepository::class => function (ContainerInterface $c) {
        return new TenantEmailConfigRepository(
            $c->get(Database::class)
        );
    },

        // Tenant Ayarları Controller
    TenantSettingsController::class => function (ContainerInterface $c) {
        return new TenantSettingsController(
            $c,
            $c->get(TenantRepository::class),
            $c->get(TenantEmailConfigRepository::class),
            $c->get(CryptoService::class),
            $c->get(EmailService::class)
        );
    },

        // Oturum Yönetim Servisi
    SessionService::class => function (ContainerInterface $c) {
        return new SessionService();
    },

    // CSRF Koruması
    \Slim\Csrf\Guard::class => function (ContainerInterface $c) {
        $responseFactory = AppFactory::determineResponseFactory();
        $guard = new \Slim\Csrf\Guard($responseFactory);
        $guard->setPersistentTokenMode(true);
        return $guard;
    },

    // Rate Limiting Middleware
    \App\Core\Middleware\RateLimitMiddleware::class => function (ContainerInterface $c) {
        return new \App\Core\Middleware\RateLimitMiddleware($c->get(Database::class));
    },

    // Request Logging Middleware
    \App\Core\Middleware\RequestLoggingMiddleware::class => function (ContainerInterface $c) {
        return new \App\Core\Middleware\RequestLoggingMiddleware($c->get(\Psr\Log\LoggerInterface::class));
    },
];
