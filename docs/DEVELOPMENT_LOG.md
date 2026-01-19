# Pozitif Klinik - Geliştirme Günlüğü

## Proje Bilgileri
- **Proje Adı:** Pozitif Klinik SaaS Backend
- **Teknoloji:** PHP 8.2, Slim Framework 4
- **Başlangıç Tarihi:** 2026-01-19

---

## Tamamlanan Görevler

### 1. Backend İskeleti (✅ Tamamlandı)
**Tarih:** 2026-01-19

#### Oluşturulan Klasör Yapısı:
```
Pozitif-Klinik/
├── config/
│   ├── settings.php
│   └── container.php
├── public/
│   └── index.php
├── src/
│   ├── Core/
│   │   └── Database.php
│   ├── Domain/
│   └── Middleware/
├── docs/
├── .env.example
└── composer.json
```

#### Oluşturulan Dosyalar:

**composer.json** - Bağımlılıklar:
- `slim/slim`: ^4.14
- `slim/psr7`: ^1.7
- `php-di/php-di`: ^7.0
- `firebase/php-jwt`: ^6.10
- `vlucas/phpdotenv`: ^5.6
- `monolog/monolog`: ^3.8

**public/index.php** - Giriş noktası:
- Dotenv ile .env yükleme
- PHP-DI ContainerBuilder
- Error Middleware (development mode)
- CORS Middleware (Allow All)
- OPTIONS request handler

---

### 2. Veritabanı Katmanı (✅ Tamamlandı)
**Tarih:** 2026-01-19

#### config/settings.php
- `.env` dosyasından DB ayarlarını okur
- PDO flag'leri tanımlar (ERRMODE_EXCEPTION, FETCH_ASSOC, utf8mb4)

#### src/Core/Database.php
- **Singleton Pattern** kullanır
- PDO bağlantısını try-catch içinde kurar
- Helper metodlar:
  - `getInstance(array $settings)`: Singleton instance döner
  - `getConnection()`: Raw PDO bağlantısı
  - `query($sql, $params)`: Prepared statement çalıştırır
  - `fetch($sql, $params)`: Tek satır döner
  - `fetchAll($sql, $params)`: Tüm satırları döner
- SQL Injection koruması: Tüm sorgular prepared statement kullanır

#### config/container.php
- Database sınıfını DI Container'a ekler
- PDO alias tanımlar

---

### 3. Multi-Tenancy Middleware (✅ Tamamlandı)
**Tarih:** 2026-01-19
**Dosya:** `/src/Middleware/TenantMiddleware.php`

#### Özellikler:
- **PSR-15 MiddlewareInterface** implementasyonu
- Authorization header kontrolü (`Bearer <token>` formatı)
- `firebase/php-jwt` ile token decode (HS256 algoritması)
- Token içinde `clinic_id` claim kontrolü
- Request attribute olarak `clinic_id` ve `jwt_payload` ekleme

#### Hata Durumları:
| Durum | HTTP Kodu | Mesaj |
|-------|-----------|-------|
| Token yok | 401 | Authorization header bulunamadı |
| Geçersiz format | 401 | Geçersiz Authorization header formatı |
| Token süresi dolmuş | 401 | Token süresi dolmuş |
| Geçersiz imza | 401 | Geçersiz token imzası |
| clinic_id yok | 403 | Klinik kimliği bulunamadı |

#### Örnek Kullanım:
```php
// Route'a middleware ekle
$app->get('/api/patients', PatientController::class . ':list')
    ->add(new TenantMiddleware());

// Controller'da clinic_id'ye erişim
$clinicId = $request->getAttribute('clinic_id');
```

---

## Bekleyen Görevler

### 4. Auth Controller (⏳ Bekliyor)
**Dosya:** `/src/Domain/Auth/AuthController.php`

**Yapılacaklar:**
1. Login endpoint (`POST /auth/login`)
2. Kullanıcı doğrulama
3. JWT token oluşturma
4. Token refresh mekanizması

### 5. Base Controller (✅ Tamamlandı)
**Tarih:** 2026-01-19
**Dosya:** `/src/Core/BaseController.php`

#### Özellikler:
- **Abstract sınıf** - Tüm controllerlar buradan türer
- **DI Container** injection via constructor
- **Database** erişimi `$this->db` üzerinden

#### Metodlar:
| Metod | Açıklama |
|-------|----------|
| `jsonResponse()` | Ham JSON yanıtı oluşturur |
| `successResponse()` | Başarılı işlem yanıtı `{status: true, message, data}` |
| `errorResponse()` | Hata yanıtı `{status: false, message, errors}` |
| `notFoundResponse()` | 404 yanıtı |
| `forbiddenResponse()` | 403 yanıtı |
| `createdResponse()` | 201 Created yanıtı |
| `validationErrorResponse()` | 422 Validation hatası |
| `getClinicId()` | Request'ten clinic_id al |
| `getUserId()` | Request'ten user_id al |
| `getJwtPayload()` | Request'ten JWT payload al |

#### Örnek Kullanım:
```php
class PatientController extends BaseController
{
    public function list(Request $request, Response $response): Response
    {
        $clinicId = $this->getClinicId($request);
        $patients = $this->db->fetchAll(
            "SELECT * FROM patients WHERE clinic_id = ?",
            [$clinicId]
        );
        return $this->successResponse($response, $patients);
    }
}
```

---

## Ortam Değişkenleri (.env)

```env
APP_ENV=development
APP_DEBUG=true
DB_HOST=localhost
DB_NAME=pozitif_klinik
DB_USER=root
DB_PASS=
JWT_SECRET=changeme
```

---

## Notlar

### CORS Politikası Notu
`public/index.php` dosyasında tanımlanan `CORS Middleware (Allow All)` sadece geliştirme ortamı için geçerlidir. Production ortamında, güvenlik nedeniyle sadece izin verilen domain'lere erişim hakkı tanınmalıdır. Bu ayar, `config/settings.php` üzerinden yönetilmeli ve production ortamında `.env` dosyasından okunmalıdır.

### PHP CLI Kullanımı
XAMPP kurulumunda PHP CLI şu konumda:
```bash
/opt/lampp/bin/php
```

### Test Komutu
```bash
/opt/lampp/bin/php test_db.php
```

### Composer Kurulumu
```bash
cd /opt/lampp/htdocs/Pozitif-Klinik
/opt/lampp/bin/php /path/to/composer.phar install
```
