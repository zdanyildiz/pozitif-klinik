<?php

declare(strict_types=1);

use Psr\Container\ContainerInterface;
use App\Core\Database;
use App\Core\Security\CryptoService;

return [
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
];
