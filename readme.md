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
├── /migration/database     # Veritabanı tabloları ve migration dosyaları
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

🚀 Kurulum (Installation)
1. Projeyi Klonlayın
Bash
git clone [https://github.com/zdanyildiz/pozitif-klinik.git)
cd pozitif-klinik-backend
2. Bağımlılıkları Yükleyin
Bash
composer install
3. Ortam Ayarlarını Yapın
Örnek dosyayı kopyalayın ve kendi veritabanı bilgilerinizi girin:

Bash
cp .env.example .env
.env dosyasını açın ve düzenleyin:

Ini, TOML
DB_HOST=localhost
DB_NAME=pozitif_klinik_db
DB_USER=root
DB_PASS=sifreniz

JWT_SECRET=cok_gizli_ve_karmasik_bir_anahtar_buraya
4. Veritabanını Oluşturun
/migration/database/schema.sql dosyasındaki SQL komutlarını çalıştırarak tabloları oluşturun.

5. Sunucuyu Başlatın
Geliştirme ortamı için PHP'nin dahili sunucusunu kullanabilirsiniz:

Bash
php -S localhost:8080 -t public
🛡️ Güvenlik ve Geliştirme Kuralları (ÖNEMLİ)

### ⚠️ HATA YÖNETİMİ VE FALLBACK POLİTİKASI (ÇOK ÖNEMLİ)

**BU PROJEDE "SILENT FAILURE" (SESSİZ HATA) KESİNLİKLE YASAKTIR!**

1.  **Fallback Kullanımı Yasak:** Bir veri bulunamadığında veya hata oluştuğunda asla "varsayılan değer" (boş string, null, 0 vb.) döndürüp işleyişe devam etmeyin.
2.  **Hata Fırlatın (Fail Fast):**
    - Veritabanı bağlantısı koptuysa -> `500 Internal Server Error` fırlatın.
    - Token geçersizse -> `401 Unauthorized` fırlatın.
    - Zorunlu alan eksikse -> `400 Bad Request` fırlatın.
3.  **Development Modu:** Şu an geliştirme aşamasındayız. Hataları ekrana basmak (Stack Trace), sorunu halı altına süpürmekten çok daha değerlidir. `try-catch` bloklarını hatayı yutmak için değil, loglamak ve anlamlı bir HTTP hatası döndürmek için kullanın.

### 🛠 GELİŞTİRME DÜZENİ (KESİN TALİMATLAR)

1.  **Geçici ve Test Dosyaları:** Geliştirme sürecinde oluşturduğunuz tüm geçici scriptler, test dosyaları ve deneme amaçlı kodlar **KESİNLİKLE** kök dizinde değil, `/tests` dizini altında oluşturulmalıdır.
2.  **Veritabanı Değişiklikleri (Migrations):** Tüm SQL dosyaları, tablo oluşturma scriptleri ve veritabanı güncellemeleri `/migration/database` dizini altında tutulmalıdır. Manuel olarak veritabanında yapılan her değişikliğin bir SQL karşılığı bu dizine eklenmelidir.

Bu projede çalışan tüm geliştiriciler (ve AI Ajanları) aşağıdaki kurallara uymak zorundadır:

1. Multi-Tenancy (Kiracı Ayrımı)
Bu sistem Tek Veritabanı, Paylaşımlı Şema kullanır.

KURAL: Her SQL sorgusunda (INSERT, SELECT, UPDATE, DELETE) mutlaka WHERE clinic_id = ? koşulu olmak zorundadır.

Bu kontrolü manuel yapmamak için BaseRepository sınıfını kullanın.

clinic_id verisi asla kullanıcıdan (POST body/GET param) alınmaz! Daima JWT Token içinden ($request->getAttribute('clinic_id')) alınır.

2. SQL Güvenliği
❌ YASAK: query("SELECT * FROM users WHERE name = '$name'") (String birleştirme).

✅ DOĞRU: $db->query("SELECT * FROM users WHERE name = ?", [$name]) (Prepared Statements).

ORM kullanılmamaktadır, src/Core/Database.php wrapper sınıfını kullanın.

3. Kod Standartları
PSR-12 kodlama standartlarına uyun.

Değişken ve fonksiyon isimleri İngilizce ve camelCase olmalıdır.

SQL Tablo isimleri: sys_ (Sistem), ptn_ (Hasta), cln_ (Klinik), fin_ (Finans) ön eklerini alır.

### 🎨 FRONTEND KOD AYIRIMI (INLINE CSS/JS YASAĞI)

**BU PROJEDE INLINE CSS VE JAVASCRIPT KODU YAZMAK KESİNLİKLE YASAKTIR!**

HTML dosyalarında `<style>` ve `<script>` etiketleri içinde kod yazmak **YASAKTIR**. Tüm stiller ve JavaScript kodları harici dosyalara ayrılmalıdır.

#### ❌ YANLIŞ (YASAK):
```html
<style>
    body { background: red; }
</style>

<script>
    function doSomething() { ... }
</script>
```

#### ✅ DOĞRU:
```html
<link rel="stylesheet" href="css/style.css">
<script src="js/app.js"></script>
```

#### Dosya Yapısı:
```
/public/admin/
├── index.html
├── dashboard.html
├── css/
│   ├── variables.css     # CSS değişkenleri
│   ├── base.css          # Temel stiller
│   ├── components.css    # Bileşen stilleri
│   └── pages/
│       ├── login.css
│       └── dashboard.css
└── js/
    ├── config.js         # API config, axios ayarları
    ├── utils.js          # Yardımcı fonksiyonlar
    └── pages/
        ├── login.js
        └── dashboard.js
```

**NEDEN?**
1. **Bakım Kolaylığı:** Ayrı dosyalar, kodun bulunmasını ve düzenlenmesini kolaylaştırır.
2. **Önbellekleme:** Tarayıcı harici dosyaları önbelleğe alabilir, sayfa yüklenme hızı artar.
3. **Separation of Concerns:** İçerik (HTML), stil (CSS) ve davranış (JS) birbirinden ayrılmalıdır.
4. **Kod Tekrarını Önler:** Ortak stiller ve fonksiyonlar tek bir yerden yönetilir.

🔌 API Kullanımı (Örnekler)
Tüm yanıtlar JSON formatındadır.

Başarılı Yanıt:

JSON
{
    "status": true,
    "message": "İşlem başarılı",
    "data": { ... }
}
Hatalı Yanıt:

JSON
{
    "status": false,
    "message": "Hata açıklaması"
}
🤝 Katkıda Bulunma
Yeni bir modül ekleyecekseniz /src/Domain altına yeni klasör açın.

config/routes.php dosyasına endpoint'lerinizi ekleyin.

Pull Request açmadan önce composer check-style (eğer tanımlıysa) çalıştırın.

Global Pozitif Teknolojiler Yazılım Ekibi