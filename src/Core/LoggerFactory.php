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

    /**
     * Klinik bazlı özelleştirilmiş logger oluşturur.
     * Logları var/logs/clinic_{id}/app.log formatında saklar.
     */
    public static function createForClinic(int $clinicId, array $settings): LoggerInterface
    {
        $clinicPath = sprintf('%s/clinic_%d', rtrim($settings['path'], '/'), $clinicId);

        if (!is_dir($clinicPath)) {
            mkdir($clinicPath, 0777, true);
        }

        $settings['path'] = $clinicPath;
        $settings['name'] = "Clinic_{$clinicId}";

        return self::create($settings);
    }
}
