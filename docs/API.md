# API Dokümantasyonu

## Genel Bilgiler

**Base URL:** Sunucu yapılandırmasına göre değişir (örn: `http://localhost/pozitif-klinik/public`)

**Authentication:** Tüm `/api/*` ve `/admin/*` endpoint'leri (login hariç) `Bearer <token>` JWT ile korunmaktadır.

**Routing:** Tüm rotalar PHP 8 Attributes (`#[Route]`, `#[Group]`, `#[Middleware]`) ile Controller sınıflarında tanımlanır ve `RouteRegistrar` tarafından otomatik keşfedilir.
- **API Rotaları:** `/api/*` (Domain) ve `/platform-admin/*` (Super Admin).
- **Web Rotaları:** `/admin/*` (Klinik SSR) ve `/platform/*` (Super Admin SSR).

---

## Standart Yanıt Formatı (Pozitif JSON Anayasası)

Tüm yanıtlar (Başarılı `2xx` veya Hatalı `4xx`, `5xx`), "Tek Zar, Tek Format" prensibi gereği aynı zarf yapısında döner:

**Hata Yanıtı Örneği:**
```json
{
    "status": false,
    "message": "Sayfa bulunamadı / Yetkisiz erişim / Sunucu Hatası",
    "data": {
        "trace_id": "ab123cd-45ef-67gh"
    }
}
```

**Başarı Yanıtı Örneği:**
```json
{
  "status": true,
  "message": "İşlem başarıyla tamamlandı",
  "data": { ... } 
}
```

---

## Public API

Bu endpoint'ler, klinik kullanıcılarının (doktor, resepsiyonist vb.) mobil veya web uygulamaları üzerinden erişimi içindir.

### `GET /api`
Sistem sağlık kontrolü (Health Check). Servisin ayakta olup olmadığını doğrular.

**Başarılı Yanıt (200 OK):**
```json
{
  "status": true,
  "message": "Pozitif Klinik Backend Running...",
  "data": {
    "service": "Pozitif Klinik API",
    "version": "1.0.0",
    "status": "active"
  }
}
```

### `POST /auth/login`

Klinik kullanıcısının sisteme giriş yapmasını ve JWT almasını sağlar. "Tenant-Aware" login işlemi yapılır; öncelikle kurum kodu ile klinik doğrulanır, ardından kullanıcı o klinikte aranır.

**Payload:**
```json
{
  "clinic_code": "pozitif",
  "username": "doktor_ahmet",
  "password": "secure_password"
}
```

**Başarılı Yanıt (200 OK):**
```json
{
  "status": true,
  "message": "Giriş başarılı",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ..."
  }
}
```

**Hata Yanıtları (401 Unauthorized):**
Giriş başarısız olduğunda dönen `message` alanı sorunun kaynağını belirtir:
- "Girdiğiniz Kurum Kodu sisteme kayıtlı değil."
- "Kurum hesabı pasif durumda."
- "Bu kurumda belirtilen kullanıcı adı bulunamadı."
- "Girilen şifre hatalı."
- "Kullanıcı hesabı pasif durumda."

---

## Platform API (Super Admin)

Bu endpoint'ler, sadece platform yöneticisinin (root admin) erişebileceği, klinik yönetimiyle ilgili işlemler içindir.

### `POST /platform-admin/login`

Platform yöneticisinin (root) sisteme giriş yapmasını sağlar.

**Payload:**
```json
{
  "username": "admin",
  "password": "root_password"
}
```

**Başarılı Yanıt (200 OK):**
```json
{
  "status": true,
  "message": "Giriş başarılı",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiJ...",
    "token_type": "Bearer",
    "expires_in": 43200
  }
}
```

### `POST /platform-admin/tenants`

Yeni bir klinik (tenant) oluşturur.

**Gerekli Yetki:** Platform Admin

**Payload:**
```json
{
  "name": "Yeni Test Kliniği",
  "domain_prefix": "yeniklinik",
  "admin_username": "admin",
  "admin_password": "strong_password123"
}
```

**Başarılı Yanıt (201 Created):**
```json
{
    "status": true,
    "message": "Klinik ve Yönetici başarıyla oluşturuldu",
    "data": {
        "clinic_id": 5,
        "name": "Yeni Test Kliniği",
        "domain_prefix": "yeniklinik",
        "admin_username": "admin"
    }
}
```

### `PUT /platform-admin/tenants/{id}`

Klinik bilgilerini ve opsiyonel olarak klinik yöneticisini günceller.

