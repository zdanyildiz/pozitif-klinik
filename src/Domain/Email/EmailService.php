<?php

declare(strict_types=1);

namespace App\Domain\Email;

use App\Core\Database;
use App\Core\Security\CryptoService;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception as PHPMailerException;
use Psr\Log\LoggerInterface;

/**
 * Multi-tenant E-Posta Gönderim Servisi
 * 
 * Her klinik için özel veya fallback SMTP ayarlarını kullanarak
 * e-posta gönderimi sağlar. SMTP parolaları AES-256-GCM ile şifrelenir.
 */
class EmailService
{
    public function __construct(
        private readonly Database $db,
        private readonly CryptoService $crypto,
        private readonly ?LoggerInterface $logger = null
    ) {
    }

    /**
     * E-posta gönderir
     * 
     * Önce klinik-spesifik SMTP ayarlarını kontrol eder,
     * bulunamazsa .env fallback ayarlarını kullanır.
     *
     * @param int         $clinicId    Klinik ID
     * @param string      $toEmail     Alıcı e-posta adresi
     * @param string      $subject     E-posta konusu
     * @param string      $body        E-posta içeriği (HTML destekler)
     * @param string|null $altBody     Düz metin alternatifi (opsiyonel)
     * @param array       $attachments Ek dosyalar [['path' => '/path/to/file', 'name' => 'filename']]
     * 
     * @return EmailResult Gönderim sonucu
     */
    public function send(
        int $clinicId,
        string $toEmail,
        string $subject,
        string $body,
        ?string $altBody = null,
        array $attachments = []
    ): EmailResult {
        $configSource = 'fallback';

        try {
            // 1. Klinik-spesifik SMTP ayarlarını kontrol et
            $config = $this->getTenantConfig($clinicId);

            if ($config !== null) {
                $configSource = 'tenant';
                $this->logger?->info("Using tenant SMTP config for clinic: {$clinicId}");
            } else {
                // 2. Fallback: .env ayarlarını kullan
                $config = $this->getFallbackConfig();
                $this->logger?->info("Using fallback SMTP config for clinic: {$clinicId}");
            }

            // 3. PHPMailer ile gönder
            $mail = $this->createMailer($config);

            // Alıcı
            $mail->addAddress($toEmail);

            // Konu ve içerik
            $mail->Subject = $subject;
            $mail->Body = $body;
            $mail->isHTML(true);

            if ($altBody !== null) {
                $mail->AltBody = $altBody;
            } else {
                // HTML'den düz metin oluştur
                $mail->AltBody = strip_tags($body);
            }

            // Ek dosyalar
            foreach ($attachments as $attachment) {
                if (isset($attachment['path']) && file_exists($attachment['path'])) {
                    $mail->addAttachment(
                        $attachment['path'],
                        $attachment['name'] ?? basename($attachment['path'])
                    );
                }
            }

            // Gönder
            $mail->send();

            // Başarılı log kaydı
            $this->logEmail($clinicId, $toEmail, $subject, $body, 'sent', null, $configSource);

            $this->logger?->info("Email sent successfully", [
                'clinic_id' => $clinicId,
                'to' => $toEmail,
                'subject' => $subject,
                'via' => $configSource
            ]);

            return new EmailResult(
                success: true,
                message: 'E-posta başarıyla gönderildi',
                configSource: $configSource
            );

        } catch (PHPMailerException $e) {
            $errorMessage = $e->getMessage();

            // Hata logu
            $this->logEmail($clinicId, $toEmail, $subject, $body, 'failed', $errorMessage, $configSource);

            $this->logger?->error("Email sending failed", [
                'clinic_id' => $clinicId,
                'to' => $toEmail,
                'error' => $errorMessage
            ]);

            return new EmailResult(
                success: false,
                message: 'E-posta gönderilemedi: ' . $errorMessage,
                configSource: $configSource,
                errorCode: $e->getCode()
            );

        } catch (\Throwable $e) {
            $errorMessage = $e->getMessage();

            $this->logger?->error("Unexpected error during email sending", [
                'clinic_id' => $clinicId,
                'error' => $errorMessage
            ]);

            return new EmailResult(
                success: false,
                message: 'Beklenmeyen hata: ' . $errorMessage,
                configSource: $configSource,
                errorCode: (int) $e->getCode()
            );
        }
    }

    /**
     * Veritabanından klinik SMTP ayarlarını getirir
     */
    private function getTenantConfig(int $clinicId): ?array
    {
        $sql = "SELECT 
                    smtp_host,
                    smtp_port,
                    smtp_username,
                    smtp_password_encrypted,
                    smtp_encryption,
                    from_email,
                    from_name
                FROM sys_tenant_email_configs 
                WHERE clinic_id = ? AND is_active = 1
                LIMIT 1";

        $result = $this->db->fetch($sql, [$clinicId]);

        if ($result === false) {
            return null;
        }

        // Şifeli parolayı çöz
        $decryptedPassword = $this->crypto->decrypt($result['smtp_password_encrypted']);

        if ($decryptedPassword === null) {
            $this->logger?->warning("Failed to decrypt SMTP password for clinic: {$clinicId}");
            return null;
        }

        return [
            'host' => $result['smtp_host'],
            'port' => (int) $result['smtp_port'],
            'username' => $result['smtp_username'],
            'password' => $decryptedPassword,
            'encryption' => $result['smtp_encryption'],
            'from_email' => $result['from_email'],
            'from_name' => $result['from_name'],
        ];
    }

