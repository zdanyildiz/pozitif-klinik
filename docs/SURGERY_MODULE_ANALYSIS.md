# Ameliyat Takip Modülü Analizi ve Planı

## 1. Eski Sistem (MSSQL Legacy) Analizi

Eski veritabanı (`ErhanOzel`) incelendiğinde, ameliyatların tek bir "Ameliyatlar" tablosunda tutulmadığı, bunun yerine **Hizmet/İşlem** ve **Uzmanlık Detayları** olarak ikiye ayrıldığı görülmüştür.

### Yapı:
1.  **Finansal ve Kayıt (Billed Procedures):**
    *   Ameliyatlar, diğer tıbbi işlemler gibi `HST_ISLEMLER` tablosunda tutulmaktadır.
    *   Bu tablo `BUT_ISLEMLER` (Bütçe Uygulama Talimatı / SUT Listesi) tablosuna `ISLEMNO` veya `CUKOD` ile bağlanarak işlemin ne olduğu (Örn: "Septorinoplasti") belirlenir.
    *   Bu yapı, ameliyatın yapıldığı tarihi, fiyatı ve yapan doktoru tutar ancak ameliyatın detaylı tıbbi notlarını (teknik, anestezi türü vb.) içermez.

2.  **Tıbbi Detaylar (Medical Details):**
    *   Ameliyatın teknik detayları, her uzmanlık dalı için ayrı oluşturulmuş tablolarda tutulmaktadır.
    *   **Örnek:** `UZM_PLASTIKCERRAH_HST_ANAMNEZ` tablosunda `BUR_TEKNIK` (Burun Tekniği), `MEME_PROTEZ_SAG` (Sağ Meme Protez) gibi yüzlerce spesifik kolon bulunmaktadır.
    *   `UZM_GOZ_OPERASYON` gibi bazı tablolar mevcut olsa da içi boş görünmektedir; veriler muhtemelen ana anamnez tablolarında toplanmıştır.

**Özet:** Eski sistemde "Ameliyat Takibi" modüler bir yapıdan ziyade, hasta kartı içindeki formlar (Anamnez) ve muhasebeleşen işlemler (Hst_Islemler) üzerinden yürümektedir.

---

## 2. Yeni Modül Kurgusu (Öneri)

Kullanıcının talep ettiği "Doktor, Hasta, Hastane, Tarih, Açıklama" bazlı takip sayfası için, dağınık eski yapıyı birebir kopyalamak yerine modern ve merkezi bir yapı önerilmektedir.

### Veritabanı Şeması: `cln_surgeries`

Yeni sistemde ameliyatları birer "Olay (Event)" olarak takip edecek bir ana tablo oluşturulmalıdır.

```sql
CREATE TABLE `cln_surgeries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `clinic_id` INT NOT NULL,
  `patient_id` INT NOT NULL,
  `doctor_id` INT NOT NULL,  -- Baş cerrah
  `surgery_date` DATETIME NOT NULL,
  `status` ENUM('planned', 'completed', 'cancelled', 'postponed') DEFAULT 'planned',
  `hospital_name` VARCHAR(255) NULL, -- Dış merkezde yapılıyorsa
  `protocol_no` VARCHAR(50) NULL,    -- Hastane protokol no
  `description` TEXT NULL,           -- Genel açıklama / Notlar
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants`(`id`),
  FOREIGN KEY (`patient_id`) REFERENCES `cln_patients`(`id`),
  FOREIGN KEY (`doctor_id`) REFERENCES `sys_users`(`id`)
);
```

### Özellikler
1.  **Dış Merkez Desteği:** Ameliyatlar klinik içinde değil, anlaşmalı hastanelerde yapılıyor olabilir. `hospital_name` alanı ile bu takip edilebilir.
2.  **Statü Yönetimi:** Planlanan ameliyatların gerçekleşip gerçekleşmediği (`planned` -> `completed`) takip edilebilir.
3.  **Takvim Görünümü:** `date` alanı kullanılarak doktorların ameliyat takvimi oluşturulabilir.

### Entegrasyon
*   Detaylı tıbbi notlar (Eski sistemdeki gibi detaylı formlar) gerekirse `cln_examinations` (Muayene) altına bir alt tür olarak veya `cln_surgery_details` (JSON) olarak eklenebilir. Ancak ilk etapta takip listesi için ana tablo yeterlidir.

## 3. Yol Haritası

1.  **SQL Tablo Oluşturma:** `cln_surgeries` tablosunun oluşturulması.
2.  **API Geliştirme:**
    *   `SurgeryRepository`: Veritabanı işlemleri.
    *   `SurgeryController`: Listeleme, Ekleme, Silme işlemleri.
3.  **Frontend (Web):**
    *   `/admin/surgeries`: Tüm ameliyatların listesi (Filtreler: Tarih, Doktor, Hastane).
    *   **Modal:** Yeni ameliyat planlama formu.

Bu yapı ile eski karmaşık yapıdan kurtulup, yönetimsel olarak takip edilebilir modern bir süreç elde edilecektir.
