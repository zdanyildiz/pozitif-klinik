# Dosya Modülü Geliştirme Planı

Bu belge, `docs/Gelistirme_Dosya_ve_Lab_Mimarisi.md` dosyasında belirtilen mimari kararlara uygun olarak, Dosya Depolama Modülü'nün geliştirilmesi için izlenecek adım adım planı içerir.

## 📅 Aşama 1: Veritabanı Katmanı (Database Layer)

Dosyaların metadata bilgilerini tutacak veritabanı şemasının oluşturulması.

### Adım 1.1: `sys_files` Tablosu
- **Hedef:** Dosya bilgilerini (ad, yol, boyut, tip vb.) tutacak SQL tablosunu oluşturmak.
- **İşlem:** `database/sql` (veya uygun dizin) altına yeni bir SQL dosyası eklenmesi ve çalıştırılması.
- **Tablo Şeması:**
    - `id` (BIGINT, PK, AUTO_INCREMENT)
    - `clinic_id` (INT) - Multi-tenancy için.
    - `module` (VARCHAR 50) - 'patient', 'lab', 'invoice' vb.
    - `related_id` (BIGINT) - Bağlı olduğu kayıt ID'si.
    - `original_name` (VARCHAR 255) - Kullanıcının gördüğü isim.
    - `storage_path` (VARCHAR 255) - Disk üzerindeki fiziksel yol (Hash'lenmiş).
    - `file_hash` (VARCHAR 64) - SHA-256 hash (Bütünlük kontrolü).
    - `mime_type` (VARCHAR 100)
    - `size_kb` (INT)
    - `uuid` (CHAR 36) - Public API erişimi için güvenli ID.
    - `created_at` (DATETIME)
    - `created_by` (INT)
    - `deleted_at` (DATETIME, NULLABLE) - Soft delete.

## ⚙️ Aşama 2: Backend Core & Domain (Servis Katmanı) ✅

Dosya sistemi ve veritabanı işlemlerini yönetecek servislerin geliştirilmesi.

### Adım 2.1: `StorageService` (Core) ✅
- **Konum:** `src/Core/Services/StorageService.php`
- **Görev:** Fiziksel dosya işlemleri (Kaydetme, Okuma, Silme).
- **Kurallar:**
    - Dosyalar `/app/uploads/{clinic_id}/{Yil}/{Ay}/` dizinine kaydedilecek.
    - Dosya adları rastgele (UUID/Hash) oluşturulacak.

### Adım 2.2: `FileRepository` (Domain) ✅
- **Konum:** `src/Domain/File/FileRepository.php`
- **Görev:** `sys_files` tablosu ile veritabanı işlemleri.
- **Metodlar:** `create`, `findById`, `getByModule`, `softDelete`.

### Adım 2.3: `FileService` (Domain Logic) ✅
- **Konum:** `src/Domain/File/FileService.php`
- **Görev:** Upload sürecini yönetmek (Önce diske kaydet, başarılıysa DB'ye yaz).

## 🔌 Aşama 3: API Geliştirme (Controllers) ✅

Frontend ve mobil uygulamalar için API uçlarının oluşturulması.

### Adım 3.1: `FileController` ✅
- **Konum:** `src/Domain/File/FileController.php`
- **Endpoints:**
    - `POST /api/files/upload`: Dosya yükleme.
    - `GET /api/files/view/{uuid}`: Güvenli dosya görüntüleme (Proxy).
    - `GET /api/files/list/{module}/{relatedId}`: Dosya listesi.
    - `DELETE /api/files/{uuid}`: Dosya silme.

## 🖥️ Aşama 4: Frontend Entegrasyonu ✅

### Adım 4.1: Dosya Yükleme ve Listeleme Arayüzü ✅
- **Teknoloji:** Vanilla JS + Twig.
- **Görev:**
    - Dosya yükleme butonu/alanı.
    - Yüklenen dosyaların listelenmesi.
    - Önizleme ve silme butonları.
    - `src/Views/components/file_manager.twig` componenti oluşturuldu.
    - `public/assets/js/file-manager.js` dosyası oluşturuldu.

## 🧪 Aşama 5: Test ve Doğrulama
- Farklı klinikler arası izolasyon testi.
- Yetkisiz erişim testi.
- Dosya yükleme/silme senaryoları.
