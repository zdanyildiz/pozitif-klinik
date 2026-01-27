<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Core\Attributes\Route;

class HomeWebController
{
    /**
     * Ana Sayfa Yönlendirmesi
     * 
     * Kullanıcılar domain adresine (örn: pozitifklinik.com) girdiklerinde
     * doğrudan admin giriş paneline yönlendirilir.
     */
    #[Route('GET', '/')]
    public function index(Request $request, Response $response): Response
    {
        return $response
            ->withHeader('Location', '/admin/login')
            ->withStatus(302);
    }
}
