<?php

declare(strict_types=1);

return [
    'settings' => [
        'displayErrorDetails' => filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOLEAN),
        'logError' => true,
        'logErrorDetails' => true,
        'db' => [
            'host' => ($_ENV['APP_ENV'] ?? 'production') === 'development' ? ($_ENV['LOCAL_DB_HOST'] ?? $_ENV['DB_HOST']) : $_ENV['DB_HOST'],
            'name' => ($_ENV['APP_ENV'] ?? 'production') === 'development' ? ($_ENV['LOCAL_DB_NAME'] ?? $_ENV['DB_NAME']) : $_ENV['DB_NAME'],
            'user' => ($_ENV['APP_ENV'] ?? 'production') === 'development' ? ($_ENV['LOCAL_DB_USER'] ?? $_ENV['DB_USER']) : $_ENV['DB_USER'],
            'pass' => ($_ENV['APP_ENV'] ?? 'production') === 'development' ? ($_ENV['LOCAL_DB_PASS'] ?? $_ENV['DB_PASS']) : $_ENV['DB_PASS'],
            'charset' => 'utf8mb4',
            'flags' => [
                // Turn off persistent connections
                PDO::ATTR_PERSISTENT => false,
                // Enable exceptions
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                // Emulate prepared statements
                PDO::ATTR_EMULATE_PREPARES => false,
                // Set default fetch mode to array
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                // Set character set
                1002 => 'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci'
            ],
        ],
        'logger' => [
            'name' => 'pozitif-klinik',
            'path' => __DIR__ . '/../var/logs', // Logların birikeceği yer
            'filename' => 'app.log',
            'level' => ($_ENV['LOG_LEVEL'] ?? 'DEBUG') === 'DEBUG' ? \Monolog\Level::Debug : \Monolog\Level::Error,
        ],
        'version' => time(), // Her deploy/restartta cache bust için timestamp kullanıyoruz (Geliştirme Modu)
    ],
];
