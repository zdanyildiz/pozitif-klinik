<?php

declare(strict_types=1);

namespace App\Core\Attributes;

use Attribute;

/**
 * Middleware Attribute - Rotaları korumak için middleware ekler
 * 
 * Hem sınıf seviyesinde (tüm metodları etkiler) hem de 
 * metod seviyesinde (sadece o metodu etkiler) kullanılabilir.
 * 
 * IS_REPEATABLE sayesinde birden fazla middleware eklenebilir.
 * 
 * Örnek Kullanım (Sınıf Seviyesi):
 * ```
 * #[Middleware(TenantMiddleware::class)]
 * class PatientController { ... }
 * ```
 * 
 * Örnek Kullanım (Metod Seviyesi):
 * ```
 * #[Route('DELETE', '/{id}')]
 * #[Middleware(AdminOnlyMiddleware::class)]
 * public function delete(...) { ... }
 * ```
 * 
 * Çoklu Middleware:
 * ```
 * #[Middleware(TenantMiddleware::class)]
 * #[Middleware(LogMiddleware::class)]
 * class PatientController { ... }
 * ```
 */
#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD | Attribute::IS_REPEATABLE)]
class Middleware
{
    /**
     * @param string $className Middleware sınıfının tam adı (FQCN)
     */
    public function __construct(
        public string $className
    ) {
    }
}
