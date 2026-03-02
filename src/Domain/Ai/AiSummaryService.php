<?php

declare(strict_types=1);

namespace App\Domain\Ai;

use App\Domain\Patient\PatientRepository;
use App\Domain\Examination\ExaminationRepository;
use Exception;

class AiSummaryService
{
    public function __construct(
        private readonly AiSettingsRepository $aiSettingsRepo,
        private readonly PatientRepository $patientRepo,
        private readonly ExaminationRepository $examRepo,
        private readonly \Psr\Log\LoggerInterface $logger
    ) {
    }

    /**
     * Hastanın geçmişini LLM'e göndererek veya güncelleyerek bir özet döndürür
     * 
     * @param int $clinicId
     * @param int $patientId
     * @return array ['success' => bool, 'summary' => string, 'message' => string]
     */
    public function generatePatientSummary(int $clinicId, int $patientId): array
    {
        // 1. Ayarları Kontrol Et
        $settings = $this->aiSettingsRepo->getSettings();
        if (!$settings || empty($settings['is_active'])) {
            return ['success' => false, 'message' => 'AI özellikleri sistem yöneticisi tarafından devre dışı bırakılmış.'];
        }

        if (empty($settings['api_key_decrypted'])) {
            return ['success' => false, 'message' => 'AI API Key yapılandırılmamış.'];
        }

        $apiKey = $settings['api_key_decrypted'];
        $modelName = $settings['model_name'];
        $systemPrompt = $settings['system_prompt'];

        // 2. Hasta Verisini Çek (PII İçermemeli)
        $patient = $this->patientRepo->findById($clinicId, $patientId);
        if (!$patient) {
            return ['success' => false, 'message' => 'Hasta bulunamadı.'];
        }

        // 2.1 İzin Kontrolü (KVKK/AI Sum Consent)
        $consents = $patient['legal_consents'] ?? [];
        if (empty($consents['ai_summary']['is_accepted'])) {
            return ['success' => false, 'message' => 'Hastanın AI Özeti kullanımı için onayı bulunmamaktadır.'];
        }

        $anonPatientData = [
            'age' => $this->calculateAge($patient['birth_date']),
            'gender' => $patient['gender'],
            'blood_type' => $patient['blood_type'] ?? 'Bilinmiyor',
            'medical_info' => $patient['medical_info'] ?? [],
        ];

        // 3. Mevcut Özeti ve Son Muayeneyi Kontrol Et
        $latestSummary = $this->aiSettingsRepo->getPatientLatestSummary($clinicId, $patientId);
        $lastExamId = $latestSummary ? (int) $latestSummary['last_examination_id'] : 0;

        // 4. Muayene Kayıtlarını Getir ve Filtrele
        $allExams = $this->examRepo->findAllByPatient($clinicId, $patientId);

        // Sadece ID'si lastExamId'den büyük olan ve pozitif olan gerçek muayeneleri al (Randevuları atla veya dahil et ama id kontrolü)
        $newExams = [];
        $maxExamId = $lastExamId;

        // "findAllByPatient" sonucu DESC order geliyor.
        $allExams = array_reverse($allExams); // ASC'ye çevir ki kronolojik olsun

        foreach ($allExams as $exam) {
            $currentId = (int) $exam['id'];
            if ($currentId > $lastExamId) {
                // Sadece verisi olan alanları anonimleştir
                $filteredExam = [
                    'date' => $exam['created_at'],
                    'complaint' => $exam['complaint'],
                    'story' => $exam['story'],
                    'findings' => $exam['bulgular'],
                    'diagnosis' => $exam['diagnosis'],
                    'treatment' => $exam['treatment'],
                    'lab' => $exam['lab_result_text']
                ];

                // Sadece içi dolu olanları filtrele
                $filteredExam = array_filter($filteredExam, fn($val) => !empty($val) && $val !== 'Randevu (Detay Girilmedi)');

                if (!empty($filteredExam)) {
                    $newExams[] = $filteredExam;
                }

                if ($currentId > $maxExamId) {
                    $maxExamId = $currentId;
                }
            }
        }

        if (empty($newExams) && $latestSummary) {
            return [
                'success' => true,
                'summary' => $latestSummary['summary_text'],
                'message' => 'Yeni güncellenecek veri bulunamadığından mevcut özet getirildi.',
                'is_cached' => true
            ];
        }

        // 5. LLM Promptunu Hazırla
        $promptContext = "HASTA TEMEL BİLGİLERİ (ANONİM):\n" . json_encode($anonPatientData, JSON_UNESCAPED_UNICODE) . "\n\n";

        if ($latestSummary) {
            $promptContext .= "HASTANIN ÖNCEKİ SAĞLIK ÖZETİ:\n" . $latestSummary['summary_text'] . "\n\n";
            $promptContext .= "YENİ MUAYENE VE BULGULAR (Önceki özetten sonraki kayıtlar):\n" . json_encode($newExams, JSON_UNESCAPED_UNICODE) . "\n\n";
            $systemPrompt .= " Önceki özeti dikkate alarak YENİ MUAYENE VERİLERİ ile özeti entegre et ve GÜNCEL, tek bir bütünleşik özet ver.";
        } else {
            $promptContext .= "HASTANIN TÜM MUAYENE GEÇMİŞİ VE BULGULARI:\n" . json_encode($newExams, JSON_UNESCAPED_UNICODE) . "\n\n";
        }

        // 6. API İstek
        try {
            $generatedText = $this->callGeminiApi($apiKey, $modelName, $systemPrompt, $promptContext);

            // JSON'dan HTML içeriğini ayıkla
            $summaryContent = $generatedText;
            $decoded = json_decode($generatedText, true);

            if (json_last_error() === JSON_ERROR_NONE && isset($decoded['summary_html'])) {
                $summaryContent = $decoded['summary_html'];
            } else {
                // Eğer LLM Markdown kod blokları içinde JSON döndürdüyse temizle
                if (preg_match('/```json\s*(.*?)\s*```/s', $generatedText, $matches)) {
                    $innerDecoded = json_decode($matches[1], true);
                    if (isset($innerDecoded['summary_html'])) {
                        $summaryContent = $innerDecoded['summary_html'];
                    }
                }
            }

            // 7. Yeni Özeti DB'ye Kaydet
            $this->aiSettingsRepo->savePatientSummary($clinicId, $patientId, $summaryContent, $maxExamId);

            return [
                'success' => true,
                'summary' => $summaryContent,
                'message' => 'Özet başarıyla oluşturuldu.',
                'is_cached' => false
            ];

        } catch (Exception $e) {
            $this->logger->error("AI Summary Error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Yapay zeka servisiyle iletişim sırasında bir hata oluştu: ' . $e->getMessage()];
        }
    }

    /**
     * Gemini API'sine cURL ile bağlanıp sonucu döner.
     */
    private function callGeminiApi(string $apiKey, string $modelName, string $systemPrompt, string $userPrompt): string
    {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$modelName}:generateContent?key={$apiKey}";

        $payload = [
            "system_instruction" => [
                "parts" => [
                    ["text" => $systemPrompt]
                ]
            ],
            "contents" => [
                [
                    "role" => "user",
                    "parts" => [
                        ["text" => $userPrompt]
                    ]
                ]
            ],
            "generationConfig" => [
                "temperature" => 0.2,
                "topK" => 40,
                "topP" => 0.95,
                "maxOutputTokens" => 8192
            ]
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30); // 30 sn timeout

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception("cURL Error: " . $error);
        }

        $decoded = json_decode($response, true);

        if ($httpCode !== 200) {
            $errMsg = $decoded['error']['message'] ?? 'Bilinmeyen API Hatası';
            throw new Exception("API Response Error ({$httpCode}): " . $errMsg);
        }

        if (empty($decoded['candidates'][0]['content']['parts'][0]['text'])) {
            throw new Exception("API'den beklenen metin geri dönmedi.");
        }

        return $decoded['candidates'][0]['content']['parts'][0]['text'];
    }

    private function calculateAge(?string $birthDate): ?int
    {
        if (!$birthDate)
            return null;
        try {
            $dob = new \DateTime($birthDate);
            $now = new \DateTime();
            return $now->diff($dob)->y;
        } catch (\Exception $e) {
            return null;
        }
    }
}
