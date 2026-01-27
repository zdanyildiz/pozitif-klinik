<?php

declare(strict_types=1);

return [
    'settings' => [
        'displayErrorDetails' => filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOLEAN),
        'logError' => true,
        'logErrorDetails' => true,
        'db' => [
            'host' => $_ENV['DB_HOST'] ?? 'localhost',
            'name' => $_ENV['DB_NAME'] ?? 'pozitif_klinik',
            'user' => $_ENV['DB_USER'] ?? 'root',
            'pass' => $_ENV['DB_PASS'] ?? '',
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
