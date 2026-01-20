# API Dokümantasyonu

## Genel Bilgiler

**Base URL:** Sunucu yapılandırmasına göre değişir (örn: `http://localhost/pozitif-klinik/public`)

**Authentication:** Tüm `/api/*` ve `/admin/*` endpoint'leri (login hariç) `Bearer <token>` JWT ile korunmaktadır.

**Routing:** Tüm rotalar PHP 8 Attributes (`#[Route]`, `#[Group]`, `#[Middleware]`) ile Controller sınıflarında tanımlanır ve `RouteRegistrar` tarafından otomatik keşfedilir.

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

### `GET /`
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

## Platform API (Admin)

Bu endpoint'ler, sadece platform yöneticisinin (root admin) erişebileceği, klinik yönetimiyle ilgili işlemler içindir.

### `POST /admin/login`

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

### `POST /admin/tenants`

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

### `PUT /admin/tenants/{id}`

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

### `GET /admin/tenants`

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
```

---

## Domain API (Hasta Yönetimi)

Bu endpoint'ler klinik bazlı veri izolasyonu (Multi-Tenancy) sağlar. `clinic_id` JWT token'dan otomatik alınır.

### `GET /api/patients`
Aktif hastaları listeler (`status = 1`).

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
  "address": "İstanbul, Türkiye",
  "notes": "Alerjisi var"
}
```

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