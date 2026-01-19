<?php

declare(strict_types=1);

namespace App\Core;

use Psr\Http\Message\ResponseInterface;
use Slim\Handlers\ErrorHandler;
use Throwable;
use Slim\Exception\HttpException;
use Slim\Exception\HttpNotFoundException;
use Psr\Log\LoggerInterface;

class HttpErrorHandler extends ErrorHandler
{
    private ?string $traceId = null;

    /**
     * @inheritdoc
     */
    protected function logError(string $error): void
    {
        $exception = $this->exception;
        $traceId = $this->getTraceId();

        // Determine log level
        $level = 'error';
        if ($exception instanceof HttpNotFoundException) {
            $level = 'info';
        }

        // Prepare context
        $context = [
            'trace_id' => $traceId,
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString(),
            'method' => $this->request->getMethod(),
            'url' => (string) $this->request->getUri(),
        ];

        // Add user/clinic info if available
        $clinicId = $this->request->getAttribute('clinic_id');
        $userId = $this->request->getAttribute('user_id');

        if ($clinicId)
            $context['clinic_id'] = $clinicId;
        if ($userId)
            $context['user_id'] = $userId;

        // Log the error
        $this->logger->log($level, $exception->getMessage(), $context);
    }

    /**
     * @inheritdoc
     */
    protected function respond(): ResponseInterface
    {
        $exception = $this->exception;
        $statusCode = 500;
        $message = 'Beklenmedik bir hata oluştu.';

        if ($exception instanceof HttpException) {
            $statusCode = (int) $exception->getCode();
            $message = $exception->getMessage();
        }

        // For production, hide specific details
        if (!$this->displayErrorDetails && !($exception instanceof HttpException)) {
            $message = 'Beklenmedik bir hata oluştu.';
        }

        $payload = [
            'success' => false,
            'error' => [
                'code' => $statusCode,
                'message' => $message,
                'trace_id' => $this->getTraceId()
            ],
        ];

        $response = $this->responseFactory->createResponse($statusCode);
        $response->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));

        return $response->withHeader('Content-Type', 'application/json');
    }

    private function getTraceId(): string
    {
        if ($this->traceId === null) {
            $this->traceId = substr(bin2hex(random_bytes(4)), 0, 8);
        }
        return $this->traceId;
    }
}
