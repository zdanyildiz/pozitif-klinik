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

// Son 100'ün dışında kalan bir hasta (Örn: 101. eski kayıt)
$sql = "SELECT id, name FROM ptn_cards WHERE status = 1 ORDER BY id DESC LIMIT 1 OFFSET 100";
$patient = $db->fetch($sql);

if ($patient) {
    $decryptedName = $crypto->decrypt($patient['name']);
    echo "ID: " . $patient['id'] . "\n";
    echo "Name: " . $decryptedName . "\n";
} else {
    echo "Hasta bulunamadı.\n";
}
