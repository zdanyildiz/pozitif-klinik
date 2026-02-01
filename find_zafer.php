<?php
require __DIR__ . '/vendor/autoload.php';

use App\Core\Database;
use App\Core\Security\CryptoService;
use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

$settings = require __DIR__ . '/config/settings.php';
$db = Database::getInstance($settings['settings']['db']);
$crypto = new CryptoService($_ENV['APP_KEY']);

// Tüm hastaları çek ve decrypt et (Zafer'i bulmak için)
// Performans için limit koymuyoruz ama memory patlamasın diye dikkatli olalım.
// Sadece Zafer'i bulmaya çalışıyoruz.

$sql = "SELECT id, name FROM ptn_cards WHERE status = 1 ORDER BY id DESC LIMIT 500";
$rows = $db->fetchAll($sql);

echo "--- SON 500 HASTA TARANIYOR --- \n";

$found = false;
foreach ($rows as $row) {
    $name = $crypto->decrypt($row['name']);
    if (stripos($name, 'Zafer') !== false) {
        echo "BULUNDU! ID: " . $row['id'] . " | Isim: " . $name . "\n";
        $found = true;
    }
}

if (!$found) {
    echo "Son 500 kayıtta 'Zafer' yok. Daha eskilere bakmak lazım.\n";
}
