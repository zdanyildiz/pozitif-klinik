<?php

declare(strict_types=1);

namespace App\Core\Service;

use Psr\Http\Message\UploadedFileInterface;
use RuntimeException;
use InvalidArgumentException;

/**
 * StorageService
 * 
 * Fiziksel dosya sistemi işlemlerini yönetir.
 * Dosyaları proje kök dizinindeki 'var/uploads' klasörüne kaydeder.
 * Yıl/Ay tabanlı klasör yapısı kullanır.
 */
class StorageService
{
    private string $basePath;

    public function __construct(string $basePath = null)
    {
        // Sabit olarak var/uploads kullanıyoruz, harici verilmezse
        if ($basePath === null) {
            $this->basePath = dirname(__DIR__, 3) . '/var/uploads';
        } else {
            $this->basePath = rtrim($basePath, '/');
        }
    }

    /**
     * Dosyayı diske kaydeder.
     * 
     * @param UploadedFileInterface $file
     * @param int $clinicId
     * @return array {path: string, hash: string, size: int}
     * @throws RuntimeException
     */
    public function save(UploadedFileInterface $file, int $clinicId): array
    {
        if ($file->getError() !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Dosya yükleme hatası: ' . $file->getError());
        }

        $date = new \DateTime();
        $year = $date->format('Y');
        $month = $date->format('m');

        // Hedef dizin: var/uploads/{clinic_id}/{year}/{month}/
        $relativeDir = sprintf('%d/%s/%s', $clinicId, $year, $month);
        $targetDir = $this->basePath . '/' . $relativeDir;

        if (!is_dir($targetDir)) {
            if (!mkdir($targetDir, 0755, true)) {
                throw new RuntimeException('Klasör oluşturulamadı: ' . $targetDir);
            }
        }

        // Dosya adı için güvenli hash üret (rastgele bytes)
        $extension = pathinfo($file->getClientFilename(), PATHINFO_EXTENSION);
        $randomName = bin2hex(random_bytes(16)); // 32 chars
        $fileName = $randomName . '.' . $extension; // hash.pdf

        // Tam yol
        $targetPath = $targetDir . '/' . $fileName;

        // Dosyayı taşı (Slim/PSR-7 moveTo)
        try {
            $file->moveTo($targetPath);
        } catch (\Exception $e) {
            throw new RuntimeException('Dosya taşınamadı: ' . $e->getMessage());
        }

        // Dosya bütünlüğü için hash al (SHA-256)
        $fileHash = hash_file('sha256', $targetPath);
        $size = (int) $file->getSize();

        return [
            'path' => $relativeDir . '/' . $fileName, // DB'ye sadece relative path (1/2026/01/xyz.pdf)
            'hash' => $fileHash,
            'size' => $size
        ];
    }

    /**
     * Dosyayı okumak için tam yolu döndürür.
     */
    public function getAbsolutePath(string $relativePath): string
    {
        $path = $this->basePath . '/' . $relativePath;

        // Path traversal koruması
        $realBase = realpath($this->basePath);
        $realPath = realpath($path);

        if ($realPath === false || strpos($realPath, $realBase) !== 0) {
            // Dosya yoksa bile güvenlik için kontrol etmeliyiz
            // Eğer dosya yoksa realpath false döner.
            // Dosya varlığını kontrol et:
            if (!file_exists($path)) {
                throw new RuntimeException('Dosya bulunamadı: ' . $relativePath);
            }
            // Realpath check tekrar (file_exists true ise)
            $realPath = realpath($path);
            if (strpos($realPath, $realBase) !== 0) {
                throw new RuntimeException('Geçersiz dosya yolu (Path traversal detected).');
            }
            return $realPath;
        }

        return $realPath;
    }

    /**
     * Dosyayı siler.
     */
    public function delete(string $relativePath): bool
    {
        try {
            $path = $this->getAbsolutePath($relativePath);
            if (file_exists($path)) {
                return unlink($path);
            }
        } catch (\Exception $e) {
            // Dosya zaten yoksa veya path hatalıysa false dönmesi yeterli olabilir
            // ama loglamak iyi olurdu. Şimdilik false dönüyoruz.
            return false;
        }
        return false;
    }
}
