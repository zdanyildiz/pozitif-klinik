<?php
require_once __DIR__ . '/../vendor/autoload.php';

use App\Core\Database;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

$settings = [
    'host' => $_ENV['DB_HOST'],
    'name' => $_ENV['DB_NAME'],
    'user' => $_ENV['DB_USER'],
    'pass' => $_ENV['DB_PASS'],
    'charset' => 'utf8mb4',
    'flags' => [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
];

$db = Database::getInstance($settings);

echo "Running migration: 11_add_discounts.sql" . PHP_EOL;

$sql = file_get_contents(__DIR__ . '/../migration/database/migrations/11_add_discounts.sql');

if (!$sql) {
    die("Error: SQL file not found.");
}

try {
    $db->getConnection()->exec($sql);
    echo "Migration completed successfully." . PHP_EOL;
} catch (\Exception $e) {
    echo "Migration failed: " . $e->getMessage() . PHP_EOL;
}
