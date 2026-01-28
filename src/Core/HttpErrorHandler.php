<?php

declare(strict_types=1);

namespace App\Core;

use Psr\Http\Message\ResponseInterface;
use Slim\Handlers\ErrorHandler;
use Throwable;
use Slim\Exception\HttpException;
use Slim\Exception\HttpNotFoundException;
use Psr\Log\LoggerInterface;
use App\Core\Service\LoggerService;
use Psr\Http\Message\ResponseFactoryInterface;
use Slim\Interfaces\CallableResolverInterface;

class HttpErrorHandler extends ErrorHandler
{
    private ?string $traceId = null;
    private LoggerService $loggerService;

    public function __construct(
        CallableResolverInterface $callableResolver,
        ResponseFactoryInterface $responseFactory,
        LoggerService $loggerService,
        ?LoggerInterface $logger = null
    ) {
        parent::__construct($callableResolver, $responseFactory, $logger ?? $loggerService->getMainLogger());
        $this->loggerService = $loggerService;
    }

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
            $level = 'debug'; // Gereksiz 404 loglarını debug'a çekelim
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

        // Uygun logger'ı seç (Klinik bazlı mı yoksa ana sistem mi?)
        $logger = $this->loggerService->getLogger($clinicId ? (int) $clinicId : null);
        $logger->log($level, $exception->getMessage(), $context);
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
            'status' => false,
            'message' => $message,
            'data' => [
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