**Gerekli Yetki:** Platform Admin

**Payload:**
```json
{
  "name": "Güncellenmiş Klinik Adı",
  "is_active": 1,
  "admin_username": "yeni_admin_user",  // (Opsiyonel) Değişecekse gönderilir
  "admin_password": "yeni_password"     // (Opsiyonel) Değişecekse gönderilir
}
```

**Başarılı Yanıt (200 OK):**
```json
{
    "status": true,
    "message": "Klinik bilgileri başarıyla güncellendi.",
    "data": null
}
```

### `GET /platform-admin/tenants`

Sistemdeki tüm klinikleri listeler.

**Gerekli Yetki:** Platform Admin

**Başarılı Yanıt (200 OK):**
```json
{
    "status": true,
    "message": "İşlem başarılı",
    "data": [
        {
            "id": 1,
            "name": "Merkez Diş Kliniği",
            "domain_prefix": "merkezdis",
            "is_active": 1,
            "created_at": "2026-01-19 10:00:00"
        }
    ]
}

---

### Klinik Temel Bilgileri (Platform Admin)

Bu endpoint'ler kliniğin iletişim bilgileri, adres, vergi bilgileri ve çalışma saatlerini yönetir.

> **Not:** `GET /platform-admin/tenants/{id}` endpoint'i `TenantSettingsController`'da tanımlıdır ve klinik detayları ile admin bilgilerini döner.

#### `GET /platform-admin/tenants/{id}/basic-info`
Kliniğin detaylı temel bilgilerini (iletişim, adres, çalışma saatleri) getirir.

**Başarılı Yanıt (200 OK):**
```json
{
    "status": true,
    "data": {
        "id": 1,
        "name": "Pozitif Estetik Kliniği",
        "domain_prefix": "pozitif",
        "logo_url": null,
        "phone": "0212 123 45 67",
        "email": "info@pozitifklinik.com",
        "website": "https://www.pozitifklinik.com",
        "address": "Kadıköy, İstanbul",
        "province_id": 34,
        "district_id": 3423,
        "tax_office": "Kadıköy Vergi Dairesi",
        "tax_number": "1234567890",
        "working_hours": {
            "pazartesi": {"open": true, "start": "09:00", "end": "18:00"},
            "sali": {"open": true, "start": "09:00", "end": "18:00"},
            "pazar": {"open": false, "start": "09:00", "end": "18:00"}
        },
        "description": "İstanbul'un en iyi estetik kliniği",
        "is_active": 1,
        "province_name": "İstanbul",
        "district_name": "Kadıköy"
    }
}
```

#### `PUT /platform-admin/tenants/{id}/basic-info`
Klinik temel bilgilerini günceller.

**Payload:**
```json
{
    "name": "Pozitif Estetik Kliniği",
    "phone": "0212 123 45 67",
    "email": "info@pozitifklinik.com",
    "website": "https://www.pozitifklinik.com",
    "address": "Bağdat Cad. No:123 Kadıköy",
    "province_id": 34,
    "district_id": 3423,
    "tax_office": "Kadıköy Vergi Dairesi",
    "tax_number": "1234567890",
    "description": "İstanbul'un en iyi estetik kliniği",
    "working_hours": {
        "pazartesi": {"open": true, "start": "09:00", "end": "18:00"},
        "sali": {"open": true, "start": "09:00", "end": "18:00"},
        "carsamba": {"open": true, "start": "09:00", "end": "18:00"},
        "persembe": {"open": true, "start": "09:00", "end": "18:00"},
        "cuma": {"open": true, "start": "09:00", "end": "18:00"},
        "cumartesi": {"open": true, "start": "10:00", "end": "15:00"},
        "pazar": {"open": false, "start": "09:00", "end": "18:00"}
    }
}
```

**Başarılı Yanıt (200 OK):**
```json
{
    "status": true,
    "message": "Klinik bilgileri başarıyla güncellendi."
}
```

---

### Platform Log Yönetimi (Super Admin)

Bu endpoint'ler sistem loglarının izlenmesi ve analiz edilmesi içindir.

#### `GET /platform-admin/logs`
Filtrelenmiş log listesini döner.

**Query Params:**
- `date` (YYYY-MM-DD): Hangi güne ait logların okunacağı (varsayılan: bugün).
- `level` (string): Log seviyesi (INFO, ERROR, WARNING, DEBUG, ALL).
- `search` (string): Mesaj içeriğinde, context'te veya trace ID'de arama.
- `limit` (int): Maksimum dönecek kayıt sayısı (varsayılan: 500).

**Başarılı Yanıt (200 OK):**
```json
{
    "status": true,
    "message": "İşlem başarılı",
    "data": {
        "logs": [
            {
                "timestamp": "2026-01-27T16:26:06.824923+01:00",
                "level": "INFO",
                "message": "Incoming Request: [GET] ...",
                "context": { "ip": "::1", "trace_id": "5d8988b6" },
                "extra": { "uid": "a887b8c" }
            }
        ],
        "date": "2026-01-27",
        "level": "ALL",
        "count": 1
    }
}
```

#### `GET /platform-admin/logs/available-dates`
Sistemde log dosyası bulunan tarihlerin listesini döner.

**Başarılı Yanıt (200 OK):**
```json
{
    "status": true,
    "data": ["2026-01-27", "2026-01-26"]
}
```
```

