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
use App\Core\Service\LogReaderService;
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
        $blindIndexKey = $_ENV['BLIND_INDEX_KEY'] ?? getenv('BLIND_INDEX_KEY');

        if (empty($appKey)) {
            throw new \RuntimeException(
                'APP_KEY environment variable is not set. ' .
                'Generate a 64-character hex string for AES-256 encryption.'
            );
        }

        if (empty($blindIndexKey)) {
            throw new \RuntimeException(
                'BLIND_INDEX_KEY environment variable is not set. ' .
                'Run "openssl rand -hex 32" and add it to .env'
            );
        }

        return new CryptoService($appKey, $blindIndexKey);
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
            $c->get(Database::class),
            $c->get(\Psr\Log\LoggerInterface::class)
        );
    },

        // Tenant E-posta Config Repository
    TenantEmailConfigRepository::class => function (ContainerInterface $c) {
        return new TenantEmailConfigRepository(
            $c->get(Database::class)
        );
    },

    // --- Domain Repositories (Klinik İşlemleri) ---

    // Patient Repository
    \App\Domain\Patient\PatientRepository::class => function (ContainerInterface $c) {
        return new \App\Domain\Patient\PatientRepository(
            $c->get(Database::class),
            $c->get(CryptoService::class),
            $c->get(\App\Domain\Activity\ActivityLogger::class)
        );
    },

    // Activity Logger (PatientRepository için gerekli)
    \App\Domain\Activity\ActivityLogger::class => function (ContainerInterface $c) {
        return new \App\Domain\Activity\ActivityLogger(
            $c->get(Database::class)
        );
    },

    // Examination Repository
    \App\Domain\Examination\ExaminationRepository::class => function (ContainerInterface $c) {
        return new \App\Domain\Examination\ExaminationRepository(
            $c->get(Database::class)
        );
    },

    // Lab Repository
    \App\Domain\Lab\LabRepository::class => function (ContainerInterface $c) {
        return new \App\Domain\Lab\LabRepository(
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

    \Slim\Csrf\Guard::class => function (ContainerInterface $c) {
        $responseFactory = AppFactory::determineResponseFactory();
        $guard = new \Slim\Csrf\Guard($responseFactory);
        $guard->setPersistentTokenMode(true);

        // CSRF başarısız olduğunda çalışacak özel hata işleyici
        $guard->setFailureHandler(function ($request, $handler) use ($c, $responseFactory) {
            $logger = $c->get(\Psr\Log\LoggerInterface::class);
            $logger->error('CSRF Check Failed', [
                'uri' => (string) $request->getUri(),
                'method' => $request->getMethod(),
                'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
            ]);

            $response = $responseFactory->createResponse();
            $response->getBody()->write('Güvenlik doğrulaması (CSRF) başarısız oldu. Lütfen sayfayı yenileyip tekrar deneyin.');
            return $response->withHeader('Content-Type', 'text/plain; charset=utf-8')->withStatus(400);
        });

        return $guard;
    },

    // Rate Limiting Middleware
    \App\Core\Middleware\RateLimitMiddleware::class => function (ContainerInterface $c) {
        return new \App\Core\Middleware\RateLimitMiddleware($c->get(Database::class));
    },

    // Request Logging Middleware
    \App\Core\Middleware\RequestLoggingMiddleware::class => function (ContainerInterface $c) {
        return new \App\Core\Middleware\RequestLoggingMiddleware(
            $c->get(\App\Core\Service\LoggerService::class)
        );
    },

    // Logger Service
    \App\Core\Service\LoggerService::class => function (ContainerInterface $c) {
        $settings = $c->get('settings');
        return new \App\Core\Service\LoggerService(
            $c->get(\Psr\Log\LoggerInterface::class),
            $settings['settings']['logger']
        );
    },

        // Log Okuyucu Servisi
    LogReaderService::class => function (ContainerInterface $c) {
        $settings = $c->get('settings');
        return new LogReaderService($settings['settings']['logger']['path']);
    },

    // --- Dosya Modülü Servisleri ---

    // Storage Service (Fiziksel Dosya Yönetimi)
    \App\Core\Service\StorageService::class => function (ContainerInterface $c) {
        return new \App\Core\Service\StorageService(); // Varsayılan: project_root/var/uploads
    },

    // File Repository (Veritabanı)
    \App\Domain\File\FileRepository::class => function (ContainerInterface $c) {
        return new \App\Domain\File\FileRepository(
            $c->get(Database::class)
        );
    },

    // File Service (Domain Logic)
    \App\Domain\File\FileService::class => function (ContainerInterface $c) {
        return new \App\Domain\File\FileService(
            $c->get(\App\Core\Service\StorageService::class),
            $c->get(\App\Domain\File\FileRepository::class),
            $c->get(CryptoService::class)
        );
    },

    // File Controller
    \App\Domain\File\FileController::class => function (ContainerInterface $c) {
        return new \App\Domain\File\FileController($c);
    },

    // --- Doküman / Epikriz Modülü ---

    // Document Repository (Veritabanı)
    \App\Domain\Document\DocumentRepository::class => function (ContainerInterface $c) {
        return new \App\Domain\Document\DocumentRepository(
            $c->get(Database::class)
        );
    },

    // Document Service (İş Mantığı)
    \App\Domain\Document\DocumentService::class => function (ContainerInterface $c) {
        return new \App\Domain\Document\DocumentService(
            $c->get(\App\Domain\Document\DocumentRepository::class),
            $c->get(\App\Domain\Patient\PatientRepository::class),
            $c->get(\App\Domain\Examination\ExaminationRepository::class),
            $c->get(\App\Domain\Lab\LabRepository::class),
            $c->get(TenantRepository::class),
            $c->get(CryptoService::class),
            $c->get(Twig::class),
            $c->get(\Psr\Log\LoggerInterface::class),
            $c->get(Database::class)
        );
    },

    // Document Controller
    \App\Domain\Document\DocumentController::class => function (ContainerInterface $c) {
        return new \App\Domain\Document\DocumentController(
            $c,
            $c->get(\App\Domain\Document\DocumentService::class),
            $c->get(\App\Domain\Document\DocumentRepository::class)
        );
    },

    // Platform Document Controller
    \App\Domain\Platform\PlatformDocumentController::class => function (ContainerInterface $c) {
        return new \App\Domain\Platform\PlatformDocumentController(
            $c,
            $c->get(\App\Domain\Document\DocumentRepository::class)
        );
    },
];
