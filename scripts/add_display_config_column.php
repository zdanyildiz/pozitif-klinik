<?php
require __DIR__ . '/../vendor/autoload.php';

use DI\ContainerBuilder;
use App\Core\Database;

// Load Environment Variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$containerBuilder = new ContainerBuilder();
$containerBuilder->addDefinitions(__DIR__ . '/../config/container.php');
$container = $containerBuilder->build();

$db = $container->get(Database::class);
$connection = $db->getConnection();

echo "Checking if 'display_config' column exists in 'sys_tenants'...\n";

try {
    // Check if column exists
    $stmt = $connection->query("SHOW COLUMNS FROM sys_tenants LIKE 'display_config'");
    $column = $stmt->fetch();

    if ($column) {
        echo "Column 'display_config' already exists. Skipping.\n";
    } else {
        echo "Adding 'display_config' column to 'sys_tenants'...\n";
        $sql = "ALTER TABLE sys_tenants ADD COLUMN display_config JSON DEFAULT NULL AFTER is_active";
        $connection->exec($sql);
        echo "Column added successfully.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
