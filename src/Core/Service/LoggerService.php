<?php

declare(strict_types=1);

namespace App\Core\Service;

use App\Core\LoggerFactory;
use Psr\Log\LoggerInterface;

class LoggerService
{
    private array $settings;
    private LoggerInterface $mainLogger;
    private array $clinicLoggers = [];

    public function __construct(LoggerInterface $mainLogger, array $settings)
    {
        $this->mainLogger = $mainLogger;
        $this->settings = $settings;
    }

    /**
     * Get the appropriate logger.
     * If a clinic ID is provided, returns a clinic-specific logger.
     * Otherwise returns the main system logger.
     */
    public function getLogger(?int $clinicId = null): LoggerInterface
    {
        if ($clinicId === null || $clinicId <= 0) {
            return $this->mainLogger;
        }

        if (!isset($this->clinicLoggers[$clinicId])) {
            $this->clinicLoggers[$clinicId] = LoggerFactory::createForClinic($clinicId, $this->settings);
        }

        return $this->clinicLoggers[$clinicId];
    }

    /**
     * Get the main system logger.
     */
    public function getMainLogger(): LoggerInterface
    {
        return $this->mainLogger;
    }
}
