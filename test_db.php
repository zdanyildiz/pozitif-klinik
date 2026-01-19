<?php

require __DIR__ . '/vendor/autoload.php';

use App\Core\Database;
use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

$settings = require __DIR__ . '/config/settings.php';
$dbSettings = $settings['settings']['db'];

try {
    $db = Database::getInstance($dbSettings);
    $pdo = $db->getConnection();
    echo "Connection successful!";
} catch (Exception $e) {
    echo "Connection failed: " . $e->getMessage();
}
