<?php

declare(strict_types=1);

namespace App\Domain\File;

use App\Core\BaseController;
use Psr\Container\ContainerInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Exception\HttpNotFoundException;

/**
 * FileController
 * 
 * Dosya yükleme ve erişim işlemleri için API uçları.
 */
class FileController extends BaseController
{
    private FileService $fileService;

    public function __construct(ContainerInterface $container)
    {
        parent::__construct($container);
        $this->fileService = $container->get(FileService::class);
    }

    /**
     * Dosya Yükleme Endpoint'i
     * POST /api/files/upload
     * 
     * Body Params:
     * - module: string (patient, lab, vb.)
     * - related_id: int
     * - file: Binary file content
     */
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
                $userId
            );

            return $this->createdResponse($response, $result, 'Dosya başarıyla yüklendi.');
        } catch (\Exception $e) {
            // Loglama yapılması iyi olur
            // $this->logger->error(...)
            return $this->error($response, 'Dosya yüklenirken hata oluştu: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Dosya Listeleme Endpoint'i
     * GET /api/files/list/{module}/{relatedId}
     */
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
     * 
     * Dosyayı direkt stream eder.
     */
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

            return $response
                ->withHeader('Content-Type', $meta['mime_type'])
                ->withHeader('Content-Disposition', 'inline; filename="' . $meta['original_name'] . '"')
                ->withHeader('Content-Length', (string) ($meta['size_kb'] * 1024)) // size_kb yaklaşık değer olabilir
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
    public function delete(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $userId = $this->getUserId($request);
        $uuid = $args['uuid'];

        try {
            $success = $this->fileService->delete($clinicId, $uuid, $userId);

            if ($success) {
                return $this->success($response, null, 'Dosya silindi.');
            } else {
                return $this->notFoundResponse($response, 'Dosya bulunamadı veya silinemedi.');
            }
        } catch (\Exception $e) {
            return $this->error($response, 'Silme işleminde hata: ' . $e->getMessage(), 500);
        }
    }
}
