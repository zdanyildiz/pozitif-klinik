<?php

/**
 * Pozitif Klinik - Demo Veri Oluşturucu
 * 
 * Bu script, sistemi test etmek ve demo gösterimlerinde kullanmak üzere kapsamlı ve gerçekçi veriler oluşturur.
 * 
 * KULLANIM KILAVUZU:
 * 1. Yeni bir hasta senaryosu eklemek için $demoScenarios dizisine yeni bir eleman ekleyin.
 * 2. 'profile' altında hasta kimlik bilgilerini tanımlayın.
 * 3. 'visits' altında kronolojik sırayla muayene, lab, görüntüleme vb. adımları tanımlayın.
 * 4. Sistemdeki doktorları $doctors dizisinde tanımlayabilirsiniz.
 * 
 * Run via: php scripts/demo/create_demo_data.php
 */

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

// Load Environment Variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../');
$dotenv->safeLoad();

use DI\ContainerBuilder;
use App\Core\Database;
use App\Domain\Patient\PatientRepository;
use App\Core\Security\CryptoService;
use App\Domain\User\UserRepository;
use App\Domain\Examination\ExaminationRepository;
use App\Domain\Lab\LabRepository;

// --- KONFIGURASYON ---
$clinicId = 2; // Demo klinik ID'si (Tüm demolar bu ID altında toplanır)
$now = new DateTime();

// --- DOKTOR TANIMLARI ---
// Sistemde olması gereken doktorlar. Yoksa oluşturulur.
// NOT: AI Ajanları yeni senaryo eklerken, eğer listede olmayan bir branş (key) kullanacaksa
// buraya da ekleme yapmalıdır.
$doctors = [
    'INTERNAL_MEDICINE' => ['name' => 'Uzm. Dr. Ayşe Yılmaz', 'username' => 'dr.ayse', 'specialty' => 'INTERNAL_MEDICINE'],
    'OPHTHALMOLOGY' => ['name' => 'Op. Dr. Kemal Gözde', 'username' => 'dr.kemal', 'specialty' => 'OPHTHALMOLOGY'],
    'CARDIOLOGY' => ['name' => 'Prof. Dr. Canan Kalp', 'username' => 'dr.canan', 'specialty' => 'CARDIOLOGY'],
    'EMERGENCY' => ['name' => 'Acil Servis Doktoru', 'username' => 'dr.acil', 'specialty' => 'EMERGENCY_MEDICINE'],
    'ENT' => ['name' => 'KBB Uzmanı', 'username' => 'dr.kbb', 'specialty' => 'ENT'],
    'DIETETICS' => ['name' => 'Diyetisyen Merve', 'username' => 'dyt.merve', 'specialty' => 'DIETETICS'],
    // 'DERMATOLOGY'    => ['name' => 'Dr. Cilt', 'username' => 'dr.cilt', 'specialty' => 'DERMATOLOGY'], // Örnek
];

