# SMS Modülü Analiz ve Geliştirme Planı

## 1. Mevcut (Legacy) Yapı Analizi
Eski MSSQL veritabanı (`ErhanOzel`) üzerinde yapılan incelemeler sonucunda:

- **Tablolar:** 
  - `ILET_SMS_Giden_Kutusu`: Gidecek mesajların kuyruğu. `SMSSISTEMI` kolonu ile sağlayıcı ayrımı yapıldığı görülüyor.
  - `ILET_SMS_LOG`: Gönderilen mesajların logları.
  - `ILET_SMS_REFERANSTURU`: Mesajın türünü (Randevu hatırlatma vb.) belirtiyor.
- **Konfigürasyon:** 
  - Merkezi ve esnek bir "SMS Sağlayıcı Ayarları" tablosu bulunamadı. Ayarların kod içine gömülü (hardcoded) olduğu veya `AYAR_DEGISKENLER` gibi genel tablolarda standart olmayan anahtarlarla tutulduğu tahmin ediliyor.
  - `Ayar_EmailSmsGonderimi` tablosu daha çok "kime ne zaman rapor gidecek" mantığını tutuyor, altyapı ayarlarını değil.
- **Kısıtlar:**
  - Yeni sağlayıcı eklemek kod değişikliği gerektiriyor.
  - HTTP metodları (GET/POST) ve parametreler dinamik değil.

## 2. Yeni Modül Mimarisi (Platform & Multi-Tenant)
Kliniklerin kendi SMS sağlayıcılarını seçebileceği veya platform yöneticisinin tanımlayabileceği esnek bir yapı kurgulanmıştır.

### 2.1. Veritabanı Şeması (MySQL)

**`sys_sms_providers` (Sistem Tanımlı Sağlayıcılar & Şablonlar)**
Bu tablo, desteklenen entegrasyon şablonlarını (Provider Builder verilerini) tutar.
- `id` (int, PK)
- `name` (varchar): Örn: "NetGSM", "BizimSMS", "Generic HTTP"
- `driver_key` (varchar): Backend tarafındaki driver anahtarı. Örn: `netgsm`, `generic_http`
- `template_config` (json): **[YENİ]** Platform yöneticisi tarafından tanımlanan sabit ayarlar.
  - Örn: `{"url": "...", "method": "POST", "body_template": "..."}`
- `config_schema` (json): Kliniğin doldurması gereken alanların tanımı (Dinamik form oluşturmak için).
  - Örn: `[{"key": "username", "label": "Kullanıcı Adı"}, {"key": "password", "label": "API Key"}]`
- `is_active` (boolean)

**`cln_sms_settings` (Klinik Bazlı Ayarlar)**
Her kliniğin kendi ayarlarını tuttuğu tablo.
- `id` (int, PK)
- `clinic_id` (int): Hangi klinik?
- `provider_id` (int): `sys_sms_providers.id`
- `config_data` (json): Şifrelenmiş (Encrypted) ayar verileri. Sadece kliniğin girdiği değerleri tutar.
  - Örn: `{"username": "doktor1", "password": "..."}`
- `is_active` (boolean)

**`cln_sms_queue` (Gönderim Kuyruğu)**
- `id`, `clinic_id`, `phone`, `message`, `status`, `provider_response`, `created_at`, `updated_at`

### 2.2. Provider Builder (Low-Code Entegrasyon)
Platform yöneticisi, yeni bir SMS sağlayıcısını kod yazmadan ekleyebilir:
1. **Şablon Tanımı**: URL, Method ve Payload (XML/JSON) şablonunu oluşturur. Şablonda kliniğe özel alanlar `{{variable}}` şeklinde belirtilir.
2. **Otomatik Form**: Belirtilen değişkenler, klinik ayar ekranında otomatik olarak form alanına dönüşür.
3. **Test Mekanizması**: Ayarlar kaydedilmeden önce gerçek bir numara ile test edilerek API uyumluluğu doğrulanır.

### 2.3. Backend (PHP - Slim)
- **SmsService**: Kliniğin değerleri ile sağlayıcının şablonunu (`template_config`) birleştirerek (merge) dinamik isteği hazırlar.
- **Factory Logic**: `driver_key` değerine göre ilgili driver sınıfını (`NetgsmDriver`, `GenericHttpDriver`) yükler.
- **Encryption**: Klinik bazlı hassas veriler (API Key/Password) veritabanında AES-256 ile şifrelenmiş tutulur.

### 2.4. API Endpointleri (Platform Yönetimi)
- `GET /platform-admin/sms/providers`: Tanımlı sağlayıcıları listeler.
- `POST /platform-admin/sms/validate-provider`: Yeni sağlayıcı tanımını test eder.
- `POST /platform-admin/sms/providers`: Onaylanmış yeni bir sağlayıcı şablonu oluşturur.
- `PUT /platform-admin/sms/settings/{clinicId}`: Kliniğin SMS ayarlarını günceller.

## 3. Geliştirme Durumu

1.  [x] Analiz ve Planlama
2.  [x] Veritabanı Şeması ve Migrasyonlar (Provider Builder desteği eklendi)
3.  [x] Backend: `SmsDriverInterface` ve `GenericHttpDriver` (Template merge desteği)
4.  [x] Backend: `SmsService` (Test ve Provider Builder metodları)
5.  [x] Backend: API Controller Endpointleri (Platform & Tenant)
6.  [ ] Frontend: Platform tarafında "Provider Builder" arayüzü (Yakında)
7.  [ ] Frontend: Klinik tarafında "Ayarlar" tabı entegrasyonu (Yakında)
