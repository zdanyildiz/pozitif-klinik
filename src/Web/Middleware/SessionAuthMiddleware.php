<?php

declare(strict_types=1);

namespace App\Web\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Psr7\Response as SlimResponse;

class SessionAuthMiddleware implements MiddlewareInterface
{
    public function process(Request $request, RequestHandler $handler): Response
    {
        // Oturum başlatılmamışsa başlat
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        // Oturum kontrolü
        if (empty($_SESSION['user_id'])) {
            $response = new SlimResponse();
            return $response
                ->withHeader('Location', '/admin/login')
                ->withStatus(302);
        }

        return $handler->handle($request);
    }
}
