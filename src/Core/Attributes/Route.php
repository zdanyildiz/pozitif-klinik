<?php

declare(strict_types=1);

namespace App\Core\Attributes;

use Attribute;

/**
 * Route Attribute - HTTP rotalarını tanımlamak için kullanılır
 * 
 * Controller metodlarına eklenerek o metodun hangi HTTP metodu ve 
 * path ile çağrılacağını belirler.
 * 
 * Örnek Kullanım:
 * ```
 * #[Route('GET', '/list')]
 * public function listItems(...) { ... }
 * 
 * #[Route('POST', '/{id}/vitals')]
 * public function addVital(...) { ... }
 * ```
 */
#[Attribute(Attribute::TARGET_METHOD)]
class Route
{
    /**
     * @param string $method HTTP metodu: GET, POST, PUT, PATCH, DELETE
     * @param string $path   Rota path'i: '' (boş), '/{id}', '/{id}/vitals' vb.
     */
    public function __construct(
        public string $method,
        public string $path
    ) {
    }
}
