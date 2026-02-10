# Çoklu Klinik Migrasyon Planı (Multi-Tenant Migration Strategy)

## 📌 Amaç
Bu belge, Pozitif Klinik platformuna gelecekte eklenecek yeni kliniklerin verilerini, mevcut sistemi bozmadan ve veri bütünlüğünü koruyarak içeri aktarmak (import) için izlenmesi gereken stratejiyi tanımlar.

Mevcut migrasyon scriptleri (`load_mysql.js`) tek bir klinik için "sıfırdan kurulum" (truncate & load) mantığıyla çalışmaktadır. İkinci ve sonraki klinikler için bu yöntem **KULLANILAMAZ**.

## 🚀 Temel Prensipler

1.  **ASLA TRUNCATE YAPILMAMALI:** Yeni bir klinik eklenirken mevcut veri tabanı tabloları (`ptn_cards`, `cln_appointments` vb.) asla boşaltılmamalıdır. Sadece ekleme (INSERT) yapılmalıdır.
2.  **LEGACY ID ZORLAMASI KALDIRILMALI:** İlk migrasyonda yapılan `id = legacy_id` zorlaması, ikinci klinikte ID çakışmalarına (Duplicate Key Error) yol açacaktır. Yeni kayıtlar, veritabanının `AUTO_INCREMENT` mekanizmasına bırakılmalı ve yeni üretilen ID'ler kullanılmalıdır.
3.  **KLİNİK ID İZOLASYONU:** Her işlem, hedef `clinic_id` parametresi ile çalışmalı ve veriler bu ID ile etiketlenmelidir.

## 🛠️ Uygulama Adımları (load_mysql_multitenant.js)

Yeni geliştirilecek migrasyon scripti (`load_mysql_multitenant.js` veya `v2`) şu mantıkla çalışmalıdır:

### 1. Hazırlık ve Parametreler
- Script, çalıştırılırken hedef `clinic_id` parametresini almalıdır.
  - Örnek: `node migration/load_mysql_v2.js --clinic=2`
- Hedef kliniğin `sys_tenants` tablosunda var olduğu doğrulanmalıdır.

### 2. ID Eşleştirme (Mapping) Stratejisi
Eski sistemdeki ID'ler (Legacy ID) ile yeni sistemdeki ID'ler (New ID) arasında bir eşleşme haritası (`Map<LegacyID, NewID>`) bellekte tutulmalıdır.

#### Senaryo: Hasta (Patient) Aktarımı
1.  **Okuma:** Kaynak veriden hasta okunur (Örn: `LegacyID: 100`).
2.  **Yazma:** `ptn_cards` tablosuna `INSERT` yapılırken `id` sütunu **BELİRTİLMEZ** (veya NULL geçilir).
    ```sql
    INSERT INTO ptn_cards (clinic_id, name, legacy_id, ...) VALUES (2, 'Ahmet Yılmaz', 100, ...);
    ```
3.  **Mapping:** Veritabanı yeni bir ID üretir (Örn: `NewID: 54001`). Bu ID yakalanır ve haritaya eklenir.
    ```javascript
    patientMap.set(100, 54001); // LegacyID -> NewID
    ```

#### Senaryo: Randevu (Appointment) Aktarımı
Randevular aktarılırken `patient_id` sütunu için yukarıdaki harita kullanılır.
1.  **Okuma:** Kaynak randevu okunur (Örn: `PatientID: 100`).
2.  **Yazma:** Haritadan yeni ID bulunur (`54001`) ve insert işleminde bu kullanılır.
    ```sql
    INSERT INTO cln_appointments (clinic_id, patient_id, ...) VALUES (2, 54001, ...);
    ```

### 3. İlişkili Tabloların Yönetimi
Aşağıdaki tüm tablolar için benzer "Map & Insert" mantığı uygulanmalıdır:
1.  **Kullanıcılar (`sys_users`):** `LegacyUserID` -> `NewUserID`
2.  **Hizmetler (`cln_services`):** `LegacyServiceID` -> `NewServiceID`
3.  **Hastalar (`ptn_cards`):** `LegacyPatientID` -> `NewPatientID`
4.  **Randevular (`cln_appointments`):** `LegacyApptID` -> `NewApptID`
5.  **İşlem Kalemleri (`cln_appointment_items`):** Randevu ID'sine göre bağlanır.
6.  **Muayene Notları (`cln_examinations`):** Randevu ve Hasta ID'lerine göre bağlanır.

### 4. Çakışma Kontrolleri (Conflicts)
- **TC Kimlik No:** Eğer daha önce başka bir klinikte kayıtlı bir hasta (aynı TC) varsa:
    - **Seçenek A:** Yeni bir kayıt oluşturulur (Farklı klinik, farklı hasta kaydı). Mevcut tasarımımız (`clinic_id` dahilinde unique) buna izin veriyor mu kontrol edilmeli.
    - **Seçenek B:** Mevcut hasta kaydı kullanılır (Global hasta havuzu). Bu durumda `ptn_cards` tablosu `clinic_id`'den bağımsız olmalı veya `link_patient_clinic` gibi bir ara tablo kullanılmalıdır. **(Mevcut tasarımda hastalar kliniklere aittir, bu yüzden Seçenek A varsayılan davranıştır.)**
- **Kullanıcı Adı / E-posta:** Aynı e-posta adresiyle ikinci bir kullanıcı oluşturulurken `Duplicate Entry` hatası alınabilir.
    - Çözüm: E-posta veya kullanıcı adına klinik ön eki eklenebilir veya kullanıcıya sorulabilir.

## ⚠️ Kritik Uyarılar
- **`TRUNCATE` KOMUTU ASLA VE ASLA KULLANILMAMALI.**
- `legacy_id` sütunu sadece referans veya loglama amaçlı kullanılmalı, **ASLA Primary Key olarak zorlanmamalıdır.**
- Script çalıştırılmadan önce `sys_tenants` tablosunda ilgili kliniğin kaydının olduğundan emin olunmalıdır.