// --- SENARYO TANIMLARI ---
// Buraya yeni hasta senaryoları ekleyebilirsiniz.
$demoScenarios = [
    [
        'id_tag' => 'ali_vural_ent', // Script içi referans ID
        'profile' => [
            'tc_no' => '44444444444',
            'name' => 'Ali Vural',
            'phone' => '0533 222 11 00',
            'email' => 'ali.vural@demo-mail.com',
            'birth_date' => '1990-11-10', // 35 yaşında
            'gender' => 'M',
            'address' => 'Feneryolu Mah. Bağdat Cad. No:20, Kadıköy / İstanbul',
            'province_id' => 34,
            'district_id' => 1,
            'notes' => 'Müzisyen. İşitme sağlığı konusunda hassas.',
            'status' => 1
        ],
        'visits' => [
            // 1. ZİYARET: İLK MUAYENE (KBB)
            [
                'type' => 'examination',
                'date' => '2025-04-01 11:00:00',
                'doctor' => 'ENT', // KBB Uzmanı
                'status_code' => 'completed',
                'data' => [
                    'complaint' => 'Burun tıkanıklığı, baş ağrısı ve sağ kulakta dolgunluk hissi.',
                    'story' => 'Son 2 yıldır tekrarlayan sinüzit atakları. Mevsim geçişlerinde artıyor. Son 1 haftadır sağ kulakta işitme azlığı hissediyor.',
                    'diagnosis' => 'J32.0 - Kronik Maksiller Sinüzit, H65.1 - Diğer akut olmayan süpüratif otitis media',
                    'general_notes' => 'Rinoskopi: Nazal mukoza hiperemik. Konkalar hipertrofik. Geniz akıntısı (+). Otoskopi: Sağ zar mat, retraksiyon var. Sol zar doğal.',
                    'specialty_data' => [
                        'right_ear_exam' => 'Mat, Retrakte, Işık üçgeni yok',
                        'left_ear_exam' => 'Normal',
                        'nose_exam' => 'Septum deviasyonu (hafif sağa), Pürülan akıntı',
                        'throat_exam' => 'Orofarenks doğal, Tonsiller evre 1'
                    ]
                ],
                'payment' => ['amount' => 2500.00, 'method' => 'credit_card', 'reason' => 'KBB Muayenesi']
            ],
            // 2. ZİYARET: TETKİK (Odyometri ve Timpanometri)
            // Not: Bunu bir "İşlem/Examination" kaydı olarak giriyoruz, sonuçları JSON'da tutuyoruz.
            [
                'type' => 'examination',
                'date' => '2025-04-01 11:30:00', // Muayeneden hemen sonra
                'doctor' => 'ENT',
                'status_code' => 'completed',
                'data' => [
                    'complaint' => 'İşitme Testi (Odyometri & Timpanometri)',
                    'diagnosis' => 'H90.0 - İletim tipi işitme kaybı, tek taraflı',
                    'general_notes' => 'Sağ kulakta iletim tipi kayıp ve orta kulak efüzyonu (sıvı birikimi) saptandı.',
                    'specialty_data' => [
                        'audiometry_right_air' => '35 dB (Hafif Kayıp)',
                        'audiometry_right_bone' => '10 dB',
                        'audiometry_left_air' => '15 dB (Normal)',
                        'audiometry_left_bone' => '10 dB',
                        'tympanogram_right' => 'Tip B (Düz/Sıvı)',
                        'tympanogram_left' => 'Tip A (Normal)'
                    ]
                ],
                'payment' => ['amount' => 1500.00, 'method' => 'cash', 'reason' => 'Odyometri Test Paketi']
            ],
            // 3. ZİYARET: KONTROL (Tedavi Sonrası)
            [
                'type' => 'examination',
                'date' => '2025-04-15 14:00:00',
                'doctor' => 'ENT',
                'status_code' => 'completed',
                'data' => [
                    'complaint' => 'Kontrol. İlaç bitimi.',
                    'diagnosis' => 'J32.0 - Kronik Maksiller Sinüzit (İyileşme sürecinde)',
                    'general_notes' => 'Hasta medikal tedaviden (Antibiyotik + Nazal Steroid + Dekonjestan) fayda gördü. Sağ kulaktaki dolgunluk azaldı. Valsalva manevrası pozitif.',
                    'specialty_data' => [
                        'right_ear_exam' => 'Havalanma artmış, efüzyon gerilemiş.',
                        'control_result' => 'Tedavi başarılı, cerrahiye gerek görülmedi.'
                    ]
                ],
                // Kontrol süresi içinde, ödeme yok.
            ]
        ]
    ]
];


// --- ALTYAPI KURULUMU (Container & Services) ---
$containerBuilder = new ContainerBuilder();
$containerBuilder->addDefinitions(__DIR__ . '/../../config/container.php');
$container = $containerBuilder->build();

$db = $container->get(Database::class);
$patientRepo = $container->get(PatientRepository::class);
$userRepo = $container->get(UserRepository::class);
$examRepo = $container->get(ExaminationRepository::class);
$labRepo = $container->get(LabRepository::class);
$crypto = $container->get(CryptoService::class);

echo "--- Pozitif Klinik Demo Veri Motoru Başlatıldı ---\n";

// --- ADIM 1: DOKTORLARI HAZIRLA ---
echo "\n[1/3] Doktor Hesapları Kontrol Ediliyor...\n";
$doctorIds = [];
foreach ($doctors as $code => $doc) {
    $existing = $userRepo->findByUsername($clinicId, $doc['username']);
    if ($existing) {
        $doctorIds[$code] = $existing['id'];
    } else {
        $sql = "INSERT INTO sys_users (clinic_id, username, name, password_hash, role, specialty, is_active, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        $db->query($sql, [
            $clinicId,
            $doc['username'],
            $doc['name'],
            password_hash('123456', PASSWORD_BCRYPT),
            'doctor',
            $doc['specialty'],
            1,
            date('Y-m-d H:i:s')
        ]);
        // Insert genellikle lastInsertId döndürmeli ama Database sınıfına göre değişebilir.
        // Güvenlik için lastInsertId'yi manuel alalım eğer dönmüyorsa.
        $doctorIds[$code] = (int) $db->getConnection()->lastInsertId();
        echo "  + Oluşturuldu: {$doc['name']} (ID: {$doctorIds[$code]})\n";
    }
}
echo "  > Doktorlar hazır.\n";

// --- ADIM 2: HASTA VE ZİYARETLERİ İŞLE ---
echo "\n[2/3] Hasta Senaryoları İşleniyor...\n";

