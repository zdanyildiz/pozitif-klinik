<?php

declare(strict_types=1);

namespace App\Domain\File;

use App\Core\BaseController;
use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Middleware\TenantMiddleware;
use Psr\Container\ContainerInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;
use Slim\Exception\HttpNotFoundException;

/**
 * FileController
 * 
 * Dosya yükleme ve erişim işlemleri için API uçları.
 */
use App\Domain\Patient\PatientRepository;

#[Group('/api/files')]
#[Middleware(TenantMiddleware::class)]
class FileController extends BaseController
{
    private FileService $fileService;
    private LoggerInterface $logger;
    private PatientRepository $patientRepository;

    public function __construct(ContainerInterface $container)
    {
        parent::__construct($container);
        $this->fileService = $container->get(FileService::class);
        $this->logger = $container->get(LoggerInterface::class);
        $this->patientRepository = $container->get(PatientRepository::class);
    }

    /**
     * Dosya Yükleme Endpoint'i
     * POST /api/files/upload
     */
    #[Route('POST', '/upload')]
    public function upload(Request $request, Response $response): Response
    {
        $clinicId = $this->getClinicId($request);
        $userId = $this->getUserId($request);

        // Parametreleri al (Form data)
        $body = $request->getParsedBody();
        $module = $body['module'] ?? null;
        $relatedId = isset($body['related_id']) ? (int) $body['related_id'] : null;

        // Validasyon
        if (!$module || !$relatedId) {
            return $this->error($response, 'Eksik parametreler: module ve related_id gereklidir.', 400);
        }

        // Dosya kontrolü
        $uploadedFiles = $request->getUploadedFiles();
        if (empty($uploadedFiles['file'])) {
            return $this->error($response, 'Dosya yüklenmedi.', 400);
        }

        /** @var \Psr\Http\Message\UploadedFileInterface $uploadedFile */
        $uploadedFile = $uploadedFiles['file'];

        if ($uploadedFile->getError() !== UPLOAD_ERR_OK) {
            return $this->error($response, 'Dosya yükleme hatası: ' . $uploadedFile->getError(), 500);
        }

        try {
            $result = $this->fileService->upload(
                $uploadedFile,
                $clinicId,
                $module,
                $relatedId,
                $userId,
                $body['display_name'] ?? null,
                $body['file_category'] ?? 'other'
            );

            $this->logger->info("File uploaded", [
                'clinic_id' => $clinicId,
                'module' => $module,
                'related_id' => $relatedId,
                'file_uuid' => $result['uuid']
            ]);

            return $this->createdResponse($response, $result, 'Dosya başarıyla yüklendi.');
        } catch (\Exception $e) {
            $this->logger->error("File upload error", [
                'error' => $e->getMessage(),
                'clinic_id' => $clinicId
            ]);
            return $this->error($response, 'Dosya yüklenirken hata oluştu: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Dosya Arama Endpoint'i
     * GET /api/files/search
     */
    #[Route('GET', '/search')]
    public function search(Request $request, Response $response): Response
    {
        $clinicId = $this->getClinicId($request);
        $queryParams = $request->getQueryParams();

        $filters = [
            'module' => $queryParams['module'] ?? null,
            'type' => $queryParams['type'] ?? null,
            'file_category' => $queryParams['file_category'] ?? null,
            'patient_id' => isset($queryParams['patient_id']) ? (int) $queryParams['patient_id'] : null,
            'limit' => $queryParams['limit'] ?? 50
        ];

        if (!empty($queryParams['q'])) {
            $patients = $this->patientRepository->search($clinicId, $queryParams['q']);
            if (!empty($patients)) {
                $filters['patient_ids'] = array_column($patients, 'id');
            } else {
                return $this->success($response, []);
            }
        }

        try {
            $files = $this->fileService->searchFiles($clinicId, $filters);
            return $this->success($response, $files);
        } catch (\Exception $e) {
            $this->logger->error("File search error", [
                'error' => $e->getMessage(),
                'clinic_id' => $clinicId
            ]);
            return $this->error($response, 'Dosya arama hatası: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Dosya Listeleme Endpoint'i
     * GET /api/files/list/{module}/{relatedId}
     */
    #[Route('GET', '/list/{module}/{relatedId}')]
    public function list(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $module = $args['module'];
        $relatedId = (int) $args['relatedId'];

        try {
            $files = $this->fileService->listFiles($clinicId, $module, $relatedId);
            return $this->success($response, $files);
        } catch (\Exception $e) {
            return $this->error($response, 'Liste alınamadı: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Dosya Görüntüleme/İndirme Endpoint'i
     * GET /api/files/view/{uuid}
     */
    #[Route('GET', '/view/{uuid}')]
    public function view(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $uuid = $args['uuid'];

        try {
            $fileData = $this->fileService->getFileForView($clinicId, $uuid);

            $path = $fileData['path'];
            $meta = $fileData['meta'];

            if (!file_exists($path)) {
                throw new HttpNotFoundException($request, 'Fiziksel dosya bulunamadı.');
            }

            // Dosya içeriğini stream et
            $stream = new \Slim\Psr7\Stream(fopen($path, 'rb'));
            $fileSize = filesize($path);

            return $response
                ->withHeader('Content-Type', $meta['mime_type'])
                ->withHeader('Content-Disposition', 'inline; filename="' . $meta['original_name'] . '"')
                ->withHeader('Content-Length', (string) $fileSize)
                ->withBody($stream);

        } catch (\RuntimeException $e) {
            return $this->notFoundResponse($response, $e->getMessage());
        } catch (\Exception $e) {
            return $this->error($response, 'Dosya okuma hatası: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Dosya Silme Endpoint'i
     * DELETE /api/files/{uuid}
     */
    #[Route('DELETE', '/{uuid}')]
    public function delete(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $userId = $this->getUserId($request);
        $uuid = $args['uuid'];

        try {
            $success = $this->fileService->delete($clinicId, $uuid, $userId);

            if ($success) {
                $this->logger->info("File deleted", [
                    'clinic_id' => $clinicId,
                    'file_uuid' => $uuid,
                    'user_id' => $userId
                ]);
                return $this->success($response, null, 'Dosya silindi.');
            } else {
                return $this->notFoundResponse($response, 'Dosya bulunamadı veya silinemedi.');
            }
        } catch (\Exception $e) {
            $this->logger->error("File delete error", [
                'error' => $e->getMessage(),
                'clinic_id' => $clinicId,
                'file_uuid' => $uuid
            ]);
            return $this->error($response, 'Silme işleminde hata: ' . $e->getMessage(), 500);
        }
    }
}
