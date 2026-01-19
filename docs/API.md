# API Dokümantasyonu

## Genel Bilgiler

**Base URL:** Sunucu yapılandırmasına göre değişir (örn: `http://localhost/pozitif-klinik/public`)

**Authentication:** Tüm `/api/*` ve `/admin/*` endpoint'leri (login hariç) `Bearer <token>` JWT ile korunmaktadır.

---

## Hata Yanıt Formatı

Tüm hata yanıtları (`4xx`, `5xx`) standart bir formatta döner:

```json
{
    "statusCode": 401,
    "error": {
        "type": "UNAUTHENTICATED",
        "description": "Token süresi dolmuş"
    },
    "trace_id": "ab123cd-45ef-67gh-89ij-klm012nop345"
}
```

---

## Public API

Bu endpoint'ler, klinik kullanıcılarının (doktor, resepsiyonist vb.) mobil veya web uygulamaları üzerinden erişimi içindir.

### `POST /auth/login`

Klinik kullanıcısının sisteme giriş yapmasını ve JWT almasını sağlar.

**Payload:**
```json
{
  "username": "doktor_ahmet",
  "password": "secure_password"
}
```

**Başarılı Yanıt (200 OK):**
```json
{
  "status": true,
  "message": "Giriş başarılı.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MzczMDQ2MDUsImV4cCI6MTczNzMwODIwNSwiY2xpbmljX2lkIjoxLCJ1c2VyX2lkIjoxMjMsInJvbGUiOiJkb2N0b3IifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
  }
}
```

---

## Platform API (Admin)

Bu endpoint'ler, sadece platform yöneticisinin (root admin) erişebileceği, klinik yönetimiyle ilgili işlemler içindir. Tüm istekler `PlatformAdminMiddleware` tarafından kontrol edilir.

### `POST /admin/login`

Platform yöneticisinin (root) sisteme giriş yapmasını sağlar. Bu token, diğer `/admin` endpoint'lerine erişim için gereklidir.

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
  "message": "Giriş başarılı.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MzczMDQ2MDUsImV4cCI6MTczNzMwODIwNSwicm9sZSI6InBsYXRmb3JtX2FkbWluIn0.aBcDeFgHiJkLmNoPqRsTuVwXyZ"
  }
}
```

### `POST /admin/tenants`

Yeni bir klinik (tenant) oluşturur.

**Gerekli Yetki:** Platform Admin

**Payload:**
```json
{
  "name": "Yeni Test Kliniği",
  "domain_prefix": "yeniklinik",
  "admin_email": "admin@yeniklinik.com",
  "admin_password": "strong_password123",
  "is_active": true
}
```
*   `domain_prefix`: Sisteme girişte kullanılacak alt alan adı (subdomain) gibi düşünülebilir. Benzersiz olmalıdır.

**Başarılı Yanıt (201 Created):**
```json
{
    "status": true,
    "message": "Klinik başarıyla oluşturuldu.",
    "data": {
        "tenant_id": 5
    }
}
```

### `GET /admin/tenants`

Sistemdeki tüm klinikleri listeler.

**Gerekli Yetki:** Platform Admin

**Başarılı Yanıt (200 OK):**
```json
{
    "status": true,
    "message": "Klinikler listelendi.",
    "data": [
        {
            "id": 1,
            "name": "Merkez Diş Kliniği",
            "domain_prefix": "merkezdis",
            "is_active": 1,
            "created_at": "2026-01-19 10:00:00",
            "updated_at": "2026-01-19 10:00:00"
        },
        {
            "id": 2,
            "name": "Hayat Fizik Tedavi",
            "domain_prefix": "hayatftr",
            "is_active": 1,
            "created_at": "2026-01-20 11:30:00",
            "updated_at": "2026-01-20 11:30:00"
        }
    ]
}
```