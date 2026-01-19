# API Dokümantasyonu

## Genel Bilgiler

**Base URL:** Sunucu yapılandırmasına göre değişir (örn: `http://localhost/pozitif-klinik/public`)

**Authentication:** Tüm `/api/*` ve `/admin/*` endpoint'leri (login hariç) `Bearer <token>` JWT ile korunmaktadır.

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
  "message": "Giriş başarılı",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ..."
  }
}
```

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