<?php

declare(strict_types=1);

namespace App\Domain\Patient;

use App\Core\Database;

class PatientRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    public function findAll(int $clinicId): array
    {
        // Placeholder
        return [];
    }

    public function findById(int $clinicId, int $patientId): ?array
    {
        // Placeholder
        return null;
    }

    public function create(int $clinicId, array $data): int
    {
        // Placeholder
        return 1;
    }

    public function update(int $clinicId, int $patientId, array $data): bool
    {
        // Placeholder
        return true;
    }

    public function delete(int $clinicId, int $patientId): bool
    {
        // Placeholder
        return true;
    }
}
