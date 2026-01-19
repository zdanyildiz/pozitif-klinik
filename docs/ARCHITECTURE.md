# Mimari Dokümantasyonu

## Genel Bakış

Pozitif Klinik, multi-tenant SaaS mimarisi kullanan bir klinik yönetim sistemidir.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│                   (React Frontend)                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     PUBLIC/INDEX.PHP                         │
│                    (Entry Point)                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      MIDDLEWARE                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │    CORS     │→ │TenantMiddle- │→ │     Auth          │  │
│  │             │  │    ware      │  │   Middleware      │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       ROUTER                                 │
│              (Slim Framework Routes)                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     CONTROLLERS                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Auth    │  │ Patient  │  │Appointment│  │ Reports  │   │
│  │Controller│  │Controller│  │Controller │  │Controller│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      SERVICES                                │
│              (Business Logic Layer)                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     REPOSITORIES                             │
│               (Data Access Layer)                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE (PDO)                             │
│                     MySQL/MariaDB                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Klasör Yapısı

```
Pozitif-Klinik/
├── config/                 # Konfigürasyon dosyaları
│   ├── settings.php        # Uygulama ayarları
│   └── container.php       # DI Container tanımları
│
├── docs/                   # Dokümantasyon
│   ├── DEVELOPMENT_LOG.md  # Geliştirme günlüğü
│   ├── API.md              # API dokümantasyonu
│   └── ARCHITECTURE.md     # Mimari dokümantasyonu
│
├── public/                 # Web root (public erişim)
│   └── index.php           # Tek giriş noktası
│
├── src/                    # Uygulama kaynak kodu
│   ├── Core/               # Çekirdek sınıflar
│   │   ├── Database.php    # PDO wrapper (Singleton)
│   │   └── BaseController.php
│   │
│   ├── Domain/             # İş alanı modülleri
│   │   ├── Auth/           # Kimlik doğrulama
│   │   ├── Patient/        # Hasta yönetimi
│   │   ├── Appointment/    # Randevu yönetimi
│   │   └── ...
│   │
│   └── Middleware/         # HTTP Middleware'ler
│       ├── TenantMiddleware.php
│       └── ...
│
├── var/                    # Değişken veriler
│   ├── cache/              # Container cache
│   └── logs/               # Log dosyaları
│
├── .env                    # Ortam değişkenleri (git'e eklenmez)
├── .env.example            # Örnek ortam değişkenleri
├── composer.json           # PHP bağımlılıkları
└── composer.lock           # Kilitli bağımlılık versiyonları
```

---

## Multi-Tenancy Stratejisi

### Yaklaşım: Shared Database, Shared Schema

Tüm klinikler aynı veritabanını ve tabloları paylaşır. Her tablo `clinic_id` sütunu içerir.

```sql
CREATE TABLE patients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    clinic_id INT NOT NULL,  -- Multi-tenancy key
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    ...
    INDEX idx_clinic_id (clinic_id)
);
```

### Güvenlik Katmanları

1. **TenantMiddleware**: JWT'den `clinic_id` çıkarır, request attribute olarak ekler
2. **Request Attributes**: 
   - `clinic_id`: Klinik kimliği (int)
   - `jwt_payload`: Tüm token verisi (stdClass)
3. **Repository Layer**: Tüm sorgular `clinic_id` ile filtrelenir

```php
// TenantMiddleware'den sonra Controller'da kullanım
public function list(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
{
    $clinicId = $request->getAttribute('clinic_id');
    $jwtPayload = $request->getAttribute('jwt_payload');
    
    // Sadece bu kliniğe ait verileri getir
    $patients = $this->patientRepository->findAll($clinicId);
    // ...
}

// Örnek: PatientRepository
public function findAll(int $clinicId): array
{
    return $this->db->fetchAll(
        "SELECT * FROM patients WHERE clinic_id = ?",
        [$clinicId]
    );
}
```

---

## Bağımlılık Enjeksiyonu (DI)

PHP-DI container kullanılır. Tüm servisler `config/container.php` içinde tanımlanır.