---

## Domain API (Genel / Yardımcı İşlemler)

Tüm klinik kullanıcıları tarafından erişilebilen yardımcı endpoint'ler.

### `GET /api/general/provinces`
Tüm illeri isim sırasına göre listeler.

### `GET /api/general/districts`
Belirli bir ile ait ilçeleri listeler.

**Query Params:**
- `province_id` (int): İlin plakası veya ID'si.

---

## Domain API (Hasta Yönetimi)

Bu endpoint'ler klinik bazlı veri izolasyonu (Multi-Tenancy) sağlar. `clinic_id` JWT token'dan otomatik alınır.

### `GET /api/patients`
Aktif hastaları listeler (`status = 1`). Performans için son 20 kayıt ile sınırlıdır.

### `GET /api/patients/select-list`
Dropdown/select-box yüklemeleri için sadece `id`, `name` ve `tc_no` alanlarını döner. Performans için **en son eklenen 100 hasta** ile sınırlıdır. Daha fazla hasta aramak için `/api/patients/search` endpoint'i kullanılmalıdır.

### `GET /api/patients/search?q={query}`
Hastaları TC No, Telefon veya İsim ile arar (Blind Index eşleşmesi). Arama için en az 2 karakter gereklidir.

### `POST /api/patients`
Yeni hasta kaydı oluşturur.

**Payload:**
```json
{
  "name": "Ali Veli",
  "tc_no": "12345678901",
  "phone": "05551234567",
  "email": "ali@example.com",
  "birth_date": "1990-01-01",
  "gender": "M",
  "blood_type": "A+",
  "province_id": 34,
  "district_id": 3423,
  "address": "Kadıköy, İstanbul",
  "notes": "Alerjisi var"
}
```

**Güvenlik Notu:** `name`, `tc_no`, `phone`, `email` ve `address` alanları veritabanında AES-256-GCM ile şifrelenmiş olarak tutulmaktadır. Arama işlemleri bu alanların HMAC-SHA256 hash'leri (Blind Index) üzerinden yapılır.

### `GET /api/patients/{id}`
Hasta detayını ve son 5 yaşam bulgusu geçmişini (`vitals_history`) getirir.

### `PUT /api/patients/{id}`
Hasta bilgilerini günceller.

### `PATCH /api/patients/{id}/archive`
Hastayı arşivler (`status = 0`).

### `POST /api/patients/{id}/vitals`
Hastaya yaşam bulgusu (ölçüm) ekler.

**Payload:**
```json
{
  "height": 180,
  "weight": 75.5,
  "systolic_bp": 120,
  "diastolic_bp": 80,
  "heart_rate": 72
}
```

---

## Domain API (Personel Yönetimi)

Bu endpoint'ler sadece `role: 'admin'` yetkisine sahip kullanıcılar tarafından kullanılabilir.

### `GET /api/users`
Kliniğe ait tüm personeli listeler.

### `POST /api/users`
Yeni personel ekler (Doktor veya Sekreter).

**Payload:**
```json
{
  "username": "doktor_ahmet",
  "password": "secure_password123",
  "role": "doctor"
}
```

### `DELETE /api/users/{id}`
Personel kaydını siler. (Yöneticiler birbirini veya kendi hesabını silemez).

---

## Domain API (Randevu Yönetimi)

Bu endpoint'ler klinik bazlı randevu işlemlerini yönetir. `clinic_id` JWT token'dan otomatik alınır.

### Randevu İşlemleri

### `GET /api/appointments`
Belirli tarihteki randevuları hasta adı, tür ve doktor bilgisi ile listeler.

