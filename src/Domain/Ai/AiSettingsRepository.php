<?php

declare(strict_types=1);

namespace App\Domain\Ai;

use App\Core\Database;
use App\Core\Security\CryptoService;

class AiSettingsRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly CryptoService $crypto
    ) {
    }

    /**
     * AI ayarlarını getirir (id = 1)
     */
    public function getSettings(): ?array
    {
        $sql = "SELECT id, api_key, model_name, system_prompt, is_active, updated_at 
                FROM sys_ai_settings 
                ORDER BY id ASC LIMIT 1";

        $settings = $this->db->fetch($sql);

        if ($settings && !empty($settings['api_key'])) {
            $settings['api_key_decrypted'] = $this->crypto->decrypt($settings['api_key']);
        }

        return $settings ?: null;
    }

    /**
     * AI ayarlarını kaydeder/günceller
     * 
     * @param string|null $apiKey Açık API Key (veritabanına şifrelenerek kaydedilecek)
     * @param string $modelName Örneğin: gemini-2.5-flash
     * @param string $systemPrompt Sistem komutu
     * @param bool $isActive Aktif/Pasif durumu
     */
    public function saveSettings(?string $apiKey, string $modelName, string $systemPrompt, bool $isActive): void
    {
        // Önce kayıt var mı kontrol et
        $existing = $this->db->fetch("SELECT id, api_key FROM sys_ai_settings ORDER BY id ASC LIMIT 1");

        // Eğer API key boş gönderilmişse ve eski kayıt varsa, eskisini koru
        $finalApiKey = null;
        if (!empty($apiKey)) {
            $finalApiKey = $this->crypto->encryptSafe($apiKey);
        } else if ($existing && !empty($existing['api_key'])) {
            $finalApiKey = $existing['api_key']; // Mevcut şifreli key'i koru
        }

        if ($existing) {
            $sql = "UPDATE sys_ai_settings 
                    SET api_key = ?, model_name = ?, system_prompt = ?, is_active = ? 
                    WHERE id = ?";
            $this->db->query($sql, [
                $finalApiKey,
                $modelName,
                $systemPrompt,
                $isActive ? 1 : 0,
                $existing['id']
            ]);
        } else {
            $sql = "INSERT INTO sys_ai_settings (api_key, model_name, system_prompt, is_active) 
                    VALUES (?, ?, ?, ?)";
            $this->db->query($sql, [
                $finalApiKey,
                $modelName,
                $systemPrompt,
                $isActive ? 1 : 0
            ]);
        }
    }

    /**
     * Hastanın en son çıkarılan özetini getirir
     */
    public function getPatientLatestSummary(int $clinicId, int $patientId): ?array
    {
        $sql = "SELECT * FROM cln_patient_summaries 
                WHERE clinic_id = ? AND patient_id = ? 
                ORDER BY created_at DESC LIMIT 1";

        $result = $this->db->fetch($sql, [$clinicId, $patientId]);
        return $result ?: null;
    }

    /**
     * Hastaya ait yeni bir özet versiyonu kaydeder
     */
    public function savePatientSummary(int $clinicId, int $patientId, string $summaryText, int $lastExaminationId): void
    {
        $sql = "INSERT INTO cln_patient_summaries (clinic_id, patient_id, summary_text, last_examination_id) 
                VALUES (?, ?, ?, ?)";

        $this->db->query($sql, [
            $clinicId,
            $patientId,
            $summaryText,
            $lastExaminationId
        ]);
    }
}
