<?php
echo "Current Dir: " . __DIR__ . "<br>";
$vendorPath = __DIR__ . '/../vendor/autoload.php';
echo "Looking for: " . $vendorPath . "<br>";
echo "Real path: " . (realpath($vendorPath) ?: 'CANNOT RESOLVE REALPATH') . "<br><br>";

if (file_exists($vendorPath)) {
    echo "✅ Dosya BULUNDU!<br>";
} else {
    echo "❌ Dosya BULUNAMADI!<br><br>";

    $parent = dirname(__DIR__);
    echo "Üst dizin (" . $parent . ") içeriği:<br>";
    if (is_dir($parent)) {
        $files = scandir($parent);
        echo "<pre>";
        if ($files === false) {
            echo "KAYITLAR OKUNAMADI (Permission denied?)";
        } else {
            print_r($files);
        }
        echo "</pre>";
    } else {
        echo "Üst dizin bir klasör değil veya erişilemiyor!<br>";
    }
}

// open_basedir kontrolü
$open_basedir = ini_get('open_basedir');
echo "<strong>open_basedir:</strong> " . ($open_basedir ?: 'Sınırsız (None)') . "<br>";
