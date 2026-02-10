<?php

declare(strict_types=1);

namespace App\Core\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use Slim\Views\Twig;
use App\Core\Service\SessionService;
use App\Domain\Platform\TenantRepository;

class UISettingsMiddleware implements MiddlewareInterface
{
    private Twig $twig;
    private SessionService $session;
    private TenantRepository $tenantRepository;

    public function __construct(Twig $twig, SessionService $session, TenantRepository $tenantRepository)
    {
        $this->twig = $twig;
        $this->session = $session;
        $this->tenantRepository = $tenantRepository;
    }

    public function process(Request $request, Handler $handler): Response
    {
        // Sadece oturum açmış kullanıcılar için çalışır
        if ($this->session->has('user_id') && $this->session->has('clinic_id')) {
            $clinicId = (int) $this->session->get('clinic_id');
            $role = (string) ($this->session->get('role') ?? 'guest');

            // 1. Kliniğin ayarlarını DB'den çek
            $config = $this->tenantRepository->getDisplayConfig($clinicId);

            // 2. Kullanıcının rolüne göre yetkileri hesapla (Flattening)
            $permissions = $this->calculatePermissions($config, $role);

            // 3. Twig'e boolean flagler olarak göm
            $this->twig->getEnvironment()->addGlobal('permissions', $permissions);
        }

        return $handler->handle($request);
    }

    /**
     * Karmaşık JSON ayarlarını, basit boolean izinlere dönüştürür.
     */
    private function calculatePermissions(array $config, string $role): array
    {
        // Varsayılan İzinler (Ayar yoksa ne olsun?)
        // Admin her zaman her şeyi görür kuralı burada uygulanabilir veya esnetilebilir.
        $isAdmin = ($role === 'admin');

        $p = [
            // Modüller
            'can_view_surgery' => true,
            'can_view_finance' => $isAdmin,
            'can_view_personnel' => $isAdmin,

            // Hasta Detay Gizlilik
            'can_view_patient_finance' => $isAdmin, // Varsayılan sadece admin
            'can_view_patient_vitals' => true,      // Varsayılan herkes görsün
        ];

        // Config üzerinden ezme işlemleri

        // 1. Ameliyat Modülü
        if (isset($config['modules']['surgery'][$role])) {
            $p['can_view_surgery'] = (bool) $config['modules']['surgery'][$role];
        }

        // 2. Finans Modülü
        if (isset($config['modules']['finance'][$role])) {
            $p['can_view_finance'] = (bool) $config['modules']['finance'][$role];
        }

        // 3. Personel Modülü
        if (isset($config['modules']['personnel'][$role])) {
            $p['can_view_personnel'] = (bool) $config['modules']['personnel'][$role];
        }

        // 4. Hasta Detay - Finans
        if (isset($config['patient_detail']['show_finance'][$role])) {
            $p['can_view_patient_finance'] = (bool) $config['patient_detail']['show_finance'][$role];
        }

        // 5. Hasta Detay - Yaşam Bulguları
        if (isset($config['patient_detail']['show_vitals'][$role])) {
            $p['can_view_patient_vitals'] = (bool) $config['patient_detail']['show_vitals'][$role];
        }

        return $p;
    }
}
