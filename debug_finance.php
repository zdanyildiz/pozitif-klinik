<?php
require 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

use App\Core\Database;
use App\Core\Security\CryptoService;
use App\Domain\Finance\PaymentRepository;

$db = Database::getInstance([
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
]);

$appKey = $_ENV['APP_KEY'];
$blindIndexKey = $_ENV['BLIND_INDEX_KEY'];
$crypto = new CryptoService($appKey, $blindIndexKey);

$repo = new PaymentRepository($db, $crypto);

$id = 75607;

$sql = "SELECT clinic_id, patient_id, appointment_date FROM cln_appointments WHERE id = ?";
$res = $db->fetch($sql, [$id]);
echo "Checking Appointment $id:\n";
print_r($res);

if ($res) {
    echo "Metod çağrılıyor...\n";
    $details = $repo->getTransactionDetailWithServices((int) $res['clinic_id'], $id);
    print_r($details);
} else {
    echo "Appointment $id not found in cln_appointments. Checking cln_payments...\n";
    $sql = "SELECT id, clinic_id, patient_id, appointment_id, payment_date FROM cln_payments WHERE id = ?";
    $resPay = $db->fetch($sql, [$id]);
    print_r($resPay);

    if ($resPay && $resPay['appointment_id']) {
        echo "Found appointment_id: " . $resPay['appointment_id'] . "\n";
        $details = $repo->getTransactionDetailWithServices((int) $resPay['clinic_id'], (int) $resPay['appointment_id']);
        print_r($details);
    }
}