**Query Params:**
- `date` (YYYY-MM-DD): Tek günlük listeleme (varsayılan: bugün)
- `start_date` & `end_date`: Tarih aralığı listeleme

**Başarılı Yanıt (200 OK):**
```json
{
  "status": true,
  "message": "İşlem başarılı",
  "data": {
    "date": "2026-01-20",
    "count": 5,
    "appointments": [
      {
        "id": 1,
        "patient_id": 12,
        "patient_name": "Ahmet Yılmaz",
        "type_id": 1,
        "type_name": "Muayene",
        "color_code": "#3788d8",
        "doctor_id": 3,
        "doctor_name": "Dr. Mehmet",
        "appointment_date": "2026-01-20 09:30:00",
        "status": "waiting",
        "notes": null
      }
    ]
  }
}
```

### `GET /api/appointments/{id}`
Tek bir randevuyu detaylarıyla getirir.

### `POST /api/appointments`
Yeni randevu oluşturur.

**Payload:**
```json
{
  "patient_id": 12,
  "type_id": 1,
  "doctor_id": 3,
  "appointment_date": "2026-01-20 14:00:00",
  "notes": "Kontrol muayenesi"
}
```

**Hata Durumu (409 Conflict):**
```json
{
  "status": false,
  "message": "Bu zaman diliminde doktorun başka bir randevusu var"
}
```

### `PUT /api/appointments/{id}`
Randevu bilgilerini günceller.

### `PUT /api/appointments/{id}/status`
Randevu durumunu günceller (Auto-save için tasarlandı).

**Payload:**
```json
{
  "status": "in_test"
}
```

**Geçerli Status Değerleri:**
| Değer | Açıklama |
|-------|----------|
| `pending` | Bekliyor |
| `confirmed` | Onaylı |
| `waiting` | Geldi / Bekliyor |
| `in_test` | Testte |
| `completed` | Tamamlandı |
| `cancelled` | İptal |
| `no_show` | Gelmedi |

### `DELETE /api/appointments/{id}`
Randevuyu siler.

### `GET /api/appointments/stats/today`
Bugünkü ve bekleyen randevu sayılarını getirir (Dashboard için).

**Başarılı Yanıt:**
```json
{
  "status": true,
  "data": {
    "today": 8,
    "pending": 5
  }
}
```

### `GET /api/appointments/patient/{patientId}`
Belirli bir hastanın tüm randevularını listeler.

---

### Randevu Türleri

### `GET /api/appointments/types`
Tanımlı randevu türlerini listeler.

### `POST /api/appointments/types`
Yeni randevu türü oluşturur.

**Payload:**
```json
{
  "name": "Kontrol",
  "color_code": "#28a745",
  "duration_minutes": 15
}
```

### `PUT /api/appointments/types/{id}`
Randevu türünü günceller.

### `DELETE /api/appointments/types/{id}`
Randevu türünü pasif yapar (soft delete).

---

## Domain API (Hizmet Kataloğu)

Bu endpoint'ler klinikte sunulan hizmetleri (Botox, Dolgu, Muayene vb.) yönetir. Her hizmete kod, kategori, açıklama ve KDV oranı tanımlanabilir.

### `GET /api/services`
Aktif hizmetleri listeler.

**Query Params:**
- `includeInactive` (1|0): Pasif hizmetleri de dahil eder (varsayılan: 0)

**Başarılı Yanıt (200 OK):**
```json
{
  "status": true,
  "message": "İşlem başarılı",
  "data": [
    {
      "id": 1,
      "clinic_id": 1,
      "name": "Botox Uygulaması",
      "code": "BTX-001",
      "description": "Yüz bölgesi botox uygulaması",
      "category": "Estetik",
      "price": "1500.00",
      "tax_rate": "20.00",
      "is_active": 1,
      "created_at": "2026-01-27 12:00:00"
    }
  ]
}
```

### `GET /api/services/search`
Hizmet adı, kodu veya açıklamasında arama yapar.

**Query Params:**
- `q` (string): Arama terimi (en az 2 karakter)

### `GET /api/services/categories`
Tanımlı hizmet kategorilerinin listesini döner.

