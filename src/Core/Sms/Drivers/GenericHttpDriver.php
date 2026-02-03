<?php

declare(strict_types=1);

namespace App\Core\Sms\Drivers;

use App\Core\Sms\SmsDriverInterface;
use RuntimeException;

/**
 * Generic HTTP SMS Driver
 * 
 * Herhangi bir HTTP API'ye (REST/GET/POST) uyum sağlayabilen esnek sürücü.
 * Konfigürasyon içinde URL, Method, Headerlar ve Body şablonu verilir.
 * Şablon içindeki {{phone}} ve {{message}} placeholder'ları gerçek verilerle değiştirilir.
 */
class GenericHttpDriver implements SmsDriverInterface
{
    public function send(string $phone, string $message, array $config): bool
    {
        /*
         * Config Beklentisi:
         * url: "https://api.example.com/v1/sms"
         * method: "POST"
         * headers: "Authorization: Bearer {{api_key}}\nContent-Type: application/json"
         * body_template: "{\"to\": \"{{phone}}\", \"text\": \"{{message}}\", \"sender\": \"{{sender_name}}\"}"
         * ... ve diğer dinamik değişkenler
         */

        if (empty($config['url']) || empty($config['method'])) {
            throw new RuntimeException("Generic Driver: URL and Method required");
        }

        $url = $config['url'];
        $method = strtoupper($config['method']);
        $bodyTemplate = $config['body_template'] ?? '';
        $headersTemplate = $config['headers'] ?? '';

        // Template Değişkenlerini Hazırla
        // Standart değişkenler
        $vars = [
            '{{phone}}' => $phone,
            '{{message}}' => $message,
            // JSON karakterlerini escape et (eğer JSON içindeyse)
            '{{message_json}}' => json_encode($message, JSON_UNESCAPED_UNICODE), // Tırnak işaretli gelir: "Mesaj"
            '{{message_esc}}' => trim(json_encode($message, JSON_UNESCAPED_UNICODE), '"') // Tırnaksız escape edilmiş
        ];

        // Config içindeki diğer anahtarları da değişken olarak ekle (örn: username, password)
        foreach ($config as $k => $v) {
            if (is_string($v) || is_numeric($v)) {
                $vars['{{' . $k . '}}'] = $v;
            }
        }

        // 1. URL Replace
        $finalUrl = strtr($url, $vars);

        // 2. Headers Hazırla
        $finalHeadersRaw = strtr($headersTemplate, $vars);
        $headers = [];
        foreach (explode("\n", $finalHeadersRaw) as $line) {
            $line = trim($line);
            if (!empty($line)) {
                $headers[] = $line;
            }
        }

        // 3. Body/Payload Hazırla
        // Eğer metod GET ise body olmaz, query string olur (URL'de halledilmeli)
        // Eğer POST/PUT ise body template işlenir.
        $finalBody = '';
        if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
            $finalBody = strtr($bodyTemplate, $vars);
        }

        // 4. İsteği Gönder (cURL)
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $finalUrl);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        if (!empty($headers)) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        }

        if (!empty($finalBody)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $finalBody);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new RuntimeException("Generic HTTP Error: " . $error);
        }

        if ($httpCode >= 200 && $httpCode < 300) {
            return true;
        }

        throw new RuntimeException("API returned HTTP $httpCode: " . substr($response, 0, 100));
    }
}
