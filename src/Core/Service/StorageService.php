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
 * Tüm dosyalar 'storage/app/tenants/{clinic_id}' altında izole edilir.
 */
class StorageService
{
    private string $basePath;

    public function __construct(string $basePath = null)
    {
        // Yeni standart kök dizin: storage/app/tenants
        if ($basePath === null) {
            $this->basePath = dirname(__DIR__, 3) . '/storage/app/tenants';
        } else {
            $this->basePath = rtrim($basePath, '/');
        }

        // Kök dizin kontrolü
        if (!is_dir($this->basePath)) {
            if (!@mkdir($this->basePath, 0777, true) && !is_dir($this->basePath)) {
                // Kritik hata, ama constructor içinde throw etmek yerine 
                // metodlarda kontrol etmek daha güvenli olabilir.
            }
        }
    }

    /**
     * Genel dosya kaydetme (Geriye dönük uyumluluk için)
     * Hedef: {clinic_id}/uploads/{year}/{month}/
     */
    public function save(UploadedFileInterface $file, int $clinicId): array
    {
        $date = new \DateTime();
        $relativeDir = sprintf('%d/uploads/%s/%s', $clinicId, $date->format('Y'), $date->format('m'));
        return $this->processSave($file, $relativeDir);
    }

    /**
     * Epikriz veya resmi doküman kaydeder.
     * Hedef: {clinic_id}/documents/
     */
    public function saveDocument(int $clinicId, string $content, string $filename): string
    {
        $relativeDir = $clinicId . '/documents';
        $targetDir = $this->basePath . '/' . $relativeDir;
        $this->ensureDirectory($targetDir);

        $targetPath = $targetDir . '/' . $filename;
        if (file_put_contents($targetPath, $content) === false) {
            throw new RuntimeException('Doküman dosyası yazılamadı: ' . $targetPath);
        }

        return $relativeDir . '/' . $filename;
    }

    /**
     * Hasta dosyası kaydeder (Röntgen, tahlil vb.)
     * Hedef: {clinic_id}/uploads/patients/{patient_id}/
     */
    public function savePatientFile(UploadedFileInterface $file, int $clinicId, int $patientId): array
    {
        $relativeDir = sprintf('%d/uploads/patients/%d', $clinicId, $patientId);
        return $this->processSave($file, $relativeDir);
    }

    /**
     * Sistem dosyası kaydeder (Logo vb.)
     * Hedef: {clinic_id}/system/
     */
    public function saveSystemFile(UploadedFileInterface $file, int $clinicId, string $subType = ''): array
    {
        $relativeDir = $clinicId . '/system' . ($subType ? '/' . $subType : '');
        return $this->processSave($file, $relativeDir);
    }

    /**
     * Ortak dosya işleme mantığı
     */
    private function processSave(UploadedFileInterface $file, string $relativeDir): array
    {
        if ($file->getError() !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Dosya yükleme hatası: ' . $file->getError());
        }

        $targetDir = $this->basePath . '/' . $relativeDir;
        $this->ensureDirectory($targetDir);

        // Güvenli hash dosya adı
        $extension = pathinfo($file->getClientFilename(), PATHINFO_EXTENSION);
        $fileName = bin2hex(random_bytes(16)) . '.' . $extension;
        $targetPath = $targetDir . '/' . $fileName;

        try {
            $file->moveTo($targetPath);
        } catch (\Exception $e) {
            throw new RuntimeException('Dosya taşınamadı: ' . $e->getMessage());
        }

        return [
            'path' => $relativeDir . '/' . $fileName,
            'hash' => hash_file('sha256', $targetPath),
            'size' => (int) $file->getSize()
        ];
    }

    /**
     * Dizin varlığını kontrol eder, yoksa oluşturur.
     */
    private function ensureDirectory(string $path): void
    {
        if (is_dir($path)) {
            return;
        }

        if (!mkdir($path, 0777, true) && !is_dir($path)) {
            $error = error_get_last();
            $msg = $error ? $error['message'] : 'Bilinmeyen hata';
            throw new RuntimeException('Klasör oluşturulamadı (' . $msg . '): ' . $path);
        }

        // Umask'tan etkilenmemesi için manuel chmod
        @chmod($path, 0777);
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

        // Eğer dosya henüz yoksa (yeni oluşturulacaksa) realpath false döner.
        // Bu durumda manuel kontrol yapıyoruz.
        if ($realPath === false) {
            // Path traversal kontrolü: '..' içeriyor mu?
            if (strpos($path, '..') !== false) {
                throw new RuntimeException('Geçersiz dosya yolu (Path traversal detected).');
            }
            return $path;
        }

        // Dosya varsa, gerçek yolun base path altında olduğunu doğrula
        if (strpos($realPath, $realBase) !== 0) {
            throw new RuntimeException('Erişim engellendi: Dosya izin verilen sınırların dışında.');
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
            return false;
        }
        return false;
    }
}
