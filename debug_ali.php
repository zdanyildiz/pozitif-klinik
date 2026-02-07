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

$sql = "SELECT id, appointment_date, status FROM cln_appointments WHERE patient_id = 16542 ORDER BY id DESC LIMIT 5";
$rows = $db->fetchAll($sql);
print_r($rows);

$sql = "SELECT id, appointment_id, amount, payment_date FROM cln_payments WHERE patient_id = 16542 ORDER BY id DESC LIMIT 5";
$rows = $db->fetchAll($sql);
print_r($rows);

$sql = "SELECT * FROM cln_appointment_items WHERE appointment_id IN (SELECT id FROM cln_appointments WHERE patient_id = 16542)";
$rows = $db->fetchAll($sql);
print_r($rows);
