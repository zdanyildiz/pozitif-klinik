# Pozitif Klinik SaaS (v3.0)

Pozitif Klinik, modern PHP standartları üzerine inşa edilmiş, yüksek güvenlikli, ölçeklenebilir ve çoklu kiracı (multi-tenant) destekli bir klinik yönetim sistemidir.

Proje, **Hibrit Monolit (Hybrid Monolith)** mimarisini benimser:
1.  **API Katmanı (`src/Domain`):** Mobil ve harici entegrasyonlar için JSON tabanlı, stateless yapı.
2.  **Web Katmanı (`src/Web`):** Yönetim paneli için Server-Side Rendering (Twig) kullanan, session tabanlı yapı.

---

## 🚀 Teknolojiler ve Gereksinimler

* **Dil:** PHP 8.2+ (Strict Types zorunludur)
* **Framework:** Slim 4 (Micro-framework)
* **Template Engine:** Twig (Web arayüzü için)
* **Veritabanı:** MySQL / MariaDB
* **Frontend:** Vanilla JS + Bootstrap (Server-side render edilmiş HTML üzerine)
* **Güvenlik:**
    * AES-256-GCM (Hasta verileri şifreleme)
    * Sodium (Blind Indexing)
    * CSRF Protection (Web formları için)
    * Rate Limiting (API ve Login koruması)

---

## 🛠️ Kurulum (Installation)

### 1. Projeyi Klonlayın
```bash
git clone [https://github.com/pozitif-klinik/backend.git](https://github.com/pozitif-klinik/backend.git)
cd backend

```

### 2. Bağımlılıkları Yükleyin

Composer paket yöneticisini kullanarak kütüphaneleri indirin:

```bash
composer install

```

### 3. Çevresel Değişkenler (.env)

Örnek dosyayı kopyalayın ve kendi ayarlarınızı yapın:

```bash
cp .env.example .env

```

* `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` alanlarını doldurun.
* `APP_KEY`: 32-byte (64 karakter hex) rastgele bir anahtar oluşturun (Güvenlik için kritik!).
* `JWT_SECRET`: JWT imzalama anahtarını belirleyin.

### 4. Veritabanı Kurulumu

SQL dosyalarını sırasıyla içe aktarın:

1. `migration/database/schema.sql` (Ana Tablolar)
2. `migration/database/modules/*.sql` (Modüller: System, Patient, Clinic, Email, Security)
3. `migration/database/seed_locations.sql` (İl/İlçe Verileri)

### 5. Uygulamayı Başlatın

Yerel geliştirme sunucusunu başlatın:

```bash
php -S localhost:8080 -t public

```

Artık tarayıcıdan `http://localhost:8080/admin/login` adresine gidebilirsiniz.

---

## 🏗️ Mimari Yapı (Architecture)

Proje **Action-Domain-Responder (ADR)** benzeri bir yapıda, ancak MVC terminolojisi ile düzenlenmiştir.

### Klasör Yapısı

```
src/
├── Core/           # Çekirdek bileşenler (Database, Crypto, Routing, Middleware)
├── Domain/         # API ve İş Mantığı (JSON Response)
│   ├── Patient/    # Hasta modülü (Repository, Service, API Controller)
│   └── ...
├── Web/            # Web Arayüzü (HTML Response)
│   ├── Controllers/# Twig render eden controller'lar
│   └── Middleware/ # Web'e özel middleware (Session, CSRF)
└── Views/          # Twig şablon dosyaları (.twig)

```

### Routing (Yönlendirme)

Bu projede `config/routes.php` dosyasına manuel rota eklenmez. **PHP 8 Attributes** kullanılır.

**Örnek Web Controller:**

```php
#[Group('/admin')]
#[Middleware(SessionAuthMiddleware::class)]
class PatientWebController {
    #[Route('/patients', methods: ['GET'])]
    public function index(...) { ... }
}

```

### Güvenlik Kuralları

1. **Veri İzolasyonu:** `.twig` dosyalarında asla veritabanı sorgusu çalıştırılmaz.
2. **Strict Types:** Tüm PHP dosyaları `declare(strict_types=1);` ile başlamalıdır.
3. **Süper Globaller:** `$_SESSION`, `$_GET`, `$_POST` doğrudan kullanılmaz. `SessionService` veya `$request` nesnesi kullanılır.
4. **Şifreleme:** Hasta TC, Telefon ve Adres bilgileri veritabanında şifreli saklanır (`CryptoService`).

---

## 🧪 Testler

```bash
# Veritabanı bağlantı testi
php tests/test_db.php

```

---

## 📜 Lisans

Bu proje **Proprietary (Özel Mülk)** lisanslıdır. İzinsiz kopyalanması, dağıtılması yasaktır.
Copyright © 2024 Pozitif Global Teknolojiler.
