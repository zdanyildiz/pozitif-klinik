# 🏥 Pozitif Klinik - SaaS Backend API

**Global Pozitif Teknolojiler** için geliştirilen, Çoklu Kiracı (Multi-Tenant) mimarisine sahip Klinik Yönetim Sistemi (SaaS) backend projesi.

Bu proje **hız, güvenlik ve modülerlik** prensipleri üzerine kurulmuştur. Gereksiz karmaşadan uzak, `Slim Framework 4` üzerinde koşan saf ve güçlü bir API servisidir.

---

## 🛠 Teknoloji Yığını (Tech Stack)

* **Dil:** PHP 8.2+ (Strict Types)
* **Framework:** Slim Framework 4 (Micro-Framework)
* **Veritabanı:** MySQL 8.0 (Single DB, Multi-Tenant)
* **Bağımlılık Yönetimi:** Composer
* **Auth:** JWT (JSON Web Token) - `firebase/php-jwt`
* **Dependency Injection:** PHP-DI

---

## 📂 Mimari Yapı (Project Structure)

Proje **Domain Driven Design (DDD)** esintileri taşıyan modüler bir yapıdadır.

```text
/pozitif-klinik-backend
├── /config                 # DB, Route ve Middleware ayarları
├── /public
│   └── index.php           # Uygulama giriş noktası (Entry Point)
├── /src
│   ├── /Core               # Projenin motoru (Database, BaseController, Helpers)
│   ├── /Domain             # İŞ MANTIĞI (Modüller buraya eklenir)
│   │   ├── /Auth           # Login/Register işlemleri
│   │   ├── /Patient        # Hasta ve KVKK işlemleri
│   │   └── /Finance        # Cari/Kasa işlemleri
│   └── /Middleware         # Güvenlik katmanları (Cors, Tenant, Jwt)
├── .env                    # Hassas ortam değişkenleri
└── composer.json