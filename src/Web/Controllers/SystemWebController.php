<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Service\SessionService;

/**
 * SystemWebController - Genel Sistem Rotaları
 * 
 * /admin yönlendirmesi ve /ping servis kontrolünü yönetir.
 */
#[Group('')]
class SystemWebController
{
    private SessionService $session;

    public function __construct(SessionService $session)
    {
        $this->session = $session;
    }

    /**
     * Sistem Sağlık Kontrolü (Health Check)
     */
    #[Route('GET', '/ping')]
    public function ping(Request $request, Response $response): Response
    {
        $payload = [
            'status' => 'pong',
            'time' => time(),
            'environment' => $_ENV['APP_ENV'] ?? 'development'
        ];

        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
        $response->getBody()->write($json);

        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus(200);
    }

    /**
     * Admin Ana Dizin Yönlendirmesi
     * 
     * Eğer giriş yapılmışsa dashboard'a, yapılmamışsa login'e yönlendirir.
     */
    #[Route('GET', '/admin')]
    public function adminRoot(Request $request, Response $response): Response
    {
        $target = '/admin/login';

        if ($this->session->has('user_id')) {
            $target = '/admin/patients';
        }

        return $response
            ->withHeader('Location', $target)
            ->withStatus(302);
    }
}
