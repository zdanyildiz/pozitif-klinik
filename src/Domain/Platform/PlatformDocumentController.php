<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Core\Attributes\Route;
use App\Core\Attributes\Middleware;
use App\Core\Attributes\Group;
use App\Core\BaseController;
use App\Middleware\PlatformAdminMiddleware;
use App\Domain\Document\DocumentRepository;
use Psr\Container\ContainerInterface;

/**
 * PlatformDocumentController - Sistem Genelindeki Doküman Şablonlarının Yönetimi (Süper Admin)
 */
#[Group('/platform-admin/documents')]
#[Middleware(PlatformAdminMiddleware::class)]
class PlatformDocumentController extends BaseController
{
    private DocumentRepository $repository;

    public function __construct(ContainerInterface $container, DocumentRepository $repository)
    {
        parent::__construct($container);
        $this->repository = $repository;
    }

    /**
     * Tüm sistem şablonlarını listele (clinic_id IS NULL)
     */
    #[Route('GET', '/templates')]
    public function listTemplates(Request $request, Response $response): Response
    {
        $type = $request->getQueryParams()['type'] ?? null;

        // Bu metod clinicId 0/null gönderildiğinde sistem şablonlarını getirmeli
        // DocumentRepository::getTemplatesForClinic metodunu NULL desteği için zaten hazırlamıştık
        $templates = $this->repository->getTemplatesForClinic(0, $type);

        // Sadece sistem şablonlarını filtrele (clinic_id NULL olanlar)
        $systemTemplates = array_values(array_filter($templates, function ($t) {
            return $t['clinic_id'] === null;
        }));

        return $this->success($response, $systemTemplates);
    }

    /**
     * Sistem şablonu getir
     */
    #[Route('GET', '/templates/{id:[0-9]+}')]
    public function getTemplate(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];
        $template = $this->repository->getTemplateById($id);

        if (!$template || $template['clinic_id'] !== null) {
            return $this->notFoundResponse($response, 'Sistem şablonu bulunamadı.');
        }

        return $this->success($response, $template);
    }

    /**
     * Yeni sistem şablonu oluştur
     */
    #[Route('POST', '/templates')]
    public function createTemplate(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();

        if (empty($data['name']) || empty($data['content_html'])) {
            return $this->error($response, 'Şablon adı ve içerik zorunludur.', 400);
        }

        // clinic_id NULL olarak kaydedilmeli (0 ya da null repo'ya gönderilebilir)
        $id = $this->repository->createTemplate(0, $data);

        // Repo içinde 0 gönderilirse veritabanına NULL olarak insert edildiğinden emin olmalıyız
        // DocumentRepository::createTemplate metodu clinic_id 0 ise null yapacak şekilde güncellenebilir

        return $this->createdResponse($response, ['id' => $id], 'Sistem şablonu oluşturuldu.');
    }

    /**
     * Sistem şablonu güncelle
     */
    #[Route('PUT', '/templates/{id:[0-9]+}')]
    public function updateTemplate(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];
        $data = $request->getParsedBody();

        // Önce şablonun sisteme ait olduğundan emin ol
        $template = $this->repository->getTemplateById($id);
        if (!$template || $template['clinic_id'] !== null) {
            return $this->error($response, 'Sistem şablonu bulunamadı.', 404);
        }

        $this->repository->updateTemplate($id, $data);

        return $this->success($response, null, 'Şablon başarıyla güncellendi.');
    }

    /**
     * Sistem şablonu sil
     */
    #[Route('DELETE', '/templates/{id:[0-9]+}')]
    public function deleteTemplate(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        // Sadece sistem şablonlarını silmeye izin ver (clinic_id NULL (0))
        $deleted = $this->repository->deleteTemplate(0, $id);

        if (!$deleted) {
            return $this->error($response, 'Şablon bulunamadı veya silinemedi.', 404);
        }

        return $this->success($response, null, 'Sistem şablonu silindi.');
    }
}
