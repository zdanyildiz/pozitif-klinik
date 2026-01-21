<?php

declare(strict_types=1);

namespace App\Domain\Email;

/**
 * E-posta gönderim sonucu DTO'su
 * 
 * PHP 8.2 readonly class ve constructor promotion kullanır.
 */
readonly class EmailResult
{
    public function __construct(
        public bool $success,
        public string $message,
        public string $configSource = 'unknown',
        public int $errorCode = 0
    ) {
    }

    /**
     * JSON serialization için
     */
    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'message' => $this->message,
            'config_source' => $this->configSource,
            'error_code' => $this->errorCode,
        ];
    }
}
