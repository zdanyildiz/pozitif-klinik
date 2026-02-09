<?php

declare(strict_types=1);

namespace App\Core\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use App\Domain\Platform\TenantRepository;

/**
 * Domain-based Tenant Identification Middleware
 * 
 * Host bilgisindeki subdomain'i (domain_prefix) kontrol ederek
 * ilgili tenant'ı tespit eder ve request attribute olarak ekler.
 */
class DomainTenantMiddleware implements MiddlewareInterface
{
    private TenantRepository $tenantRepository;

    public function __construct(TenantRepository $tenantRepository)
    {
        $this->tenantRepository = $tenantRepository;
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $host = $request->getUri()->getHost();
        $parts = explode('.', $host);

        // Subdomain tespiti
        // Örn: erhan-ozel.pozitifklinik.tr -> parts: ['erhan-ozel', 'pozitifklinik', 'tr']
        // Örn: erhan-ozel.localhost -> parts: ['erhan-ozel', 'localhost']
        $subdomain = null;

        if (count($parts) >= 3) {
            $subdomain = $parts[0];
        } elseif (count($parts) === 2 && $parts[1] === 'localhost') {
            $subdomain = $parts[0];
        }

        // Genel subdomain'leri veya ana domain'i atla
        $ignoredSubdomains = ['www', 'mail', 'ftp', 'admin', 'platform', 'pozitifklinik'];

        if ($subdomain && !in_array(strtolower($subdomain), $ignoredSubdomains)) {
            $tenant = $this->tenantRepository->findByDomain($subdomain);
            if ($tenant) {
                // Bulunan tenant bilgisini request'e ekle
                $request = $request->withAttribute('identified_tenant', $tenant);
            }
        }

        return $handler->handle($request);
    }
}
