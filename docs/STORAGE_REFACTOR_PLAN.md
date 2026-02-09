# Dosya Yönetimi ve Depolama Yapısı Refaktör Planı

Bu döküman, projedeki parçalı dosya yönetimi yapısını merkezileştirmek ve multi-tenant izolasyonunu güçlendirmek için uygulanacak adımları içerir. Hedeflenen yapı, tüm klinik verilerini tek bir kök altında toplayan ve her kliniği kendi içinde organize eden standart bir dizin yapısıdır.

## 1. Hedeflenen Dizin Yapısı

Tüm dosyalar projenin kök dizinindeki `storage/app/tenants/` altında, klinik ID'si ile izole edilerek saklanacaktır:

```text
/storage
  /app
    /tenants
      /{clinic_id}              <-- KLİNİK İZOLASYON KÖKÜ
        /documents              <-- Üretilen Resmi Belgeler (Epikriz, Reçete, Onam)
             - epikriz_1050_20260209.pdf
        /uploads                <-- Kullanıcı Yüklemeleri (Dış Kaynak)
          /patients
            /{patient_id}       <-- HASTA BAZLI AYRIM
                 - rontgen_01.jpg
                 - tahlil_sonuc.pdf
          /personnel            <-- Personel Resimleri, Belgeleri
        /system                 <-- Kliniğin Logosu, Ayar Dosyaları
```

---

## 2. Uygulama Adımları (Refaktör Planı)

### Adım 1: `StorageService.php` Güncellenmesi (Merkezileştirme)
Şu anki `StorageService` sadece genel yüklemeleri yapmaktadır. Bu servis projenin tek dosya otoritesi haline getirilmelidir.

- `basePath` değişkeni varsayılan olarak `storage/app/tenants` olarak güncellenmelidir.
- Bağlamsal (context-aware) kayıt metodları eklenmelidir:
    - `saveDocument(int $clinicId, string $content, string $filename)`
    - `savePatientFile(int $clinicId, int $patientId, UploadedFileInterface $file)`
    - `saveSystemFile(int $clinicId, string $subType, UploadedFileInterface $file)`
- Path traversal koruması yeni iç içe yapıyı destekleyecek şekilde güncellenmelidir.

### Adım 2: `DocumentService.php` Refaktörü (Epikriz Modülü)
Mevcut durumda `DocumentService` kendi başına `file_put_contents` ile dosya yazmaktadır.

- `DocumentService` içindeki dosya yazma mantığı tamamen kaldırılmalıdır.
- Dosya kayıt işlemi `StorageService::saveDocument` metoduna devredilmelidir.
- Sabitlenen `storage/clinic_{id}/documents` yolu, yeni dinamik yola çekilmelidir.

### Adım 3: `FileService.php` Güncellenmesi (Upload Modülü)
Genel dosya yükleme modülünün (laboratuvar sonuçları, radyoloji vb.) yolu güncellenmelidir.

- `FileService::upload` metodu, eğer modül `patient` ise `StorageService::savePatientFile` metodunu çağırmalıdır.
- Eski yıl/ay tabanlı yapı (`2026/02/..`), hastaya ait bir klasör yapısına dönüştürülmelidir.

### Adım 4: Kamu Erişimi (Public Access) Güvenliği
Dosyalara web üzerinden erişim için:

- `public/storage` sembolik linki kontrol edilmelidir. 
- **Önemli:** Eğer `storage/app/tenants` dışarıdan doğrudan erişime açılacaksa, `system` veya hassas klasörler için `.htaccess` veya Nginx engelleri eklenmelidir.
- Tercihen, dosyalar doğrudan URL ile değil, `FileController` üzerinden yetki kontrolü yapılarak (Stream/Response) sunulmalıdır.



## 3. Güvenlik Notları

- **Dizin İzinleri:** `storage/app` dizini web sunucusu (www-data) tarafından tamamen yazılabilir (`775` veya `777`) olmalıdır.
- **İzolasyon:** `StorageService` içindeki tüm okuma/yazma işlemlerinde `clinic_id` parametresi zorunlu tutularak, bir kliniğin diğerinin dizinine erişmesi engellenmelidir.
- **Blind Index:** Dosya isimleri rastgele üretilmeye devam edilmeli (SHA-256 hash), orijinal dosya isimleri veritabanında şifreli saklanmalıdır.
