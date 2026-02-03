<?php

declare(strict_types=1);

namespace App\Core\Sms\Drivers;

use App\Core\Sms\SmsDriverInterface;
use RuntimeException;

/**
 * Netgsm API Driver
 * Dokümantasyon: https://www.netgsm.com.tr/dokuman/
 */
class NetgsmDriver implements SmsDriverInterface
{
    private const API_URL = 'https://api.netgsm.com.tr/sms/send/get';

    public function send(string $phone, string $message, array $config): bool
    {
        // Zorunlu alan kontrolü
        if (empty($config['username']) || empty($config['password']) || empty($config['header'])) {
            throw new RuntimeException("NetGSM config missing (username, password, header)");
        }

        // GET isteği oluştur (NetGSM GET servisi örneği)
        // message URL Encode edilmeli
        $params = [
            'usercode' => $config['username'],
            'password' => $config['password'],
            'gsmno' => $phone,
            'message' => $message,
            'msgheader' => $config['header']
        ];

        // cURL ile istek at
        $ch = curl_init();
        $queryString = http_build_query($params);
        curl_setopt($ch, CURLOPT_URL, self::API_URL . '?' . $queryString);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new RuntimeException("NetGSM Connection Error: " . $error);
        }

        // NetGSM Başarılı yanıtları genelde "00 123456" gibi ID ile döner.
        // Hatalar: 20, 30, 40, 70 gibi kodlar.

        // Basit kontrol: İlk karakterler sayısal ID ise başarılıdır.
        // Örn: "00 37623623" -> Başarılı (00: Hatasız)

        $response = trim($response);
        if (str_starts_with($response, '00')) {
            return true;
        }

        // Hata kodları için map yapılabilir
        throw new RuntimeException("NetGSM API Error: " . $response);
    }
}