    /**
     * .env dosyasından fallback SMTP ayarlarını getirir
     */
    private function getFallbackConfig(): array
    {
        return [
            'host' => $_ENV['MAIL_SMTP_HOST'] ?? 'localhost',
            'port' => (int) ($_ENV['MAIL_SMTP_PORT'] ?? 587),
            'username' => $_ENV['MAIL_SMTP_USER'] ?? '',
            'password' => $_ENV['MAIL_SMTP_PASS'] ?? '',
            'encryption' => $_ENV['MAIL_SMTP_ENCRYPTION'] ?? 'tls',
            'from_email' => $_ENV['MAIL_FROM_EMAIL'] ?? 'noreply@localhost',
            'from_name' => $_ENV['MAIL_FROM_NAME'] ?? 'System',
        ];
    }

    /**
     * PHPMailer instance'ı oluşturur ve yapılandırır
     */
    private function createMailer(array $config): PHPMailer
    {
        $mail = new PHPMailer(true); // Exceptions enabled

        // SMTP ayarları
        $mail->isSMTP();
        $mail->Host = $config['host'];
        $mail->Port = $config['port'];
        $mail->CharSet = PHPMailer::CHARSET_UTF8;

        // Auth ayarları
        if (!empty($config['username'])) {
            $mail->SMTPAuth = true;
            $mail->Username = $config['username'];
            $mail->Password = $config['password'];
        }

        // Şifreleme
        $mail->SMTPSecure = match ($config['encryption']) {
            'ssl' => PHPMailer::ENCRYPTION_SMTPS,
            'tls' => PHPMailer::ENCRYPTION_STARTTLS,
            default => '',
        };

        // Gönderen
        $mail->setFrom($config['from_email'], $config['from_name']);

        // Debug modu (sadece geliştirme ortamında)
        if (($_ENV['APP_DEBUG'] ?? 'false') === 'true') {
            $mail->SMTPDebug = SMTP::DEBUG_OFF; // Production'da kapalı
        }

        return $mail;
    }

    /**
     * E-posta gönderim logu kaydeder
     */
    private function logEmail(
        int $clinicId,
        string $toEmail,
        string $subject,
        string $body,
        string $status,
        ?string $errorMessage,
        string $sentVia
    ): void {
        try {
            $sql = "INSERT INTO sys_email_logs 
                    (clinic_id, to_email, subject, body_preview, status, error_message, sent_via, sent_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

            $this->db->query($sql, [
                $clinicId,
                $toEmail,
                $subject,
                mb_substr(strip_tags($body), 0, 500), // İlk 500 karakter
                $status,
                $errorMessage,
                $sentVia,
                $status === 'sent' ? date('Y-m-d H:i:s') : null
            ]);
        } catch (\Throwable $e) {
            // Log kaydı başarısız olsa bile mail gönderimini etkilemesin
            $this->logger?->warning("Failed to log email", ['error' => $e->getMessage()]);
        }
    }

    /**
     * Klinik için SMTP yapılandırmasını kaydeder/günceller
     */
    public function saveTenantConfig(
        int $clinicId,
        string $smtpHost,
        int $smtpPort,
        string $smtpUsername,
        string $smtpPassword,
        string $smtpEncryption,
        string $fromEmail,
        string $fromName,
        bool $isActive = true
    ): bool {
        try {
            // Parolayı şifrele
            $encryptedPassword = $this->crypto->encrypt($smtpPassword);

            if ($encryptedPassword === null) {
                throw new \RuntimeException('SMTP parolası şifrelenemedi');
            }

            // Upsert (INSERT ... ON DUPLICATE KEY UPDATE)
            $sql = "INSERT INTO sys_tenant_email_configs 
                    (clinic_id, smtp_host, smtp_port, smtp_username, smtp_password_encrypted, 
                     smtp_encryption, from_email, from_name, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        smtp_host = VALUES(smtp_host),
                        smtp_port = VALUES(smtp_port),
                        smtp_username = VALUES(smtp_username),
                        smtp_password_encrypted = VALUES(smtp_password_encrypted),
                        smtp_encryption = VALUES(smtp_encryption),
                        from_email = VALUES(from_email),
                        from_name = VALUES(from_name),
                        is_active = VALUES(is_active)";

            $this->db->query($sql, [
                $clinicId,
                $smtpHost,
                $smtpPort,
                $smtpUsername,
                $encryptedPassword,
                $smtpEncryption,
                $fromEmail,
                $fromName,
                $isActive ? 1 : 0
            ]);

            $this->logger?->info("SMTP config saved for clinic: {$clinicId}");

            return true;

        } catch (\Throwable $e) {
            $this->logger?->error("Failed to save SMTP config", [
                'clinic_id' => $clinicId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * SMTP bağlantısını test eder
     */
    public function testConnection(int $clinicId): EmailResult
    {
        try {
            $config = $this->getTenantConfig($clinicId) ?? $this->getFallbackConfig();
            $configSource = $this->getTenantConfig($clinicId) !== null ? 'tenant' : 'fallback';

            $mail = $this->createMailer($config);

            // Debug çıktısını tamamen kapat (JSON yanıtı bozmaması için kritik)
            $mail->SMTPDebug = SMTP::DEBUG_OFF;

            // Bağlantı denemesi
            if ($mail->smtpConnect()) {
                $mail->smtpClose();

                return new EmailResult(
                    success: true,
                    message: 'SMTP bağlantısı başarılı',
                    configSource: $configSource
                );
            }

            // Bağlantı başarısız - PHPMailer hata mesajını al
            $errorInfo = $mail->ErrorInfo ?: 'Bağlantı kurulamadı';

            return new EmailResult(
                success: false,
                message: "SMTP bağlantı hatası: {$errorInfo}",
                configSource: $configSource
            );

        } catch (\Throwable $e) {
            return new EmailResult(
                success: false,
                message: 'Bağlantı testi başarısız: ' . $e->getMessage(),
                configSource: 'unknown',
                errorCode: (int) $e->getCode()
            );
        }
    }
}
