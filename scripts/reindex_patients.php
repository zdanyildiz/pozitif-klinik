<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

// Load Environment Variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

use DI\ContainerBuilder;
use App\Core\Database;
use App\Domain\Patient\PatientRepository;
use App\Core\Security\CryptoService;
use App\Domain\Activity\ActivityLogger;

// DIY Container Setup for CLI
$containerBuilder = new ContainerBuilder();
$containerBuilder->addDefinitions(__DIR__ . '/../config/container.php');
$container = $containerBuilder->build();

/** @var Database $db */
$db = $container->get(Database::class);
/** @var PatientRepository $patientRepo */
$patientRepo = $container->get(PatientRepository::class);
/** @var CryptoService $crypto */
$crypto = $container->get(CryptoService::class);

echo "--- Arama İndeksi Re-index İşlemi Başlatıldı ---\n";

// Tüm hastaları çek (Klinik ID gözetmeksizin, çünkü biz sadece arama indeksini yeniliyoruz)
$sql = "SELECT id, tc_no, name, phone FROM ptn_cards";
$patients = $db->fetchAll($sql);

echo count($patients) . " hasta bulundu.\n";

$count = 0;
foreach ($patients as $p) {
    // Verileri çöz
    $data = [
        'name' => $crypto->decrypt($p['name']),
        'tc_no' => $crypto->decrypt($p['tc_no']),
        'phone' => $crypto->decrypt($p['phone'])
    ];

    // İndeksi güncelle
    // PatientRepository içindeki private metoda erişemediğimiz için yansıma (reflection) kullanalım 
    // veya repository'i updateSearchIndex'i public yapmaya zorlayalım.
    // Şimdilik repository metodunu kullanarak güncelleme yapalım.

    try {
        $reflection = new ReflectionClass($patientRepo);
        $method = $reflection->getMethod('updateSearchIndex');
        $method->setAccessible(true);
        $method->invoke($patientRepo, (int) $p['id'], $data);

        $count++;
        if ($count % 100 === 0) {
            echo "İşlenen: $count...\n";
        }
    } catch (Exception $e) {
        echo "Hata (ID: {$p['id']}): " . $e->getMessage() . "\n";
    }
}

echo "\n--- İşlem Tamamlandı! $count hasta başarıyla re-index edildi. ---\n";
