<?php

declare(strict_types=1);

namespace App\Domain\System;

use App\Core\Attributes\Group;
use App\Core\Attributes\Route;
use App\Core\BaseController;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * HealthController - Sistem Sağlığı
 * 
 * API'nin çalışıp çalışmadığını kontrol eden endpoint.
 */
#[Group('/api')]
class HealthController extends BaseController
{
    /**
     * Sağlık Kontrolü (Health Check)
     */
    #[Route('GET', '/')]
    public function healthCheck(Request $request, Response $response): Response
    {
        return $this->success($response, [
            'service' => 'Pozitif Klinik API',
            'version' => '1.0.0',
            'status' => 'active'
        ], 'Pozitif Klinik Backend Running...');
    }
}
