<?php

declare(strict_types=1);

namespace App\Core\Security;

class CryptoService
{
    private string $key;
    private string $method = 'aes-256-gcm';

    public function __construct(string $appKey)
    {
        // Hex key'i binary'ye çeviriyoruz
        $this->key = hex2bin($appKey);
    }

    /**
     * Veriyi şifreler (AES-256-GCM)
     */
    public function encrypt(?string $data): ?string
    {
        if (empty($data))
            return null;

        $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length($this->method));
        $tag = '';
        $encrypted = openssl_encrypt($data, $this->method, $this->key, OPENSSL_RAW_DATA, $iv, $tag);

        return base64_encode($iv . $tag . $encrypted);
    }

    /**
     * Şifreli veriyi çözer
     */
    public function decrypt(?string $encryptedData): ?string
    {
        if (empty($encryptedData))
            return null;

        $decoded = base64_decode($encryptedData);
        $ivLength = openssl_cipher_iv_length($this->method);
        $iv = substr($decoded, 0, $ivLength);
        $tag = substr($decoded, $ivLength, 16);
        $ciphertext = substr($decoded, $ivLength + 16);

        $result = openssl_decrypt($ciphertext, $this->method, $this->key, OPENSSL_RAW_DATA, $iv, $tag);
        return $result === false ? null : $result;
    }

    /**
     * Veriyi şifreler (AES-256-GCM) - Null güvenli
     */
    public function encryptSafe(?string $data): ?string
    {
        return $this->encrypt($data);
    }

    /**
     * Arama için kör dizin (Blind Index) oluşturur
     */
    public function blindIndex(?string $data): ?string
    {
        if (empty($data))
            return null;
        return hash_hmac('sha256', $data, $this->key);
    }
}
