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