**Başarılı Yanıt (200 OK):**
```json
{
  "status": true,
  "data": ["Estetik", "Muayene", "Tedavi"]
}

### Klinik Ayarları (Tenant)

Klinik yöneticisinin kendi klinik bilgilerini görüntülemesi ve düzenlemesi içindir.

### `GET /api/clinic/settings`
Klinik genel ayarlarını (iletişim, adres, vergi, çalışma saatleri) getirir.

**Başarılı Yanıt (200 OK):**
```json
{
    "status": true,
    "data": {
        "id": 1,
        "name": "Pozitif Estetik Kliniği",
        "domain_prefix": "pozitif",
        "logo_url": null,
        "phone": "0212 123 45 67",
        "email": "info@pozitifklinik.com",
        "website": "https://www.pozitifklinik.com",
        "address": "Kadıköy, İstanbul",
        "province_id": 34,
        "district_id": 3423,
        "tax_office": "Kadıköy Vergi Dairesi",
        "tax_number": "1234567890",
        "working_hours": {
            "pazartesi": {"open": true, "start": "09:00", "end": "18:00"},
            "sali": {"open": true, "start": "09:00", "end": "18:00"},
            "pazar": {"open": false, "start": "09:00", "end": "18:00"}
        },
        "description": "İstanbul'un en iyi estetik kliniği",
        "is_active": 1,
        "province_name": "İstanbul",
        "district_name": "Kadıköy"
    }
}
```

### `PUT /api/clinic/settings`
Klinik ayarlarını günceller.

**Payload:**
```json
{
    "name": "Pozitif Estetik Kliniği",
    "phone": "0212 123 45 67",
    "email": "info@pozitifklinik.com",
    "website": "https://www.pozitifklinik.com",
    "address": "Bağdat Cad. No:123 Kadıköy",
    "province_id": 34,
    "district_id": 3423,
    "tax_office": "Kadıköy Vergi Dairesi",
    "tax_number": "1234567890",
    "description": "İstanbul'un en iyi estetik kliniği",
    "working_hours": {
        "pazartesi": {"open": true, "start": "09:00", "end": "18:00"},
        "sali": {"open": true, "start": "09:00", "end": "18:00"},
        "pazar": {"open": false, "start": "09:00", "end": "18:00"}
    }
}
```

**Başarılı Yanıt (200 OK):**
```json
{
    "status": true,
    "message": "Klinik ayarları başarıyla güncellendi."
}
```
```

### `GET /api/services/stats`
Hizmet istatistiklerini döner.

**Başarılı Yanıt (200 OK):**
```json
{
  "status": true,
  "data": {
    "total": 15,
    "active": 12,
    "inactive": 3,
    "category_count": 4
  }
}
```

### `GET /api/services/{id}`
Tek bir hizmetin detaylarını getirir.

### `POST /api/services`
Yeni hizmet ekler.

**Payload:**
```json
{
  "name": "Botox Uygulaması",
  "code": "BTX-001",
  "description": "Yüz bölgesi botox uygulaması",
  "category": "Estetik",
  "price": 1500.00,
  "tax_rate": 20.00,
  "is_active": 1
}
```

**Başarılı Yanıt (201 Created):**
```json
{
  "status": true,
  "message": "Hizmet başarıyla oluşturuldu.",
  "data": { "id": 5 }
}
```

### `PUT /api/services/{id}`
Hizmet bilgilerini günceller. Payload POST ile aynıdır.

### `DELETE /api/services/{id}`
Hizmeti pasif yapar (soft delete).

---

## Domain API (Adisyon / Randevu Kalemleri)

Her randevuya birden fazla hizmet/işlem eklenebilir.

### `POST /api/appointments/{id}/items`
Randevuya hizmet/kalem ekler.

**Payload:**
```json
{
  "service_id": 5,        // Opsiyonel (Katalogdan seçildiyse)
  "item_name": "Botox",   // Manuel isim girilebilir
  "unit_price": 1500.00,
  "quantity": 1,
  "performer_id": 3       // İşlemi yapan doktor ID
}
```

### `DELETE /api/appointments/{id}/items/{itemId}`
Randevudan bir kalem siler.
---

## Web (SSR) Rotaları

Bu rotalar tarayıcı üzerinden doğrudan erişilen, Twig ile render edilen HTML sayfalarıdır.

### Platform Admin (Super Admin)

| Rota | Açıklama |
|------|----------|
| /platform/login | Platform Admin giriş sayfası |
| /platform/dashboard | Klinik listeleme ve yönetim paneli |
| /platform/clinic-settings?id={id} | Belirli bir kliniğin ayarları |

### Klinik Personeli

| Rota | Açıklama |
|------|----------|
| /admin/login | Klinik personeli giriş sayfası |
| /admin/patients | Hasta listesi ve kayıt sayfası |
| /admin/appointments | Randevu yönetim sayfası |
| /admin/personnel | Personel (Doktor/Sekreter) yönetim sayfası |
