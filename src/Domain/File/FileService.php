<?php

declare(strict_types=1);

namespace App\Domain\File;

use App\Core\Service\StorageService;
use Psr\Http\Message\UploadedFileInterface;
use Ramsey\Uuid\Uuid;

use App\Core\Security\CryptoService;

/**
 * FileService
 * 
 * Dosya yükleme, silme ve erişim iş mantığı.
 */
class FileService
{
    private StorageService $storage;
    private FileRepository $repository;
    private CryptoService $crypto;

    public function __construct(
        StorageService $storage,
        FileRepository $repository,
        CryptoService $crypto
    ) {
        $this->storage = $storage;
        $this->repository = $repository;
        $this->crypto = $crypto;
    }

    /**
     * Dosya yükleme işlemi (Atomik olmaya çalışır).
     * 
     * @param UploadedFileInterface $file Webden gelen dosya
     * @param int $clinicId Klinik ID
     * @param string $module Modül adı (patient, lab, vb)
     * @param int $relatedId İlgili kayıt ID
     * @param int|null $userId Yükleyen kullanıcı
     * @return array Kaydedilen dosya bilgisi
     */
    public function upload(
        UploadedFileInterface $file,
        int $clinicId,
        string $module,
        int $relatedId,
        ?int $userId,
        ?string $displayName = null,
        string $fileCategory = 'other'
    ): array {
        // 1. Fiziksel Kayıt
        $storageResult = $this->storage->save($file, $clinicId);

        // 2. Veritabanı Hazırlığı
        $fileData = [
            'clinic_id' => $clinicId,
            'module' => $module,
            'related_id' => $relatedId,
            'original_name' => $file->getClientFilename(),
            'display_name' => $displayName,
            'file_category' => $fileCategory,
            'storage_path' => $storageResult['path'],
            'file_hash' => $storageResult['hash'],
            'mime_type' => $file->getClientMediaType(),
            'size_kb' => (int) round($storageResult['size'] / 1024),
            'uuid' => Uuid::uuid4()->toString(),
            'created_by' => $userId
        ];

        // 3. Veritabanına Yaz
        try {
            $id = $this->repository->create($fileData);
            $fileData['id'] = $id;
            return $fileData;
        } catch (\Exception $e) {
            // DB hatası olursa fiziksel dosyayı temizle (Rollback benzeri)
            $this->storage->delete($storageResult['path']);
            throw $e;
        }
    }

    /**
     * Dosya listesi döndürür.
     */
    public function listFiles(int $clinicId, string $module, int $relatedId): array
    {
        return $this->repository->getByRelatedId($clinicId, $module, $relatedId);
    }

    /**
     * Okuma/İndirme için dosya fiziksel yolunu ve bilgilerini döner.
     */
    public function getFileForView(int $clinicId, string $uuid): array
    {
        $file = $this->repository->findByUuid($clinicId, $uuid);
        if (!$file) {
            throw new \RuntimeException('Dosya bulunamadı.');
        }

        $absolutePath = $this->storage->getAbsolutePath($file['storage_path']);

        return [
            'meta' => $file,
            'path' => $absolutePath
        ];
    }

    /**
     * Dosya silme (Soft delete).
     * Not: Fiziksel dosya hemen silinmez, yasal saklama süreleri gerekebilir.
     * Sadece DB'den deleted_at işaretlenir.
     */
    public function delete(int $clinicId, string $uuid, ?int $userId): bool
    {
        $file = $this->repository->findByUuid($clinicId, $uuid);
        if (!$file) {
            return false;
        }

        return $this->repository->softDelete($clinicId, $uuid, $userId);
    }
    /**
     * Dosyaları arar.
     */
    public function searchFiles(int $clinicId, array $filters): array
    {
        $files = $this->repository->searchFiles($clinicId, $filters);

        foreach ($files as &$file) {
            if (!empty($file['patient_name'])) {
                $file['patient_name'] = $this->crypto->decrypt($file['patient_name']) ?? $file['patient_name'];
            }
        }

        return $files;
    }
}