foreach ($demoScenarios as $scenario) {
    echo "  > Senaryo: {$scenario['profile']['name']} ({$scenario['profile']['tc_no']})...\n";

    // Hasta var mı kontrol et
    $existingPatients = $patientRepo->search($clinicId, $scenario['profile']['tc_no']);
    $patientId = null;
    foreach ($existingPatients as $p) {
        if ($p['tc_no'] === $scenario['profile']['tc_no']) {
            $patientId = $p['id'];
            echo "    - Hasta zaten mevcut (ID: $patientId). Güncelleniyor...\n";
            $patientRepo->update($clinicId, $patientId, $scenario['profile']);
            break;
        }
    }

    if (!$patientId) {
        $patientId = $patientRepo->create($clinicId, $scenario['profile']);
        echo "    - Yeni hasta kartı oluşturuldu (ID: $patientId).\n";
    }

    // Ziyaretleri İşle
    echo "    - Ziyaret geçmişi oluşturuluyor (" . count($scenario['visits']) . " kayıt)...\n";

    // Randevu Türünü Al (Yoksa oluştur)
    if (!isset($defaultTypeId)) {
        $apptType = $db->fetch("SELECT id FROM cln_appointment_types WHERE clinic_id = ? LIMIT 1", [$clinicId]);
        if ($apptType) {
            $defaultTypeId = $apptType['id'];
        } else {
            $db->query("INSERT INTO cln_appointment_types (clinic_id, service_id, name, color_code, duration_minutes, default_price, is_active) 
                        VALUES (?, NULL, 'Genel Muayene', '#3788d8', 30, 0.00, 1)", [$clinicId]);
            $defaultTypeId = (int) $db->getConnection()->lastInsertId();
            echo "    + Varsayılan Randevu Türü Oluşturuldu (ID: $defaultTypeId)\n";
        }
    }

    foreach ($scenario['visits'] as $visit) {
        $docId = $doctorIds[$visit['doctor']] ?? null;
        if (!$docId) {
            echo "    ! HATA: '{$visit['doctor']}' kodlu doktor bulunamadı.\n";
            continue;
        }

        // 1. Randevu Oluştur
        $status = $visit['status'] ?? $visit['status_code'] ?? 'confirmed';

        $sqlAppt = "INSERT INTO cln_appointments (clinic_id, patient_id, doctor_id, type_id, appointment_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)";
        $db->query($sqlAppt, [$clinicId, $patientId, $docId, $defaultTypeId, $visit['date'], $status, date('Y-m-d H:i:s')]);
        $apptId = (int) $db->getConnection()->lastInsertId();

        // 2. İşlem Türüne Göre Detay (Muayene veya Lab)
        if ($visit['type'] === 'examination') {
            $visit['data']['clinic_id'] = $clinicId;
            $visit['data']['patient_id'] = $patientId;
            $visit['data']['doctor_user_id'] = $docId;
            $visit['data']['appointment_id'] = $apptId;
            $visit['data']['specialty_code'] = $doctors[$visit['doctor']]['specialty']; // Ön tanımlı branş kodu

            // Mapping for AI Agents Inputs
            if (isset($visit['data']['general_notes'])) {
                $visit['data']['bulgular'] = ($visit['data']['bulgular'] ?? '') . "\n" . $visit['data']['general_notes'];
            }
            if (isset($visit['data']['specialty_data']) && is_array($visit['data']['specialty_data'])) {
                $visit['data']['specialty_data'] = json_encode($visit['data']['specialty_data'], JSON_UNESCAPED_UNICODE);
            }

            $examRepo->create($visit['data']);

        } elseif ($visit['type'] === 'lab_result') {
            // Lab Başlığı
            $labData = [
                'clinic_id' => $clinicId,
                'patient_id' => $patientId,
                'appointment_id' => $apptId,
                'doctor_id' => $docId,
                'request_date' => $visit['data']['request_date'],
                'result_date' => $visit['data']['result_date']
            ];
            $resultId = $labRepo->createResult($labData);

            // Sonuç Kalemleri
            foreach ($visit['data']['items'] as $item) {
                $labRepo->createResultItem($resultId, $item);
            }
        }

        // 3. Ödeme Kaydı
        if (isset($visit['payment'])) {
            $sqlPay = "INSERT INTO cln_payments (clinic_id, patient_id, appointment_id, payment_type, amount, currency, payment_date, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            $db->query($sqlPay, [
                $clinicId,
                $patientId,
                $apptId,
                $visit['payment']['method'],
                $visit['payment']['amount'],
                'TRY',
                date('Y-m-d H:i:s'),
                $visit['payment']['reason'],
                'completed'
            ]);
        }
    }
}

echo "\n--- [3/3] Demo Veri Oluşturma Başarıyla Tamamlandı! ---\n";
