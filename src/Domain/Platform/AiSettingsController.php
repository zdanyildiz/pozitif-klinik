<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\BaseController;
use App\Domain\Ai\AiSettingsRepository;
use App\Middleware\PlatformAdminMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;

/**
 * AiSettingsController - Platform Admin AI Ayarları
 * 
 * Platform yöneticilerinin LLM servislerinin (model adı, API key, prompt)
 * ayarlarını yönetmesini sağlar.
 * 
 * Rotalar:
 * - GET  /platform-admin/settings/ai - AI ayarlarını getir
 * - PUT  /platform-admin/settings/ai - AI ayarlarını güncelle
 */
#[Group('/platform-admin/settings/ai')]
#[Middleware(PlatformAdminMiddleware::class)]
class AiSettingsController extends BaseController
{
    public function __construct(
        ContainerInterface $container,
        private readonly AiSettingsRepository $aiSettingsRepository
    ) {
        parent::__construct($container);
    }

    /**
     * AI ayarlarını getir
     */
    #[Route('GET', '')]
    public function getSettings(Request $request, Response $response): Response
    {
        $settings = $this->aiSettingsRepository->getSettings();

        // Şifrelenmiş api_key'i gizle, frontend'e has_api_key gönder
        if ($settings) {
            $hasKey = !empty($settings['api_key']);
            unset($settings['api_key']);
            unset($settings['api_key_decrypted']);
            $settings['has_api_key'] = $hasKey;
        }

        return $this->success($response, $settings);
    }

    /**
     * AI ayarlarını kaydet/güncelle
     */
    #[Route('PUT', '')]
    public function saveSettings(Request $request, Response $response): Response
    {
        $body = $request->getParsedBody();

        $apiKey = $body['api_key'] ?? null;
        $modelName = $body['model_name'] ?? 'gemini-2.5-flash';
        $systemPrompt = $body['system_prompt'] ?? '';
        $isActive = isset($body['is_active']) ? (bool) $body['is_active'] : true;

        if (empty($modelName) || empty($systemPrompt)) {
            return $this->error($response, "Model Adı ve Sistem Promptu zorunludur.", 400);
        }

        $this->aiSettingsRepository->saveSettings($apiKey, $modelName, $systemPrompt, $isActive);

        $this->getLogger()->info('AI settings updated by platform admin', [
            'model_name' => $modelName,
            'is_active' => $isActive
        ]);

        return $this->success($response, null, 'AI ayarları başarıyla kaydedildi.');
    }
}
