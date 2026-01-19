# API Dokümantasyonu

## Genel Bilgiler

**Base URL:** `http://localhost/Pozitif-Klinik/public`

**Content-Type:** `application/json`

**Authentication:** Bearer Token (JWT)

---

## Endpoints

### Health Check

```
GET /
```

**Response:**
```
Pozitif Klinik Backend is Running!
```

---

## Authentication

### Token Yapısı

JWT Token içinde aşağıdaki claim'ler bulunmalı:

```json
{
  "iat": 1737304605,
  "exp": 1737308205,
  "clinic_id": 1,
  "user_id": 123,
  "role": "admin"
}
```

### Header Formatı

```
Authorization: Bearer <token>
```

---

## Error Responses

Tüm hata yanıtları aşağıdaki formatta döner:

```json
{
  "success": false,
  "error": {
    "code": <HTTP_STATUS_CODE>,
    "message": "<Hata mesajı>"
  }
}
```

### 401 Unauthorized
Token eksik veya geçersiz.

```json
{
  "success": false,
  "error": {
    "code": 401,
    "message": "Authorization header bulunamadı"
  }
}
```

**Olası Mesajlar:**
- `Authorization header bulunamadı`
- `Geçersiz Authorization header formatı`
- `Token süresi dolmuş`
- `Geçersiz token imzası`
- `Token doğrulama hatası: <detay>`

### 403 Forbidden
Token geçerli ama `clinic_id` claim'i yok.

```json
{
  "success": false,
  "error": {
    "code": 403,
    "message": "Klinik kimliği bulunamadı"
  }
}
```

### 500 Internal Server Error
Sunucu hatası.

```json
{
  "success": false,
  "error": {
    "code": 500,
    "message": "Bir hata oluştu"
  }
}
```

---

## Multi-Tenancy

Her istek `clinic_id` ile izole edilir. Token içindeki `clinic_id` değeri:
- Request attribute olarak eklenir
- Tüm veritabanı sorgularında filtre olarak kullanılır
- Farklı kliniklerin verilerine erişim engellenir
