<?php

declare(strict_types=1);

namespace App\Core\Sms;

interface SmsDriverInterface
{
    /**
     * SMS Gönderimi Yapar
     * 
     * @param string $phone Alıcı tel no (Örn: 5321234567)
     * @param string $message Mesaj içeriği
     * @param array $config Driver konfigürasyonu
     * @return bool
     * @throws \Exception
     */
    public function send(string $phone, string $message, array $config): bool;
}
