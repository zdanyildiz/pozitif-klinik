<?php

declare(strict_types=1);

namespace App\Core\Security;

class CryptoService
{
    private string $key;
    private string $blindIndexKey;
    private string $method = 'aes-256-gcm';

    public function __construct(string $appKey, string $blindIndexKey)
    {
        // Hex keyleri binary'ye çeviriyoruz
        $this->key = hex2bin($appKey);
        $this->blindIndexKey = hex2bin($blindIndexKey);
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
     * Arama metnini normalize eder (Türkçe karakter dönüşümü + küçük harf)
     * Örn: "İSTANBUL" -> "istanbul", "AĞRI" -> "agri" (veya tr karakter korunarak)
     */
    public function normalize(string $text): string
    {
        // 1. Türkçe Karakter Dönüşümü (Büyük -> Küçük)
        // mb_strtolower Türkçe karakterleri bazen doğru dürüst çeviremeyebilir (environment locale bağlı)
        // Bu yüzden manuel bir map daha güvenlidir.
        $search = ['KI', 'kI', 'İ', 'I', 'Ğ', 'Ü', 'Ş', 'Ö', 'Ç'];
        $replace = ['ki', 'ki', 'i', 'ı', 'ğ', 'ü', 'ş', 'ö', 'ç'];
        $text = str_replace($search, $replace, $text);

        // 2. Standart lowercase ve trim
        return trim(mb_strtolower($text, 'UTF-8'));
    }

    /**
     * Arama için güvenli ve normalize edilmiş kör dizin (Blind Index) oluşturur.
     * Bu hash ASLA geri döndürülemez ve şifreleme anahtarından farklı bir anahtar kullanır.
     */
    public function blindIndex(?string $data): ?string
    {
        if (empty($data)) {
            return null;
        }
        
        // Önce normalize et
        $normalized = $this->normalize($data);
        
        // Sonra HMAC ile hashle
        return hash_hmac('sha256', $normalized, $this->blindIndexKey);
    }
}
