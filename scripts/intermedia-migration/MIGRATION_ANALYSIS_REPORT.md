# Intermedia Migration Veri Analiz ve Eksiklik Raporu

## Genel Bakış
Bu rapor, Intermedia (MSSQL) sisteminden Pozitif Klinik (MySQL) sistemine yapılan hasta verisi aktarım sürecini (`extract_mssql.js` ve `load_mysql.js`) ve kaynak veritabanı yapısını (`HST_ANADOSYA`) inceleyerek hazırlanan analiz sonuçlarını içerir.

Raporun amacı, veri kaybı risklerini en aza indirmek ve hasta kartındaki kritik verilerin eksiksiz taşındığından emin olmaktır.

## Tespit Edilen Eksiklikler

Aşağıdaki veri alanları kaynak sistemde (`HST_ANADOSYA`) mevcut olmasına rağmen, mevcut migrasyon senaryosunda **aktarılmamaktadır**.

### 1. İş Yeri ve İletişim Bilgileri (Kritik)
Kaynak tabloda hastanın iş yeri ile ilgili detaylı bilgiler bulunmaktadır ancak bunlar migrasyon kapsamına alınmamıştır. Bu veriler medikal takip ve iletişim için önemli olabilir.

*   `IS_ADI` (İş Yeri Adı)
*   `IS_GOREVI` (Görevi / Ünvanı)
*   `IS_TELEFON` (İş Telefonu)
*   `IS_ADRES...` (İş Adresi bileşenleri)
*   `IS_EMAIL` (İş E-postası)

### 2. Nüfus Cüzdanı ve Kimlik Detayları (Orta Önem)
Resmi raporlamalar ve reçete sistemleri için gerekli olabilecek detaylı nüfus bilgileri eksiktir.

*   `NK_MEDENIHALI` (Medeni Hali) - *Özellikle 'soyadı değişikliği' takibi için önemlidir.*
*   `NK_CILTNO`, `NK_AILENO`, `NK_SIRANO` (Cilt/Aile/Sıra No) - *Resmi işlemlerde gerekebilir.*
*   `NK_ILKODU`, `NK_ILCEKODU` (Nüfus Kayıt Yeri Kodları)

### 3. Ek Kişisel Bilgiler
*   `ESININADI` (Eşinin Adı) - *Acil durumlarda veya genetik öyküde referans olabilir.*
*   `VERGINO` (Vergi Numarası) - *Fatura kesim süreçleri için kritik olabilir.*
*   `EV_POSTAKODU` (Posta Kodu) - *Adres standardizasyonu için gereklidir.*

## Yapısal Analiz ve Riskler

### 1. Adres Eşleştirme (İl/İlçe)
`load_mysql.js` scripti, metin tabanlı İl/İlçe eşleştirmesi (`findProvinceId`, `findDistrictId`) yapmaktadır.
*   **Risk:** `HST_ANADOSYA` tablosundaki `EV_ADRES_IL` ve `EV_ADRES_ILCE` alanlarındaki yazım hataları veya eski isimler (örn: "İçel" -> "Mersin") eşleşme başarısızlığına neden olabilir.
*   **Öneri:** Eşleşmeyen kayıtlar için `notes` alanına veya ayrı bir `migration_log` tablosuna "Adres eşleştirilemedi: [IL/ILCE]" şeklinde bir uyarı düşülmesi.

### 2. Tablo Temizleme (TRUNCATE) Riski
`load_mysql.js` scripti çalışırken hedef tabloları (`ptn_cards`, vb.) `TRUNCATE` komutu ile boşaltmaktadır.
*   **Risk:** Canlıya alındıktan sonra veya test sürecinde elle eklenen yeni hastalar varsa, bu script tekrar çalıştırıldığında **veri kaybı yaşanacaktır**.
*   **Öneri:** Scriptin başına bir "güvenlik kilidi" konulmalı veya sadece boş veritabanında çalıştığından emin olunmalıdır.

## Önerilen Aksiyon Planı

1.  **JSON Metadata Genişletilmesi:** Eksik alanların (`extra_metadata`) yapısına eklenmesi:
    ```javascript
    extra_metadata: {
        // ... mevcut alanlar
        work_info: {
            company: row.IS_ADI,
            phone: row.IS_TELEFON,
            address: row.IS_ADRES...
        },
        identity_details: {
            marital_status: row.NK_MEDENIHALI,
            volume_no: row.NK_CILTNO,
            family_order_no: row.NK_AILENO
        },
        personal: {
            spouse_name: row.ESININADI,
            tax_no: row.VERGINO
        }
    }
    ```

2.  **Adres Validasyonu:** Migrasyon sırasında eşleşmeyen il/ilçelerin raporlanması özelliğinin eklenmesi.

Bu rapor doğrultusunda migrasyon scriptlerinin güncellenmesi önerilmektedir.
