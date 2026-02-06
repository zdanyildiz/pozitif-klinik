<?php

declare(strict_types=1);

namespace App\Domain\Document;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Core\Attributes\Route;
use App\Core\Attributes\Middleware;
use App\Core\Attributes\Group;
use App\Core\BaseController;
use App\Middleware\TenantMiddleware;
use Psr\Container\ContainerInterface;

/**
 * DocumentController - Epikriz ve Doküman API Endpoint'leri
 * 
 * PDF oluşturma, şablon yönetimi ve doküman listeleme işlemleri.
 */
#[Group('/api/documents')]
#[Middleware(TenantMiddleware::class)]
class DocumentController extends BaseController
{
    private DocumentService $service;
    private DocumentRepository $repository;

    public function __construct(
        ContainerInterface $container,
        DocumentService $service,
        DocumentRepository $repository
    ) {
        parent::__construct($container);
        $this->service = $service;
        $this->repository = $repository;
    }

    /**
     * Epikriz şablonlarını listeler
     * GET /api/documents/templates
     */
    #[Route('GET', '/templates')]
    public function getTemplates(Request $request, Response $response): Response
    {
        $clinicId = $this->getClinicId($request);
        $type = $request->getQueryParams()['type'] ?? null;

        $templates = $this->service->getTemplates($clinicId, $type);

        return $this->success($response, $templates);
    }

    /**
     * Epikriz PDF oluşturur ve stream eder
     * GET /api/documents/epicrisis/{examinationId}
     */
    #[Route('GET', '/epicrisis/{examinationId:[0-9]+}')]
    public function generateEpicrisis(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $examinationId = (int) $args['examinationId'];
        $templateId = isset($request->getQueryParams()['template_id'])
            ? (int) $request->getQueryParams()['template_id']
            : null;

        try {
            $pdfContent = $this->service->generateEpicrisisPdf($clinicId, $examinationId, $templateId);

            $response->getBody()->write($pdfContent);

            return $response
                ->withHeader('Content-Type', 'application/pdf')
                ->withHeader('Content-Disposition', 'inline; filename="epikriz_' . $examinationId . '.pdf"')
                ->withHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 404);
        } catch (\Exception $e) {
            $this->getLogger($clinicId)->error("Epikriz PDF oluşturma hatası", [
                'examination_id' => $examinationId,
                'error' => $e->getMessage()
            ]);
            return $this->error($response, 'PDF oluşturulurken bir hata oluştu: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Epikriz HTML önizleme
     * GET /api/documents/epicrisis/{examinationId}/preview
     */
    #[Route('GET', '/epicrisis/{examinationId:[0-9]+}/preview')]
    public function previewEpicrisis(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $examinationId = (int) $args['examinationId'];
        $templateId = isset($request->getQueryParams()['template_id'])
            ? (int) $request->getQueryParams()['template_id']
            : null;

        try {
            $html = $this->service->generateEpicrisisPreview($clinicId, $examinationId, $templateId);

            // Tam HTML sayfası olarak döndür
            $fullHtml = '<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Epikriz Önizleme</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background: #f5f5f5;
        }
        .preview-container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="preview-container">
        ' . $html . '
    </div>
</body>
</html>';

            $response->getBody()->write($fullHtml);

            return $response
                ->withHeader('Content-Type', 'text/html; charset=utf-8');

        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * Epikriz oluşturur ve kaydeder
     * POST /api/documents/epicrisis
     */
    #[Route('POST', '/epicrisis')]
    public function createEpicrisis(Request $request, Response $response): Response
    {
        $clinicId = $this->getClinicId($request);
        $userId = $this->getUserId($request);
        $data = $request->getParsedBody();

        if (empty($data['examination_id'])) {
            return $this->error($response, 'Muayene ID gereklidir', 400);
        }

        try {
            $result = $this->service->createAndSaveEpicrisis(
                $clinicId,
                (int) $data['examination_id'],
                $userId,
                isset($data['template_id']) ? (int) $data['template_id'] : null
            );

            return $this->createdResponse($response, [
                'id' => $result['id'],
                'message' => 'Epikriz başarıyla oluşturuldu'
            ]);

        } catch (\Exception $e) {
            $this->getLogger($clinicId)->error("Epikriz kaydetme hatası", [
                'examination_id' => $data['examination_id'] ?? null,
                'error' => $e->getMessage()
            ]);
            return $this->error($response, 'Epikriz kaydedilemedi: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Hastanın dokümanlarını listeler
     * GET /api/documents/patient/{patientId}
     */
    #[Route('GET', '/patient/{patientId:[0-9]+}')]
    public function getPatientDocuments(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $patientId = (int) $args['patientId'];
        $type = $request->getQueryParams()['type'] ?? null;

        $documents = $this->service->getPatientDocuments($clinicId, $patientId, $type);

        return $this->success($response, $documents);
    }

    /**
     * Muayeneye ait dokümanları listeler
     * GET /api/documents/examination/{examinationId}
     */
    #[Route('GET', '/examination/{examinationId:[0-9]+}')]
    public function getExaminationDocuments(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $examinationId = (int) $args['examinationId'];

        $documents = $this->repository->getDocumentsByExamination($clinicId, $examinationId);

        return $this->success($response, $documents);
    }

    /**
     * Tekil doküman getirir
     * GET /api/documents/{id}
     */
    #[Route('GET', '/{id:[0-9]+}')]
    public function getDocument(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $id = (int) $args['id'];

        $document = $this->repository->getDocumentById($clinicId, $id);

        if (!$document) {
            return $this->notFoundResponse($response, 'Doküman bulunamadı');
        }

        return $this->success($response, $document);
    }

    /**
     * Doküman siler
     * DELETE /api/documents/{id}
     */
    #[Route('DELETE', '/{id:[0-9]+}')]
    public function deleteDocument(Request $request, Response $response, array $args): Response
    {
        $clinicId = $this->getClinicId($request);
        $id = (int) $args['id'];

        $deleted = $this->repository->deleteDocument($clinicId, $id);

        if (!$deleted) {
            return $this->notFoundResponse($response, 'Doküman bulunamadı veya silinemedi');
        }

        return $this->success($response, null, 'Doküman başarıyla silindi');
    }
}
