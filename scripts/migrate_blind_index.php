<?php

declare(strict_types=1);

use DI\ContainerBuilder;
use App\Core\Database;
use App\Core\Security\CryptoService;

require __DIR__ . '/../vendor/autoload.php';

// Load Environment Variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

// Container Setup
$containerBuilder = new ContainerBuilder();
$containerBuilder->addDefinitions(__DIR__ . '/../config/container.php');
$container = $containerBuilder->build();

$db = $container->get(Database::class);
$crypto = $container->get(CryptoService::class);

echo "Blind Index Migration Basliyor...\n";

// 1. Tüm Hastaları Çek
$sql = "SELECT * FROM ptn_cards";
$patients = $db->fetchAll($sql);

echo "Toplam " . count($patients) . " hasta bulundu.\n";

$count = 0;
foreach ($patients as $patient) {
    $id = $patient['id'];

    // Decrypt Data
    $name = $crypto->decrypt($patient['name']);
    $tcNo = $crypto->decrypt($patient['tc_no']);
    $phone = $crypto->decrypt($patient['phone']);

    // Clear Old Indices
    $db->query("DELETE FROM search_index WHERE table_name = 'ptn_cards' AND record_id = ?", [$id]);

    // Insert Name Tokens
    if ($name) {
        $normalizedName = $crypto->normalize($name);
        $tokens = explode(' ', $normalizedName);
        $uniqueTokens = array_unique(array_filter($tokens));

        foreach ($uniqueTokens as $token) {
            if (mb_strlen($token) < 2)
                continue;

            $hash = $crypto->blindIndex($token);
            $db->query(
                "INSERT INTO search_index (table_name, record_id, type, search_hash) VALUES (?, ?, ?, ?)",
                ['ptn_cards', $id, 'name', $hash]
            );
        }
    }

    // Insert TC
    if ($tcNo) {
        $hash = $crypto->blindIndex($tcNo);
        $db->query(
            "INSERT INTO search_index (table_name, record_id, type, search_hash) VALUES (?, ?, ?, ?)",
            ['ptn_cards', $id, 'tc_no', $hash]
        );
    }

    // Insert Phone
    if ($phone) {
        $hash = $crypto->blindIndex($phone);
        $db->query(
            "INSERT INTO search_index (table_name, record_id, type, search_hash) VALUES (?, ?, ?, ?)",
            ['ptn_cards', $id, 'phone', $hash]
        );
    }

    $count++;
    if ($count % 100 == 0) {
        echo "$count hasta islendi...\n";
    }
}

echo "Migration Tamamlandi! Toplam $count kayıt güncellendi.\n";
