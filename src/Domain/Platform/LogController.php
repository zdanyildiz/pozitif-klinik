<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\BaseController;
use App\Core\Service\LogReaderService;
use App\Middleware\PlatformAdminMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;

#[Group('/platform-admin/logs')]
#[Middleware(PlatformAdminMiddleware::class)]
class LogController extends BaseController
{
    private LogReaderService $logReader;

    public function __construct(ContainerInterface $container, LogReaderService $logReader)
    {
        parent::__construct($container);
        $this->logReader = $logReader;
    }

    /**
     * Logları listele
     */
    #[Route('GET', '')]
    public function list(Request $request, Response $response): Response
    {
        $queryParams = $request->getQueryParams();
        $date = $queryParams['date'] ?? date('Y-m-d');
        $level = $queryParams['level'] ?? 'ALL';
        $search = $queryParams['search'] ?? null;
        $limit = isset($queryParams['limit']) ? (int) $queryParams['limit'] : 500;

        $logs = $this->logReader->getLogs($date, $level, $search, $limit);

        return $this->success($response, [
            'logs' => $logs,
            'date' => $date,
            'level' => $level,
            'count' => count($logs)
        ]);
    }

    /**
     * Mevcut log tarihlerini getir
     */
    #[Route('GET', '/available-dates')]
    public function dates(Request $request, Response $response): Response
    {
        $dates = $this->logReader->getAvailableDates();
        return $this->success($response, $dates);
    }
}
