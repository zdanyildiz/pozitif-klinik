<?php

declare(strict_types=1);

namespace App\Domain\Activity;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\BaseController;
use App\Middleware\TenantMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;

/**
 * ActivityLogController - İşlem Geçmişi API
 */
#[Group('/api/logs')]
#[Middleware(TenantMiddleware::class)]
class ActivityLogController extends BaseController
{
    private ActivityLogRepository $repository;

    public function __construct(ContainerInterface $container, ActivityLogRepository $repository)
    {
        parent::__construct($container);
        $this->repository = $repository;
    }

    #[Route('GET', '')]
    public function list(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $params = $request->getQueryParams();

        // Sayfalama
        $page = isset($params['page']) ? (int) $params['page'] : 1;
        $limit = isset($params['limit']) ? (int) $params['limit'] : 30;
        $offset = ($page - 1) * $limit;

        // Filtreler
        $filters = [];
        if (!empty($params['module'])) {
            $filters['module'] = $params['module'];
        }
        if (!empty($params['start_date'])) {
            $filters['start_date'] = $params['start_date'];
        }
        if (!empty($params['end_date'])) {
            $filters['end_date'] = $params['end_date'];
        }

        // DEBUG LOG
        error_log("ActivityLogController::list -> ClinicID: $clinicId, Filters: " . json_encode($filters) . ", Limit: $limit, Offset: $offset");

        $logs = $this->repository->findAll($clinicId, $filters, $limit, $offset);
        $total = $this->repository->count($clinicId, $filters);

        // DEBUG LOG
        error_log("ActivityLogController::list -> Found Logs: " . count($logs) . ", Total: $total");

        return $this->success($response, [
            'logs' => $logs,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $limit,
                'total' => $total,
                'last_page' => ceil($total / $limit)
            ]
        ]);
    }
}
