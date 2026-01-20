<?php

declare(strict_types=1);

namespace App\Core\Attributes;

use Attribute;

/**
 * Group Attribute - Controller sınıflarına prefix eklemek için
 * 
 * Bir Controller sınıfının tepesine yazılarak, o sınıftaki 
 * tüm rotalar için ortak bir prefix tanımlar.
 * 
 * Örnek Kullanım:
 * ```
 * #[Group('/api/patients')]
 * class PatientController { ... }
 * ```
 * 
 * Bu durumda PatientController içindeki #[Route('GET', '')] 
 * otomatik olarak /api/patients yoluna, #[Route('POST', '/{id}/vitals')]
 * ise /api/patients/{id}/vitals yoluna yönlendirilir.
 */
#[Attribute(Attribute::TARGET_CLASS)]
class Group
{
    /**
     * @param string $prefix Grup prefix'i: '/api/patients', '/admin', '/auth' vb.
     */
    public function __construct(
        public string $prefix
    ) {
    }
}
