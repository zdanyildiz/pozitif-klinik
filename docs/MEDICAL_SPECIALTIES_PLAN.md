# Tıbbi Uzmanlık ve Entegrasyon Yönetim Planı

Bu doküman, sistemdeki "Branş (Specialty)" kavramının personel yönetimi, muayene formları ve ICD arama motoru ile tam entegre çalışması için yapılacak geliştirmeleri kapsar.

## 1. Amaç: "Tek Kaynak, Tam Uyum"
Sistemde branş bilgisinin (Örn: "Göz Hastalıkları") farklı yerlerde hardcoded string olarak değil, merkezi bir veritabanı tablosundan yönetilmesini hedefler.

## 2. Veritabanı Mimarisi

### A. Yeni Master Tablo: `sys_medical_specialties`
Mevcut `sys_specialty_forms` tablosu genişletilerek ve yeniden adlandırılarak sistemin ana branş sözlüğü haline getirilecektir.

```sql
CREATE TABLE `sys_medical_specialties` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,        -- Örn: 'GOZ', 'KBB', 'DAHILIYE' (Değişmez ID gibi)
  `name` varchar(100) NOT NULL,       -- Örn: 'Göz Hastalıkları'
  `icd_prefixes` varchar(255) DEFAULT NULL, -- Örn: 'H' veya 'J,A,B' (Smart Search için)
  `form_schema` LONGTEXT DEFAULT NULL, -- Dinamik muayene formu JSON yapısı
  `is_active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### B. İlişkiler
*   **Personel Tablosu (`sys_users`):** `specialty` sütunu serbest metin yerine `sys_medical_specialties.code` değerini referans alacak (veya FK ile bağlanacak).

## 3. Platform Admin (Yönetim Paneli) Geliştirmeleri

Platform yöneticisinin (Süper Admin) branşları yönetebileceği yeni bir modül geliştirilecektir.

*   **Rota:** `/platform/specialties`
*   **Özellikler:**
    *   Yeni Branş Ekleme / Düzenleme
    *   **ICD Prefix Tanımlama:** Yöneticinin, "Göz Branşı için H kodlarını öne çıkar" diyebileceği bir ayar alanı.
    *   **Form Tasarımı:** (İleri Faz) JSON şemasını düzenleyebileceği bir editör.

## 4. Entegrasyon Noktaları (Tam Uyum)

### A. Personel Ekleme Formu
*   Platform veya Klinik yöneticisi yeni bir **Doktor** eklerken, "Uzmanlık Alanı" inputu artık serbest metin olmayacak.
*   Backend'den (`/api/general/specialties`) çekilen liste **Selectbox** içinde sunulacak.

### B. Akıllı ICD Arama (Smart Search v2)
*   Şu an kod içinde hardcoded (elle yazılmış) olan `GÖZ -> H` eşleşmesi kaldırılacak.
*   **Sistem:** Arama yapıldığında, doktorun branş kodu (`sys_medical_specialties.code`) üzerinden tablodaki `icd_prefixes` sütunu okunacak ve arama sonuçları buna göre boost edilecek.
*   **Avantaj:** Yeni bir branş eklendiğinde kod değiştirmeden sadece admin panelinden ICD harfleri tanımlanarak sistem akıllandırılacak.

## 5. Uygulama Planı

1.  **Migrasyon:** `01_system.sql` güncellenerek `sys_specialty_forms` -> `sys_medical_specialties` dönüşümü yapılacak. `icd_prefixes` kolonu eklenecek.
2.  **Backend:** `MedicalSpecialtyController` ve Repository oluşturulacak.
3.  **UI:** Platform tarafında CRUD sayfaları yapılacak.
4.  **Refactoring:** `GeneralRepository` içindeki hardcoded logic, veritabanı sorgusu ile değiştirilecek.
