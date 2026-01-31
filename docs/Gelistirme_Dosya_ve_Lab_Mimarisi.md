# Geliştirme Görevi: Dosya Depolama ve Laboratuvar Modülü Mimarisi

Bu doküman, çoklu klinik (SaaS) yapısına uygun **Dosya Depolama** ve **Laboratuvar (Test) Modülü** için mimari kararları ve uygulama planını içerir.

## 1. Dosya Depolama Mimarisi (Storage Architecture)

Sistemin performansını korumak ve veritabanı şişkinliğini önlemek amacıyla, binary dosyalar (PDF, JPG, vb.) veritabanında **tutulmayacaktır**.

### 1.1. Fiziksel Depolama Stratejisi
*   **Konum:** Dosyalar, web sunucusunun `public` dizini **dışında**, güvenli bir dizinde saklanacaktır (Örn: `/app/uploads`).
*   **Dizin Yapısı:** Her klinik ve zaman dilimi için izole edilmiş bir yapı kullanılacaktır:
    ```
    /app/uploads/
      └── {clinic_id}/           # Her kliniğin kendi klasörü
          └── {year}/            # Yıl bazlı arşivleme (yedekleme ve inode limiti için)
              └── {month}/       # (Opsiyonel) Ay bazlı
                  └── {hash}.ext # Dosya adı
    ```
*   **Dosya İsimlendirme:** Güvenlik ve uyumluluk için orijinal dosya isimleri değiştirilecektir.
    *   **Orijinal:** `Tahlil Sonucu (Ahmet).pdf`
    *   **Saklanan:** `a1b2c3d4e5...f9.pdf` (SHA-256 veya UUID)
    *   Bu yöntem Türkçe karakter sorunlarını, dosya sistemi kısıtlamalarını ve güvenlik açıklarını önler.

### 1.2. Veritabanı Yapısı
Dosyaların metadataları veritabanında tutulacaktır.

**Tablo: `sys_files`** (veya `cln_files`)
*   `id` (PK)
*   `clinic_id` (FK) - Hangi kliniğe ait olduğu
*   `module` (string) - 'patient', 'lab', 'invoice' vb.
*   `related_id` (int) - Bağlı olduğu kayıt ID'si (Örn: Randevu ID)
*   `original_name` (string) - "Kan Tahlili.pdf" (Kullanıcıya gösterilecek isim)
*   `file_path` (string) - "1/2025/a1b2...f9.pdf" (Disk yolu)
*   `mime_type` (string) - "application/pdf"
*   `size_kb` (int)
*   `created_at` (datetime)
*   `created_by` (user_id)

### 1.3. Güvenli Erişim (Secure File Access)
Dosyalar `public` klasöründe olmadığı için doğrudan URL ile (örn: `site.com/uploads/dosya.pdf`) erişilemez.
Erişim bir **Proxy Controller** üzerinden sağlanacaktır:

1.  **İstek:** Kullanıcı `/api/files/view/{file_id}` adresine istek atar.
2.  **Yetkilendirme:** Backend, kullanıcının o dosyayı görmeye yetkili olup olmadığını (Clinic ID eşleşmesi, Rol kontrolü) denetler.
3.  **Sunum:** Yetki varsa, dosya `readStream` ile okunup, doğru `Content-Type` header'ı ile tarayıcıya "stream" edilir.

---

## 2. Esnek Laboratuvar Modülü Mimarisi

Kliniklerin farklı çalışma prensiplerine (sadece sonuç belgesi yükleyenler vs. detaylı veri girenler) uyum sağlamak için **Hibrit Yapı** kullanılacaktır.

### 2.1. Desteklenen Modeller
Klinik, bir laboratuvar isteği oluşturduğunda iki şekilde sonuçlandırabilir:

*   **Model A: Dosya Bazlı (Basitleştirilmiş)**
    *   Kullanıcı laboratuvar/test kaydını açar.
    *   Sonuçları tek tek sisteme girmez.
    *   Laboratuvardan gelen PDF raporunu "Sonuç Dosyası" olarak ekler.
    *   İşlem durumu "Tamamlandı" olur.
    *   *Kullanım:* Küçük klinikler veya entegrasyonu olmayan dış laboratuvarlar için.

*   **Model B: Yapısal Veri (Detaylı)**
    *   Kullanıcı, tanımlı test parametreleri (Örn: Glukoz, Demir) için sayısal değerleri girer.
    *   Sistem, referans aralıklarına göre (Düşük/Yüksek) otomatik işaretleme yapar.
    *   Geçmişe dönük grafik (Trend analizi) oluşturulabilir.
    *   *Kullanım:* Kendi laboratuvarı olan veya detaylı hasta takibi yapan klinikler.

### 2.2. Veritabanı Şeması (Taslak)

**Tablo: `cln_lab_requests` (İstemler)**
*   `id`, `clinic_id`, `patient_id`, `doctor_id`
*   `request_date`, `status` (pending, completed, cancelled)

**Tablo: `cln_lab_results` (Sonuç Başlığı)**
*   `id`, `request_id`
*   `test_name` (Örn: Biyokimya)
*   `report_file_id` (FK -> sys_files) - **(Model A için)** PDF dosyası buraya bağlanır.

**Tablo: `cln_lab_result_items` (Sonuç Detayları - Model B)**
*   `id`, `result_id`
*   `parameter_name` (Örn: Glukoz)
*   `value` (90)
*   `unit` (mg/dL)
*   `reference_range` (70-100)
*   `is_abnormal` (boolean)

---

## 3. Migration Stratejisi ve Sonuçları (Güncelleme: 31.01.2026)

Eski MSSQL sistemindeki verilerin bu yeni yapıya aktarılması süreci tamamlanmıştır:

1.  **BLOB (Binary) Veriler:**
    *   `HST_LAB_RAPOR` ve `HST_TIBBI_DOSYALAR` tabloları incelenmiş, içerisinde **0 (sıfır)** kayıt bulunmuştur.
    *   Bu nedenle herhangi bir PDF/JPG dosyası aktarımı **yapılmamıştır/gerekmemiştir**.

2.  **Yapısal Sonuçların Aktarımı (TAMAMLANDI):**
    *   `HST_LAB_BIYOKIMYA` tablosunda yaklaşık 800+ sayısal veri tespit edilmiştir.
    *   Bu veriler `scripts/migrate_lab_data.js` aracı ile yeni `cln_lab_results` ve `cln_lab_result_items` tablolarına başarıyla aktarılmıştır.
    *   Eski sistemdeki "referans aralıkları" ve "anormallik" durumları korunmuştur.
