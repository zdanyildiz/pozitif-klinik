<?php

declare(strict_types=1);

namespace App\Domain\System;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\BaseController;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;

#[Group('/api/general')]
class GeneralController extends BaseController
{
    private GeneralRepository $repository;

    public function __construct(ContainerInterface $container, GeneralRepository $repository)
    {
        parent::__construct($container);
        $this->repository = $repository;
    }

    /**
     * İlleri listeler
     */
    #[Route('GET', '/provinces')]
    public function listProvinces(Request $request, Response $response): Response
    {
        $provinces = $this->repository->getProvinces();
        return $this->success($response, $provinces);
    }

    /**
     * İle göre ilçeleri listeler
     */
    #[Route('GET', '/districts')]
    public function listDistricts(Request $request, Response $response): Response
    {
        $queryParams = $request->getQueryParams();
        $provinceId = isset($queryParams['province_id']) ? (int) $queryParams['province_id'] : null;

        if (!$provinceId) {
            return $this->error($response, 'province_id parametresi zorunludur', 400);
        }

        $districts = $this->repository->getDistricts($provinceId);
        return $this->success($response, $districts);
    }
}
