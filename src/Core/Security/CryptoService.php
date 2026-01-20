<?php

declare(strict_types=1);

namespace App\Core\Security;

use RuntimeException;

/**
 * CryptoService - AES-256-GCM Şifreleme Servisi
 * 
 * Hassas hasta verilerinin (TC, Telefon, Email, Adres) veritabanında
 * güvenli bir şekilde saklanmasını sağlar.
 * 
 * Çıktı formatı: base64(iv . tag . ciphertext)
 * 
 * @package App\Core\Security
 */
class CryptoService
{
    private const CIPHER_ALGO = 'aes-256-gcm';
    private const IV_LENGTH = 12; // GCM için önerilen IV uzunluğu
    private const TAG_LENGTH = 16;

    private string $key;
    private string $hmacKey;

    /**
     * @param string $appKey 32-byte hex encoded key (64 karakterlik hex string)
     * @throws RuntimeException Geçersiz anahtar uzunluğunda
     */
    public function __construct(string $appKey)
    {
        if (strlen($appKey) !== 64) {
            throw new RuntimeException(
                'APP_KEY 64 karakterlik hex string olmalıdır (32 byte). ' .
                'Mevcut uzunluk: ' . strlen($appKey)
            );
        }

        // Hex string'i binary'ye çevir
        $this->key = hex2bin($appKey);

        if ($this->key === false || strlen($this->key) !== 32) {
            throw new RuntimeException('APP_KEY geçerli bir hex string değil.');
        }

        // HMAC için ayrı bir anahtar türet (blind index için)
        $this->hmacKey = hash('sha256', $this->key . '_hmac_blind_index', true);
    }

    /**
     * Veriyi AES-256-GCM ile şifrele
     * 
     * @param string $plaintext Şifrelenecek düz metin
     * @return string base64 encoded (iv + tag + ciphertext)
     * @throws RuntimeException Şifreleme hatası
     */
    public function encrypt(string $plaintext): string
    {
        // Rastgele IV oluştur
        $iv = random_bytes(self::IV_LENGTH);

        // GCM tag referansı
        $tag = '';

        // Şifrele
        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER_ALGO,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '', // AAD (Additional Authenticated Data) - boş
            self::TAG_LENGTH
        );

        if ($ciphertext === false) {
            throw new RuntimeException('Şifreleme başarısız: ' . openssl_error_string());
        }

        // IV + Tag + Ciphertext birleştir ve base64 encode et
        return base64_encode($iv . $tag . $ciphertext);
    }

    /**
     * Şifreli veriyi çöz
     * 
     * @param string $ciphertext base64 encoded şifreli veri
     * @return string|null Çözülmüş düz metin veya başarısız ise null
     */
    public function decrypt(string $ciphertext): ?string
    {
        // Boş veya null değerleri kontrol et
        if (empty($ciphertext)) {
            return null;
        }

        // Base64 decode
        $data = base64_decode($ciphertext, true);

        if ($data === false) {
            return null; // Geçersiz base64
        }

        // Minimum uzunluk kontrolü (IV + Tag + en az 1 byte ciphertext)
        $minLength = self::IV_LENGTH + self::TAG_LENGTH + 1;
        if (strlen($data) < $minLength) {
            return null;
        }

        // Parçaları ayır
        $iv = substr($data, 0, self::IV_LENGTH);
        $tag = substr($data, self::IV_LENGTH, self::TAG_LENGTH);
        $encrypted = substr($data, self::IV_LENGTH + self::TAG_LENGTH);

        // Çöz
        $decrypted = openssl_decrypt(
            $encrypted,
            self::CIPHER_ALGO,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($decrypted === false) {
            // Çözme başarısız - muhtemelen veri bozuk veya yanlış anahtar
            return null;
        }

        return $decrypted;
    }

    /**
     * Blind Index oluştur (arama için)
     * 
     * Şifreli verilerde arama yapabilmek için HMAC-SHA256 hash kullanır.
     * Bu hash, şifreli verinin yanına kaydedilir ve WHERE sorgularında kullanılır.
     * 
     * @param string $value Hash'lenecek değer (örn: TC Kimlik)
     * @return string 64 karakterlik hex hash
     */
    public function blindIndex(string $value): string
    {
        // Değeri normalize et (boşlukları kaldır, küçük harfe çevir)
        $normalized = strtolower(trim($value));

        // HMAC-SHA256 ile hash oluştur
        return hash_hmac('sha256', $normalized, $this->hmacKey);
    }

    /**
     * Veriyi güvenli bir şekilde şifrele (null kontrollü)
     * 
     * @param string|null $value Şifrelenecek değer
     * @return string|null Şifreli değer veya null
     */
    public function encryptSafe(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        return $this->encrypt($value);
    }

    /**
     * Veriyi güvenli bir şekilde çöz (null kontrollü)
     * 
     * @param string|null $value Çözülecek şifreli değer
     * @return string|null Çözülmüş değer veya null
     */
    public function decryptSafe(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        return $this->decrypt($value);
    }
}
