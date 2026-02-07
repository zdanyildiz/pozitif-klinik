<?php
require 'vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();
use App\Core\Database;
use App\Core\Security\CryptoService;

$db = Database::getInstance([
    'host' => $_ENV['DB_HOST'],
    'name' => $_ENV['DB_NAME'],
    'user' => $_ENV['DB_USER'],
    'pass' => $_ENV['DB_PASS'],
    'charset' => 'utf8mb4',
    'flags' => [PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
]);
$crypto = new CryptoService($_ENV['APP_KEY'], $_ENV['BLIND_INDEX_KEY']);

$sql = "SELECT id, name FROM ptn_cards";
$rows = $db->fetchAll($sql);
foreach ($rows as $row) {
    if ($row['name']) {
        $dec = $crypto->decrypt($row['name']);
        echo "ID: {$row['id']} - Name: $dec\n";
    }
}
