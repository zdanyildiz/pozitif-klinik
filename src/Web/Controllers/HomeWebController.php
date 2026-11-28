<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Core\Attributes\Route;
use Slim\Views\Twig;
use App\Domain\Email\EmailService;
use App\Core\Service\SeoUrlResolver;

class HomeWebController
{
    private Twig $view;
    private EmailService $emailService;
    private SeoUrlResolver $urlResolver;

    public function __construct(Twig $view, EmailService $emailService, SeoUrlResolver $urlResolver)
    {
        $this->view = $view;
        $this->emailService = $emailService;
        $this->urlResolver = $urlResolver;
    }

    /**
     * Ana Sayfa Yönlendirmesi ve Tanıtım Sayfası
     * 
     * Kullanıcılar domain adresine (örn: pozitifklinik.com) prefix olmadan girdiklerinde
     * programın tanıtım sayfasını görürler. Eğer subdomain (prefix) ile gelirlerse
     * doğrudan login paneline yönlendirilirler.
     */
    #[Route('GET', '/')]
    public function index(Request $request, Response $response): Response
    {
        // DomainTenantMiddleware'den gelen tenant bilgisi var mı kontrol et
        $tenant = $request->getAttribute('identified_tenant');

        if ($tenant) {
            // Prefix tanımlıysa doğrudan giriş ekranına yönlendir
            return $response
                ->withHeader('Location', '/admin/login')
                ->withStatus(302);
        }

        // Prefix yoksa tanıtım sayfasını göster
        return $this->view->render($response, 'index.twig');
    }

    /**
     * Hakkımızda Sayfası
     */
    #[Route('GET', '/hakkimizda')]
    public function about(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'frontend/about.twig');
    }

    /**
     * İletişim Sayfası
     */
    #[Route('GET', '/iletisim')]
    public function contact(Request $request, Response $response): Response
    {
        $siteKey = $_ENV['TURNSTILE_SITE_KEY'] ?? $_SERVER['TURNSTILE_SITE_KEY'] ?? getenv('TURNSTILE_SITE_KEY');

        return $this->view->render($response, 'frontend/contact.twig', [
            'turnstile_site_key' => $siteKey ?: ''
        ]);
    }

    /**
     * İletişim Formu Gönderimi (POST)
     */
    #[Route('POST', '/iletisim')]
    public function contactSubmit(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();
        $name = trim($data['name'] ?? '');
        $email = trim($data['email'] ?? '');
        $subject = trim($data['subject'] ?? '');
        $message = trim($data['message'] ?? '');
        $turnstileResponse = $data['cf-turnstile-response'] ?? '';

        $error = null;
        $success = null;

        if (empty($name) || empty($email) || empty($subject) || empty($message)) {
            $error = 'Lütfen tüm alanları doldurun.';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $error = 'Geçerli bir e-posta adresi girin.';
        } elseif (empty($turnstileResponse)) {
            $error = 'Lütfen güvenlik doğrulamasını (Turnstile) tamamlayın.';
        } else {
            // Turnstile Doğrulaması
            $secretKey = $_ENV['TURNSTILE_SECRET_KEY'] ?? $_SERVER['TURNSTILE_SECRET_KEY'] ?? getenv('TURNSTILE_SECRET_KEY') ?: '';
            $verifyResponse = @file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, stream_context_create([
                'http' => [
                    'header' => "Content-type: application/x-www-form-urlencoded\r\n",
                    'method' => 'POST',
                    'content' => http_build_query([
                        'secret' => $secretKey,
                        'response' => $turnstileResponse,
                        'remoteip' => $_SERVER['REMOTE_ADDR'] ?? ''
                    ])
                ]
            ]));

            $responseData = json_decode((string) $verifyResponse, true);

            if (empty($responseData['success'])) {
                $error = 'Güvenlik doğrulaması başarısız oldu. Lütfen sayfayı yenileyip tekrar deneyin.';
            } else {
                // E-posta gönderimi (0 id ile fallback .env ayarlarına düşer)
                $body = "<h2>Yeni İletişim Formu Mesajı</h2>";
                $body .= "<p><strong>Ad Soyad:</strong> " . htmlspecialchars($name) . "</p>";
                $body .= "<p><strong>E-Posta:</strong> " . htmlspecialchars($email) . "</p>";
                $body .= "<p><strong>Konu:</strong> " . htmlspecialchars($subject) . "</p>";
                $body .= "<p><strong>Mesaj:</strong><br>" . nl2br(htmlspecialchars($message)) . "</p>";

                // Bütün iletişim formu taleplerinin doğrudan bu adrese gitmesi istendi
                $toEmail = 'info@globalpozitif.com.tr';
                $emailSubject = 'İletişim Formu: ' . $subject;

                $result = $this->emailService->send(0, $toEmail, $emailSubject, $body);

                if ($result->success) {
                    $success = 'Mesajınız başarıyla gönderildi. En kısa sürede sizinle iletişime geçeceğiz.';
                    $name = $email = $subject = $message = ''; // Formu temizle
                } else {
                    $error = 'Mesajınız gönderilirken teknik bir hata oluştu. Daha sonra tekrar deneyin.';
                }
            }
        }

        $siteKey = $_ENV['TURNSTILE_SITE_KEY'] ?? $_SERVER['TURNSTILE_SITE_KEY'] ?? getenv('TURNSTILE_SITE_KEY');

        return $this->view->render($response, 'frontend/contact.twig', [
            'turnstile_site_key' => $siteKey ?: '',
            'error' => $error,
            'success' => $success,
            'form' => compact('name', 'email', 'subject', 'message')
        ]);
    }

    /**
     * KVKK Sayfası
     */
    #[Route('GET', '/kvkk')]
    public function kvkk(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'frontend/kvkk.twig');
    }

    /**
     * Açık Rıza Metni Sayfası
     */
    #[Route('GET', '/acik-riza-metni')]
    public function explicitConsent(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'frontend/explicit_consent.twig');
    }

    /**
     * Aydınlatma Metni Sayfası
     */
    #[Route('GET', '/aydinlatma-metni')]
    public function illumination(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'frontend/illumination.twig');
    }

    /**
     * Dinamik XML Sitemap
     */
    #[Route('GET', '/sitemap.xml')]
    public function sitemap(Request $request, Response $response): Response
    {
        $baseUrl = rtrim($this->urlResolver->resolveBaseUrl($request), '/');
        $publicRoutes = [
            ['path' => '/', 'changefreq' => 'weekly', 'priority' => '1.0'],
            ['path' => '/hakkimizda', 'changefreq' => 'monthly', 'priority' => '0.8'],
            ['path' => '/iletisim', 'changefreq' => 'monthly', 'priority' => '0.8'],
            ['path' => '/kvkk', 'changefreq' => 'yearly', 'priority' => '0.5'],
            ['path' => '/acik-riza-metni', 'changefreq' => 'yearly', 'priority' => '0.5'],
            ['path' => '/aydinlatma-metni', 'changefreq' => 'yearly', 'priority' => '0.5'],
        ];

        $xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
        $xml .= "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";

        foreach ($publicRoutes as $route) {
            $loc = htmlspecialchars($baseUrl . $route['path'], ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$loc}</loc>\n";
            $xml .= "    <changefreq>{$route['changefreq']}</changefreq>\n";
            $xml .= "    <priority>{$route['priority']}</priority>\n";
            $xml .= "  </url>\n";
        }

        $xml .= "</urlset>\n";

        $response->getBody()->write($xml);
        return $response
            ->withHeader('Content-Type', 'application/xml; charset=utf-8')
            ->withStatus(200);
    }
}
