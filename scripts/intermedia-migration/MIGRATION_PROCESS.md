# Intermedia MSSQL -> Pozitif Klinik MySQL Veri Aktarım Süreci

Bu doküman, Intermedia (MSSQL) sisteminden Pozitif Klinik (MySQL) sistemine veri aktarım sürecinin teknik detaylarını, işleyiş sırasını ve veri dönüşüm mantığını açıklamaktadır.

## 1. Genel Mimari
Süreç, modüler bir **ETL (Extract, Transform, Load)** mimarisi üzerine kurulmuştur. Veriler MSSQL'den çekilir, JSON formatında ara dosyalara dönüştürülür ve ardından güvenlik (şifreleme) ve multi-tenant kurallarına uygun olarak MySQL'e yüklenir.

## 2. Çalıştırma Komutu
Tüm süreç ana orkestratör olan `run.js` üzerinden yönetilir:
```bash
node run.js --clinic=[KLINIK_ID]
```

## 3. Adım Adım İşleyiş Sırası

### Adım 1: Şube (Tenant) Senkronizasyonu (`migrate_tenants.js`)
*   **Kaynak:** MSSQL `SUBE` tablosu.
*   **İşlem:** Aktif şubeler `sys_tenants` tablosuna aktarılır.
*   **Önem:** Sistemin multi-tenant yapısının temelini atar; sonraki tüm veriler buradaki `id` (clinic_id) ile ilişkilendirilir.

### Adım 2: Veri Çıkarma (Extraction) (`extraction/extract_mssql.js`)
*   **Kaynak Tablolar:** `HST_ANADOSYA`, `HST_GELISLER`, `KULLANICILAR`, `TETKIK`, `HST_ISLEMLER` ve `UZM_*_HST_ANAMNEZ` (Branş tabloları).
*   **İşlem:**
    *   Hastalar, randevular, kullanıcılar ve hizmet tanımları çekilir.
    *   **Branş Birleştirme:** Onlarca farklı branş tablosuna dağılmış olan muayene notları (şikayet, hikaye, bulgular, tanı, tedavi) `GELISNO` üzerinden tek bir yapı altında toplanır.
*   **Çıktı:** `data/` klasöründe ara JSON dosyaları oluşturulur.

### Adım 3: Veri Yükleme ve Güvenlik (Loading) (`loading/load_mysql.js`)
*   **İşlem:** JSON verileri MySQL'e yüklenir.
*   **Güvenlik (KVKK):**
    *   **AES-256-GCM:** İsim, TC No, Telefon, Adres gibi veriler şifrelenir.
    *   **Blind Index:** Şifreli verilerde arama yapılabilmesi için `search_index` tablosuna HMAC hash'leri yazılır.
*   **Eşleştirme:** `legacy_id` kullanılarak eski ve yeni sistem kayıtları birbirine bağlanır.

### Adım 4: Branş İşaretleme (`categorize_specialty.js`)
*   **İşlem:** Muayene kayıtları, geldikleri branş tablolarına göre `specialty_code` (örn: `IC_HASTALIKLARI`) ile damgalanır.

### Adım 5: Lab Tanımları (`migrate_lab_metadata.js`)
*   **Kaynak:** `LAB_TESTLER`, `LAB_TESTNORMALLERI`, `Lab_TestGrubu`.
*   **İşlem:** Test tanımları, Loinc kodları, referans aralıkları ve panel (grup) şablonları aktarılır.

### Adım 6: Laboratuvar Sonuçları (`migrate_lab_data.js`)
*   **Kaynak:** `HST_LAB_BIYOKIMYA`.
*   **İşlem:** `BULK INSERT` ile büyük veri setleri (sonuçlar ve parametreler) randevularla eşleştirilerek aktarılır.

### Adım 7: Finansal Veriler (`migrate_payments.js`)
*   **Kaynak:** `HST_ODEMELER`.
*   **İşlem:** Tahsilat kayıtları normalize edilerek (Nakit, KK, Havale) `cln_payments` tablosuna aktarılır.

---

## 4. Kritik Veri Eşleşmeleri

| MSSQL Kaynak | MySQL Hedef | Açıklama |
| :--- | :--- | :--- |
| `HASTANO` | `ptn_cards.legacy_id` | Hasta Tekil Anahtarı |
| `GELISNO` | `cln_appointments.legacy_visit_id` | Randevu/Geliş Takip |
| `KOD` (TETKIK) | `cln_services.legacy_code` | Hizmet Tanım Eşleşmesi |
| `ODEMENO` | `cln_payments.legacy_id` | Ödeme Takip |

## 5. Teknik Notlar
*   **Idempotency:** Tüm scriptler `INSERT IGNORE` veya `ON DUPLICATE KEY UPDATE` mantığıyla çalışır, bu sayede süreç güvenle tekrar edilebilir.
*   **Hata Yönetimi:** Herhangi bir adımda hata oluşması durumunda `run.js` süreci durdurur ve hata mesajını gösterir.
*   **Loglama:** `data/` klasörü altındaki JSON dosyaları, aktarım öncesi verinin doğruluğunu kontrol etmek için kullanılabilir.
