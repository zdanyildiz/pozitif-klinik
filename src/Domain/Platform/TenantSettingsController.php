<?php

declare(strict_types=1);

namespace App\Domain\Platform;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\BaseController;
use App\Core\Security\CryptoService;
use App\Domain\Email\EmailService;
use App\Middleware\PlatformAdminMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;

/**
 * TenantSettingsController - Klinik Ayarları Yönetimi
 * 
 * Platform yöneticilerinin klinik bazlı ayarları (E-posta, SMS vb.)
 * yönetmesini sağlar.
 * 
 * Rotalar:
 * - GET  /admin/tenants/{id}/settings - Tüm ayarları getir
 * - GET  /admin/tenants/{id}/settings/email - E-posta ayarlarını getir
 * - POST /admin/tenants/{id}/settings/email - E-posta ayarlarını kaydet
 * - POST /admin/tenants/{id}/settings/email/test - E-posta bağlantı testi
 */
#[Group('/admin/tenants')]
#[Middleware(PlatformAdminMiddleware::class)]
class TenantSettingsController extends BaseController
{
    public function __construct(
        ContainerInterface $container,
        private readonly TenantRepository $tenantRepository,
        private readonly TenantEmailConfigRepository $emailConfigRepository,
        private readonly CryptoService $crypto,
        private readonly EmailService $emailService
    ) {
        parent::__construct($container);
    }

    /**
     * Klinik Detay Bilgilerini Getir
     */
    #[Route('GET', '/{id:[0-9]+}')]
    public function getClinicDetails(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['id'];

        $clinic = $this->tenantRepository->findByIdWithAdmin($clinicId);

        if (!$clinic) {
            return $this->error($response, 'Klinik bulunamadı', 404);
        }

        return $this->success($response, $clinic);
    }

    /**
     * Tüm Klinik Ayarlarını Getir
     */
    #[Route('GET', '/{id:[0-9]+}/settings')]
    public function getAllSettings(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['id'];

        // Klinik var mı?
        $clinic = $this->tenantRepository->findById($clinicId);
        if (!$clinic) {
            return $this->error($response, 'Klinik bulunamadı', 404);
        }

        $settings = [
            'clinic' => $clinic,
            'email' => $this->getEmailConfigForDisplay($clinicId),
        ];

        return $this->success($response, $settings);
    }

    /**
     * E-posta Ayarlarını Getir
     */
    #[Route('GET', '/{id:[0-9]+}/settings/email')]
    public function getEmailSettings(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['id'];

        $config = $this->getEmailConfigForDisplay($clinicId);

        return $this->success($response, $config);
    }

    /**
     * E-posta Ayarlarını Kaydet
     */
    #[Route('POST', '/{id:[0-9]+}/settings/email')]
    public function saveEmailSettings(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['id'];
        $body = $request->getParsedBody();

        // Klinik var mı?
        $clinic = $this->tenantRepository->findById($clinicId);
        if (!$clinic) {
            return $this->error($response, 'Klinik bulunamadı', 404);
        }

        // Validasyon
        $required = ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'from_email', 'from_name'];
        foreach ($required as $field) {
            // smtp_password mevcut kayıtta boş olabilir (güncelleme durumu)
            if ($field === 'smtp_password' && empty($body[$field])) {
                continue;
            }
            if (empty($body[$field])) {
                return $this->error($response, "'{$field}' alanı zorunludur", 400);
            }
        }

        // Şifre yönetimi
        $password = $body['smtp_password'] ?? '';

        // Eğer şifre boş ve mevcut config varsa, mevcut şifreyi kullan
        if (empty($password) && $this->emailConfigRepository->exists($clinicId)) {
            $encryptedPassword = $this->emailConfigRepository->getEncryptedPassword($clinicId);
            if ($encryptedPassword) {
                $password = $this->crypto->decrypt($encryptedPassword);
            }
        }

        if (empty($password)) {
            return $this->error($response, 'SMTP şifresi zorunludur', 400);
        }

