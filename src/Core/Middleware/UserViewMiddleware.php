<?php

declare(strict_types=1);

namespace App\Core\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use Slim\Views\Twig;
use App\Core\Service\SessionService;

class UserViewMiddleware implements MiddlewareInterface
{
    private Twig $twig;
    private SessionService $session;

    public function __construct(Twig $twig, SessionService $session)
    {
        $this->twig = $twig;
        $this->session = $session;
    }

    public function process(Request $request, Handler $handler): Response
    {
        if ($this->session->has('user_id')) {
            $role = $this->session->get('role');

            // Rol isimlerini Türkçeleştir
            $roleText = match ($role) {
                'admin' => 'Yönetici',
                'doctor' => 'Doktor',
                'secretary' => 'Sekreter',
                default => 'Personel'
            };

            $this->twig->getEnvironment()->addGlobal('user', [
                'id' => $this->session->get('user_id'),
                'username' => $this->session->get('username'),
                'name' => $this->session->get('name'),
                'role' => $role,
                'role_text' => $roleText
            ]);
        }

        return $handler->handle($request);
    }
}
