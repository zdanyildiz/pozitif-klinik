<?php
require __DIR__ . '/../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$settings = require __DIR__ . '/../config/settings.php';
$dbSettings = $settings['settings']['db'];

try {
    $dsn = "mysql:host=" . $dbSettings['host'] . ";dbname=" . $dbSettings['name'] . ";charset=" . $dbSettings['charset'];
    $pdo = new PDO($dsn, $dbSettings['user'], $dbSettings['pass'], $dbSettings['flags']);
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "Tables: " . implode(", ", $tables) . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
