# Laboratuvar Veri Girişi Geliştirme Planı

Bu döküman, mevcut laboratuvar modülüne manuel veri girişi (yeni laboratuvar sonucu ekleme) özelliğinin eklenmesi için gereken adımları kapsar.

## 1. Veritabanı Katmanı (Repository)
Mevcut `LabRepository.php` dosyasına veri yazma metodları eklenecek.

- **`createResult(array $data): int`**: `cln_lab_results` tablosuna ana kayıt (üst bilgi) ekler.
- **`createResultItem(int $resultId, array $item): bool`**: `cln_lab_result_items` tablosuna test kalemlerini ekler.
- **`deleteResult(int $resultId): bool`**: Yanlış girilen kayıtların silinmesi için.

## 2. API Katmanı (Backend)
Yeni bir `LabController.php` oluşturulacak (Domain API).

- **`POST /api/lab`**: 
    - **Payload:** 
    ```json
    {
      "patient_id": 14376,
      "appointment_id": 75353, // Opsiyonel
      "result_date": "2026-02-02",
      "doctor_id": 2,
      "items": [
        {
          "test_name": "Glikoz",
          "result_value": "110",
          "unit": "mg/dL",
          "reference_range": "70-100",
          "is_abnormal": true
        }
      ]
    }
    ```
- **Yetkilendirme:** Sadece doktor ve admin rollerine izin verilecek.

## 3. Web Katmanı (Frontend/UI)

### A. Hasta Detay Sayfası (`patient_detail.twig`)
- "Laboratuvar" sekmesine **"Yeni Sonuç Ekle"** butonu eklenecek.
- Bu butona basıldığında bir Modal (`labEntryModal`) açılacak.

### B. Veri Giriş Modalı
- **Başlık Bilgileri:** Tarih, İsteyen Doktor, İlişkili Randevu (seçimli).
- **Dinamik Test Satırları:** 
    - Kullanıcı "Satır Ekle" diyerek sınırsız test kalemi girebilecek.
    - Test adı, sonuç, birim, referans aralığı alanları olacak.
    - "Anormal/Yüksek" durumu için switch/checkbox.
- **Hazır Şablonlar (Gelecek Özellik):** "Tam Kan Sayımı", "Biyokimya Paneli" gibi sık kullanılan test grupları tek tıkla boş satırlar olarak yüklenebilecek.

## 4. İş Akışı (Logic)
1. Kullanıcı hasta detayından formu açar.
2. Test verilerini girer.
3. "Kaydet" dediğinde API önce ana kaydı oluşturur, dönen `id` ile tüm kalemleri topluca veritabanına yazar.
4. Kayıt başarılıysa "Laboratuvar" sekmesi yenilenerek yeni sonuç listede en üstte görünür.

## 5. Uygulama Adımları
1. **Adım 1:** `LabRepository` metodlarının yazılması.
2. **Adım 2:** API Controller ve Rota tanımlamalarının yapılması.
3. **Adım 3:** Twig tarafında Modal arayüzünün kodlanması.
4. **Adım 4:** Dinamik satır ekleme/silme sağlayan JS mantığının (`lab-entry.js`) yazılması.
5. **Adım 5:** Test ve validasyon süreci.

## 6. Faz 2: Akıllı Veri Girişi ve Otomasyon (Gelecek Görevler)

Laboratuvar modülünün kullanım kolaylığını ve veri kalitesini artırmak için aşağıdaki özellikler eklenecektir:

### A. Merkezi Test Kütüphanesi (`sys_lab_test_definitions`)
- **İşlev:** Test adlarının, birimlerinin ve referans aralıklarının merkezi olarak yönetilmesi.
- **Yönetilebilirlik:** Sistem admini tarafından genel tanımlar yapılır, klinikler kendi birim ve referans aralıklarını özelleştirebilir.
- **Frontend Entegrasyonu:** Test adı alanına TomSelect/Autocomplete eklenerek kullanıcının seçtiği teste göre **birim** ve **referans aralığının** otomatik dolması sağlanır.

### B. Hazır Test Panelleri (Template Sistemi)
- **Kapsam:** "Tam Kan Sayımı", "Biyokimya Paneli", "Check-up Paketi" gibi sık kullanılan gruplar.
- **UX:** Modal üzerinden panel seçildiğinde, teste ait tüm satırların başlık ve birimleri asenkron olarak otomatik yüklenir.

### C. Otomatik Anomali Kontrolü (Smart Validation)
- Kullanıcı sonuç değerini girdiğinde, tanımlı referans aralığı ile karşılaştırılarak "Anormal" switch'inin JavaScript tarafından otomatik aktif edilmesi.

### D. Grafiksel Trend Analizi
- Aynı testin (örn: Glikoz) zaman içindeki değişimini gösteren Sparkline grafiklerin sonuç listesine eklenmesi.

---

## 7. Gereksinim Analizi: Legacy Veritabanı Eşleşmeleri

Faz 2 geliştirmeleri için MSSQL `ErhanOzel` veritabanında yapılan analiz sonucunda aşağıdaki tablo yapıları ve veriler tespit edilmiştir. Aktarım ve yeni şema tasarımı bu yapı üzerine kurulacaktır:

### A. Tespit Edilen Legacy Tablolar

| Legacy Tablo Adı | Yeni Sistemdeki Karşılığı / Görevi | Önemli Alanlar |
| :--- | :--- | :--- |
| **`Lab_TestGrubu`** | `cln_lab_test_panels` (Şablon İsimleri) | `ID`, `GrupAdi`, `Sira` |
| **`Lab_TestGrubu_Test`** | `cln_lab_panel_items` (Şablon İçeriği) | `GrupID`, `TetkikKodu` |
| **`LAB_TESTLER`** | `sys_lab_test_definitions` (Test Tanımları) | `TESTKODU`, `ACIKLAMA`, `LoincKodu`, `DEGERTURU` |
| **`LAB_TESTNORMALLERI`** | `sys_lab_test_normals` (Referans & Birim) | `TESTKODU`, `BIRIM`, `NORMAL_ALT`, `NORMAL_UST`, `CINSIYET` |
| **`TETKIK`** | Hizmet Kataloğu Referansı | `KOD`, `ACIKLAMA`, `FIYAT` |

### B. Uygulama Notları

1.  **Şablon Yapısı:** MSSQL tarafında 11 ana grup (Biyokimya, Hematoloji, İdrar vb.) ve bunlara bağlı 468+ test eşleşmesi hazır durumdadır.
2.  **Referans Aralığı Akıllılığı:** `LAB_TESTNORMALLERI` tablosundaki yaş ve cinsiyet bazlı referans değerleri, Faz 2-C'deki "Otomatik Anomali Kontrolü" için girdi sağlayacaktır.
3.  **Birim Standardizasyonu:** Testlerin birimleri (mg/dL, %, g/L vb.) legacy veriden alınarak manuel giriş sırasında "Birim" alanının otomatik dolması sağlanacaktır.

