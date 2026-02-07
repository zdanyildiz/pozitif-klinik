<?php
require 'vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();
use App\Core\Database;

$db = Database::getInstance([
    'host' => $_ENV['DB_HOST'],
    'name' => $_ENV['DB_NAME'],
    'user' => $_ENV['DB_USER'],
    'pass' => $_ENV['DB_PASS'],
    'charset' => 'utf8mb4'
]);

// Find appointments that have payments but NO items
$sql = "SELECT DISTINCT a.id, a.clinic_id, p.amount, p.notes 
        FROM cln_appointments a
        JOIN cln_payments p ON a.id = p.appointment_id
        LEFT JOIN cln_appointment_items i ON a.id = i.appointment_id
        WHERE i.id IS NULL";

$rows = $db->fetchAll($sql);
echo "Found " . count($rows) . " appointments missing items. Repairing...\n";

foreach ($rows as $row) {
    $itemName = $row['notes'] ?: 'Hizmet Bedeli';
    $db->query("INSERT INTO cln_appointment_items (clinic_id, appointment_id, item_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)", [
        $row['clinic_id'],
        $row['id'],
        $itemName,
        1,
        $row['amount'],
        $row['amount']
    ]);
    echo "  + Added item for Appointment {$row['id']} ({$row['amount']} TL)\n";
}

echo "Repair complete.\n";
