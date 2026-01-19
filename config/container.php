<?php

declare(strict_types=1);

use Psr\Container\ContainerInterface;
use App\Core\Database;

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
];
