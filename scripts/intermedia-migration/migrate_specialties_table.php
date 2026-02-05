<?php
// scripts/intermedia-migration/migrate_specialties.php
// This script applies the schema change renaming sys_specialty_forms -> sys_medical_specialties
// And inserts default specialties

$host = 'localhost';
$db = 'pozitif_klinik';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);

    echo "Applying schema changes...\n";

    // Check if sys_specialty_forms exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'sys_specialty_forms'");
    if ($stmt->rowCount() > 0) {
        $pdo->exec("DROP TABLE sys_specialty_forms");
        echo "Dropped OLD sys_specialty_forms table.\n";
    }

    // Check if sys_medical_specialties exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'sys_medical_specialties'");
    if ($stmt->rowCount() == 0) {
        $sql = "CREATE TABLE `sys_medical_specialties` (
          `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
          `code` varchar(50) NOT NULL,
          `name` varchar(100) NOT NULL,
          `icd_prefixes` varchar(255) DEFAULT NULL COMMENT 'Comma separated ICD-10 prefixes for search boost (e.g. H,J)',
          `form_schema` LONGTEXT DEFAULT NULL COMMENT 'JSON storage for form fields definition',
          `is_active` tinyint(1) DEFAULT 1,
          `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
          PRIMARY KEY (`id`),
          UNIQUE KEY `specialty_code` (`code`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

        $pdo->exec($sql);
        echo "Created sys_medical_specialties table.\n";

        // Insert Defaults
        $defaults = [
            ['INTERNAL_MEDICINE', 'İç Hastalıkları (Dahiliye)', 'A,B,E,J,I,N'],
            ['CARDIOLOGY', 'Kardiyoloji', 'I'],
            ['ENT', 'Kulak Burun Boğaz', 'H,J'],
            ['OPHTHALMOLOGY', 'Göz Hastalıkları', 'H'],
            ['ORTHOPEDICS', 'Ortopedi ve Travmatoloji', 'M'],
            ['DERMATOLOGY', 'Dermatoloji (Cildiye)', 'L'],
            ['NEUROLOGY', 'Nöroloji', 'G'],
            ['PSYCHIATRY', 'Psikiyatri', 'F'],
            ['GYNECOLOGY', 'Kadın Hastalıkları ve Doğum', 'O'],
            ['PEDIATRICS', 'Çocuk Sağlığı ve Hastalıkları', 'A,B,E,J,P,Q'],
            ['UROLOGY', 'Üroloji', 'N'],
            ['GENERAL_SURGERY', 'Genel Cerrahi', 'K,C,D'],
            ['PULMONOLOGY', 'Göğüs Hastalıkları', 'J'],
            ['ENDOCRINOLOGY', 'Endokrinoloji', 'E'],
            ['INFECTIOUS_DISEASES', 'Enfeksiyon Hastalıkları', 'A,B'],
            ['EMERGENCY', 'Acil Tıp', 'R,S,T']
        ];

        $insertSql = "INSERT INTO sys_medical_specialties (code, name, icd_prefixes) VALUES (?, ?, ?)";
        $stmt = $pdo->prepare($insertSql);

        foreach ($defaults as $row) {
            $stmt->execute($row);
        }
        echo "Inserted " . count($defaults) . " default specialties.\n";
    } else {
        echo "sys_medical_specialties already exists. Skipping.\n";
    }

} catch (\PDOException $e) {
    throw new \PDOException($e->getMessage(), (int) $e->getCode());
}