        $saved = $this->emailService->saveTenantConfig(
            clinicId: $clinicId,
            smtpHost: trim($body['smtp_host']),
            smtpPort: (int) $body['smtp_port'],
            smtpUsername: trim($body['smtp_username']),
            smtpPassword: $password,
            smtpEncryption: $body['smtp_encryption'] ?? 'tls',
            fromEmail: trim($body['from_email']),
            fromName: trim($body['from_name']),
            isActive: isset($body['is_active']) ? (bool) $body['is_active'] : true
        );

        if (!$saved) {
            return $this->error($response, 'E-posta ayarları kaydedilemedi', 500);
        }

        return $this->success($response, null, 'E-posta ayarları başarıyla kaydedildi');
    }

    /**
     * E-posta Bağlantı Testi
     */
    #[Route('POST', '/{id:[0-9]+}/settings/email/test')]
    public function testEmailConnection(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['id'];

        $result = $this->emailService->testConnection($clinicId);

        if ($result->success) {
            return $this->success($response, $result->toArray(), $result->message);
        }

        return $this->error($response, $result->message, 400);
    }

    /**
     * Test E-postası Gönder
     */
    #[Route('POST', '/{id:[0-9]+}/settings/email/send-test')]
    public function sendTestEmail(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['id'];
        $body = $request->getParsedBody();

        $toEmail = $body['to_email'] ?? '';

        if (empty($toEmail) || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
            return $this->error($response, 'Geçerli bir e-posta adresi giriniz', 400);
        }

        $result = $this->emailService->send(
            clinicId: $clinicId,
            toEmail: $toEmail,
            subject: 'Pozitif Klinik - E-posta Test',
            body: $this->getTestEmailTemplate()
        );

        if ($result->success) {
            return $this->success($response, $result->toArray(), 'Test e-postası başarıyla gönderildi');
        }

        return $this->error($response, $result->message, 400);
    }

    /**
     * E-posta Ayarlarını Sil (Fallback'e Dön)
     */
    #[Route('DELETE', '/{id:[0-9]+}/settings/email')]
    public function deleteEmailSettings(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $args['id'];

        $this->emailConfigRepository->deleteByClinicId($clinicId);

        return $this->success($response, null, 'E-posta ayarları silindi. Sistem varsayılan ayarları kullanılacak.');
    }

    /**
     * Görüntüleme için e-posta config'ini hazırlar (şifresiz)
     */
    private function getEmailConfigForDisplay(int $clinicId): array
    {
        $config = $this->emailConfigRepository->findByClinicIdWithoutPassword($clinicId);

        if ($config) {
            $config['is_fallback'] = false;
            $config['has_password'] = true;
            return $config;
        }

        // Fallback config
        return [
            'smtp_host' => $_ENV['MAIL_SMTP_HOST'] ?? '',
            'smtp_port' => $_ENV['MAIL_SMTP_PORT'] ?? 587,
            'smtp_username' => $_ENV['MAIL_SMTP_USER'] ?? '',
            'smtp_encryption' => $_ENV['MAIL_SMTP_ENCRYPTION'] ?? 'tls',
            'from_email' => $_ENV['MAIL_FROM_EMAIL'] ?? '',
            'from_name' => $_ENV['MAIL_FROM_NAME'] ?? '',
            'is_active' => true,
            'is_fallback' => true,
            'has_password' => !empty($_ENV['MAIL_SMTP_PASS'] ?? ''),
        ];
    }

    /**
     * Test e-postası için HTML template
     */
    private function getTestEmailTemplate(): string
    {
        $date = date('d.m.Y H:i:s');

        return <<<HTML
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; }
                .header h1 { margin: 0; font-size: 24px; }
                .content { padding: 30px; }
                .success-icon { font-size: 48px; text-align: center; margin-bottom: 20px; }
                .info { background: #f0f9ff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
                .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✉️ E-posta Testi Başarılı</h1>
                </div>
                <div class="content">
                    <div class="success-icon">✅</div>
                    <p>Tebrikler! SMTP yapılandırmanız doğru çalışıyor.</p>
                    <div class="info">
                        <strong>Test Zamanı:</strong> {$date}
                    </div>
                    <p>Bu e-posta, Pozitif Klinik platform yönetim panelinden gönderilmiştir.</p>
                </div>
                <div class="footer">
                    © Pozitif Klinik - Platform Yönetimi
                </div>
            </div>
        </body>
        </html>
        HTML;
    }
}
