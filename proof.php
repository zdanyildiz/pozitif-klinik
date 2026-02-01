<?php
// Standalone decryption script
// Usage: php proof.php

$host = '127.0.0.1';
$db = 'pozitif_klinik';
$user = 'root';
$pass = ''; // Empty based on .env
$keyHex = 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef'; // From .env

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Fetch 5 patients skipping the first 100
    // These are the patients that standard 'last 100' search WILL MISS
    $stmt = $pdo->prepare("SELECT id, name, tc_no_hash FROM ptn_cards WHERE status = 1 ORDER BY id DESC LIMIT 5 OFFSET 100");
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "--- SON 100 LISTESINDE OLMAYAN HASTALAR ---\n";
    echo "(Bu hastaları 'Kısmi Arama' ile bulamazsınız, sadece tam isim/TC ile bulabilirsiniz)\n\n";

    $key = hex2bin($keyHex);
    $method = 'aes-256-gcm';

    foreach ($rows as $row) {
        $encryptedName = $row['name'];

        // Decrypt Logic
        $decoded = base64_decode($encryptedName);
        $ivLength = openssl_cipher_iv_length($method);
        $iv = substr($decoded, 0, $ivLength);
        $tag = substr($decoded, $ivLength, 16);
        $ciphertext = substr($decoded, $ivLength + 16);

        $name = openssl_decrypt($ciphertext, $method, $key, OPENSSL_RAW_DATA, $iv, $tag);

        echo "ID: " . $row['id'] . " | Isim: " . ($name ?: 'DEMO_DECRYPT_FAIL') . "\n";
    }

} catch (Exception $e) {
    echo "Hata: " . $e->getMessage() . "\n";
}