```php
// Örnek container tanımı
return [
    Database::class => function (ContainerInterface $c) {
        $settings = $c->get('settings');
        return Database::getInstance($settings['settings']['db']);
    },
    
    PatientRepository::class => function (ContainerInterface $c) {
        return new PatientRepository($c->get(Database::class));
    },
];
```

---

## Güvenlik Prensipleri

1. **SQL Injection**: Tüm sorgular Prepared Statement kullanır
2. **Authentication**: JWT tabanlı token sistemi
3. **Authorization**: Role-based access control (RBAC)
4. **Data Isolation**: clinic_id ile tenant izolasyonu
5. **Input Validation**: Tüm girdiler validate edilir
6. **CORS**: Kontrollü cross-origin erişim

---

## Detaylı Güvenlik Stratejileri

### Input Validation (Girdi Doğrulama)

Tüm kullanıcı girdileri, Controller katmanında `respect/validation` kütüphanesi kullanılarak doğrulanmalıdır. Bu, hem veri bütünlüğünü sağlar hem de XSS gibi zafiyetleri engeller.

**Örnek:** Yeni bir hasta kaydı oluşturulurken yapılacak validasyon.

```php
// PatientController içinde
use Respect\Validation\Validator as v;

// ...

$data = $request->getParsedBody();

$validator = v::key('first_name', v::stringType()->length(2, 100))
             ->key('last_name', v::stringType()->length(2, 100))
             ->key('email', v::email())
             ->key('phone', v::oneOf(v::nullType(), v::phone()));

try {
    $validator->assert($data);
    // Veri geçerli, devam et
} catch (\Respect\Validation\Exceptions\NestedValidationException $exception) {
    // Hataları BaseController'daki validationErrorResponse ile döndür
    return $this->validationErrorResponse($response, $exception->getMessages());
}
```

Bu yaklaşım, validasyon kurallarını merkezi ve okunabilir bir şekilde yönetmemizi sağlar.

### Authorization (Yetkilendirme) - RBAC

Yetkilendirme, `role` claim'ini JWT token içinden okuyan özel bir `AuthMiddleware` ile sağlanacaktır. Bu middleware, `TenantMiddleware`'den *sonra* çalışmalıdır.

**Roller:**
- `admin`: Tüm işlemleri yapabilir.
- `doctor`: Sadece kendi hastalarını ve randevularını yönetebilir.
- `receptionist`: Hasta kaydı ve randevu yönetimi yapabilir, tıbbi kayıtlara erişemez.

**`AuthMiddleware` Mimarisi:**

1.  Request'ten `jwt_payload` attribute'unu okur (`TenantMiddleware` tarafından eklenir).
2.  `role` claim'ini alır.
3.  Gidilmek istenen rotanın gerektirdiği minimum rol seviyesini kontrol eder.
4.  Yetki yetersizse `403 Forbidden` hatası döndürür.

**Rota Tanımlaması (Örnek):**

Rol bazlı yetkilendirme, rota grupları ve middleware argümanları ile yönetilebilir.

```php
// config/routes.php içinde

$app->group('/api', function (RouteCollectorProxy $group) {
    
    // Sadece admin erişebilir
    $group->group('/reports', function (RouteCollectorProxy $reportsGroup) {
        $reportsGroup->get('', \App\Domain\Reports\ReportsController::class . ':generate');
    })->add(new AuthMiddleware('admin')); // Gerekli minimum rol

    // Doktor veya admin erişebilir
    $group->group('/patients/{id}/medical-records', function (RouteCollectorProxy $recordsGroup) {
        $recordsGroup->get('', \App\Domain\Patient\PatientController::class . ':getMedicalRecords');
        $recordsGroup->post('', \App\Domain\Patient\PatientController::class . ':addMedicalRecord');
    })->add(new AuthMiddleware('doctor'));

    // Resepsiyonist, doktor veya admin erişebilir
    $group->get('/patients', \App\Domain\Patient\PatientController::class . ':list')
          ->add(new AuthMiddleware('receptionist'));

})->add(TenantMiddleware::class);
```