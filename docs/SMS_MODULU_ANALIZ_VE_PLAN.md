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
Kliniklerin kendi SMS sağlayıcılarını seçebileceği veya platform yöneticisinin tanımlayabileceği esnek bir yapı kurgulanacaktır.

### 2.1. Veritabanı Şeması (MySQL)

**`sys_sms_providers` (Sistem Tanımlı Sağlayıcılar)**
Bu tablo, desteklenen entegrasyon şablonlarını tutar.
- `id` (int, PK)
- `name` (varchar): Örn: "NetGSM", "İleti Merkezi", "Generic HTTP"
- `driver_class` (varchar): Backend tarafındaki sınıf adı. Örn: `App\Core\Sms\Drivers\NetgsmDriver` veya `App\Core\Sms\Drivers\GenericHttpDriver`
- `config_schema` (json): Bu sağlayıcı için gerekli alanların tanımı (Form oluşturmak için).
  - Örn: `[{"key": "username", "label": "Kullanıcı Adı", "type": "text"}, {"key": "source_addr", "label": "Başlık", "type": "text"}]`
- `is_active` (boolean)

**`cln_sms_settings` (Klinik Bazlı Ayarlar)**
Her kliniğin kendi ayarlarını tuttuğu tablo.
- `id` (int, PK)
- `clinic_id` (int): Hangi klinik?
- `provider_id` (int): `sys_sms_providers.id`
- `config_data` (json): Şifrelenmiş (Encrypted) ayar verileri.
  - Örn: `{"username": "doktor1", "password": "sifre123", "header": "POZITIF"}`
- `is_active` (boolean)

**`cln_sms_queue` (Gönderim Kuyruğu)**
- `id`
- `clinic_id`
- `phone`
- `message`
- `status` (pending, sending, sent, failed)
- `provider_response` (text)
- `created_at`, `updated_at`

### 2.2. Backend (PHP - Slim)

Bu yapı interface tabanlı ve genişletilebilir olacaktır.

- **Interface:** `SmsDriverInterface` (`send($phone, $message, $config)`)
- **Driverlar:**
  - `GenericHttpDriver`: Kullanıcı arayüzünden girilen URL, Method ve JSON Payload şablonuna göre istek atar. En esnek yapıdır.
  - `NetgsmDriver`, `TwilioDriver`: Özel API'leri olanlar için optimize edilmiş sınıflar.
- **Service:** `SmsService`
  - Kliniğin aktif ayarını çeker.
  - İlgili driver'ı yükler (`Factory Pattern`).
  - Gönderimi yapar ve loglar.

### 2.3. Frontend (Platform Admin)

- **SMS Ayarları Sayfası:**
  - Sağlayıcı seçimi (Selectbox).
  - Seçilen sağlayıcıya göre dinamik form alanlarının gelmesi (`config_schema`'dan okunarak).
  - "Test SMS Gönder" butonu.

## 3. Geliştirme Adımları

1.  [x] Analiz ve Planlama
2.  [x] Veritabanı Migrasyonlarının Hazırlanması (`sys_sms_providers`, `cln_sms_settings`)
3.  [x] Seed Data (Yaygın sağlayıcılar ve Generic Driver için)
4.  [x] Backend: `SmsDriverInterface` ve `GenericHttpDriver` implementasyonu.
5.  [x] Backend: `SmsService` ve Controller endpointlerinin yazılması.
6.  [x] Frontend: Platform tarafında ayar ekranının tasarlanması.
7.  [x] Frontend: JS entegrasyonu (Dinamik Form Builder).
