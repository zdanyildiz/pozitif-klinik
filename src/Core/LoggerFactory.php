<?php

declare(strict_types=1);

namespace App\Core;

use Monolog\Handler\RotatingFileHandler;
use Monolog\Logger;
use Monolog\Processor\IntrospectionProcessor;
use Monolog\Processor\UidProcessor;
use Psr\Log\LoggerInterface;

class LoggerFactory
{
    public static function create(array $settings): LoggerInterface
    {
        $logger = new Logger($settings['name']);

        $filename = sprintf('%s/%s', $settings['path'], $settings['filename']);
        $handler = new RotatingFileHandler($filename, 30, $settings['level']);

        $logger->pushHandler($handler);
        $logger->pushProcessor(new UidProcessor());
        $logger->pushProcessor(new IntrospectionProcessor());

        return $logger;
    }
}
