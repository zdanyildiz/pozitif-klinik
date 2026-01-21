# Mimari Dokümantasyonu

## Genel Bakış

Pozitif Klinik, multi-tenant SaaS mimarisi üzerine kurulu bir klinik yönetim sistemidir. Backend, API-first yaklaşımıyla geliştirilmiş olup, tüm istemciler (web, mobil, admin paneli) için bir JSON API sunar.

---

## Mimarinin Ana Katmanları (Hibrit Mimari)
 ```
+-------------------+      +------------------------+      +---------------------+
|    İSTEMCİLER     |      |    PLATFORM ADMIN      |      |   KLİNİK KULLANICI  |
|   (Mobil App)     |      |  (Web App - SSR/Twig)  |      | (Web App - SSR/Twig)|
+-------------------+      +------------------------+      +---------------------+
         |                            |                             |
         +----------------------------+-----------------------------+
                                      |
                                      ▼
+---------------------------------------------------------------------+
|                      WEB SUNUCUSU (Nginx / Apache)                    |
|                      (public/index.php'ye yönlendirir)                |
+---------------------------------------------------------------------+
                                      |
                                      ▼
+---------------------------------------------------------------------+
|                     SLIM APP (public/index.php)                     |
|                                                                     |
|    +-----------------------------------------------------------+    |
|    |                        MIDDLEWARE                         |    |
|    |  CORS -> ErrorHandler -> AdminAuth -> TenantAuth -> ...   |    |
|    +-----------------------------------------------------------+    |
|                                |                                    |
|    +-----------------------------------------------------------+    |
|    |             ROUTING (Manual & Auto-Discovery)             |    |
|    |        /api/... -> Domain Controllers (JSON)              |    |
|    |        /admin/... -> Web Controllers (HTML/Twig)          |    |
|    +-----------------------------------------------------------+    |
|                                |                                    |
|    +-----------------------------------------------------------+    |
|    |                      DI CONTAINER (PHP-DI)                |    |
|    |          Services: Twig, Database, Repositories           |    |
|    +-----------------------------------------------------------+    |
|             /                                      \                |
|  +---------------------+                 +------------------------+ |
|  |   WEB CONTROLLERS   |                 |    DOMAIN CONTROLLERS  | |
|  |  (src/Web/Controllers)|               |    (src/Domain/...)    | |
|  +---------------------+                 +------------------------+ |
|             |                                        |              |
|             v                                        v              |
|  +---------------------+                 +------------------------+ |
|  |   VIEWS (Twig SSR)  |                 |    JSON RESPONSE       | |
|  |     (src/Views)     |                 |                        | |
|  +---------------------+                 +------------------------+ |
|             \                                        /              |
|              \------------------+-------------------/               |
|                                 |                                   |
|    +-----------------------------------------------------------+    |
|    |                  REPOSITORIES / SERVICES                  |    |
|    |                (İş mantığı ve veri erişimi)               |    |
|    +-----------------------------------------------------------+    |
|                                |                                    |
|    +-----------------------------------------------------------+    |
|    |                       DATABASE (PDO)                      |    |
|    |               (Veritabanı ile iletişim kurar)             |    |
|    +-----------------------------------------------------------+    |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Standart Yanıt Yapısı (Pozitif JSON Anayasası)

İstemci ile sunucu arasındaki tüm **API iletişimi**, "Tek Zar, Tek Format" prensibi gereği aynı zarf yapısında gerçekleşir. **Web (SSR) yanıtları** ise standart HTML döner ve bu JSON standartına tabi değildir.

**API Zarf Yapısı:**
```json
{
  "status": true,           // İşlem sonucu: true (başarılı) veya false (hatalı)
  "message": "Mesaj metni", // Kullanıcıya veya geliştiriciye not
  "data": { ... }           // Payload: Obje, Array veya null.
}
```

- **Backend Koruması:** `BaseController` içindeki `success()` ve `error()` metodları bu formatı zorunlu kılar.
- **Hata Koruması:** `HttpErrorHandler`, Framework veya veritabanı seviyesindeki her türlü hatayı otomatik olarak bu formata dönüştürür.

---

## Hibrit Frontend Yaklaşımı (SSR + API)

Uygulama, hem SEO/Performans avantajları sağlayan SSR (Server-Side Rendering) hem de Mobil uyumluluk için API-First yaklaşımını birlikte kullanan hibrit bir mimariye geçiş yapmıştır.

- **Web App (src/Web + src/Views):** Klinik ve Platform kullanıcıları için kullanılan yönetim panelleri. Veriyi sunucuda işler ve **Twig Template Engine** kullanarak hazır HTML gönderir. Bu sayede:
    - İlk yükleme hızı artar.
    - SEO uyumluluğu sağlanır (gerektiğinde).
    - İstemci tarafında karmaşık JS mantığı (state management) ihtiyacı azalır.
    - Tek bir master layout (`layout.twig`) ile tüm proje genelinde tasarım tutarlılığı sağlanır.
- **Admin Panel (Platform):** Eski `/public/admin` ve `legacy` klasörleri altındaki statik HTML dosyaları tamamen temizlenmiş, projenin tamamı SSR/Twig yapısına dönüştürülmüştür.
- **Statik Dosyalar (Assets):** Tüm CSS, JS ve imaj dosyaları `public/assets` klasörü altında merkezi olarak yönetilmektedir.
- **İletişim:** 
    - **Web:** Sayfa geçişleri ve form işlemleri sunucu üzerinden (SSR) yapılır. Dinamik etkileşimler (Modal işlemleri, anlık istatistikler) için yine API (Axios) kullanılır.
    - **Mobil / API:** Tamamen RESTful endpoint'ler üzerinden haberleşir.

---

## Loglama Stratejisi

Etkili hata takibi ve sistem analizi için yapılandırılmış (structured) bir loglama stratejisi benimsenmiştir.

- **Monolog Kütüphanesi:** Tüm loglama işlemleri için endüstri standardı olan Monolog kullanılır.
- **Trace ID:** Sisteme gelen her bir HTTP isteği için benzersiz bir `trace_id` (UUID) oluşturulur. Bu `trace_id`, o isteğin yaşam döngüsü boyunca tüm log kayıtlarına eklenir. Bu sayede, belirli bir kullanıcının veya işlemin yarattığı tüm logları kolayca filtrelemek ve takip etmek mümkün olur.
- **Global Hata Yakalama (HttpErrorHandler):** Slim Framework'ün varsayılan `ErrorHandler`'ı, daha fazla detay loglayacak şekilde genişletilmiştir. Yakalanan herhangi bir `Exception` veya `Error`, standart bir JSON formatında ve ilgili `trace_id` ile birlikte log dosyasına yazılır. Bu, production ortamında hiçbir hatanın gözden kaçmamasını sağlar.

**Örnek Log Kaydı (var/logs/app.log):**
```
[2026-01-20T14:30:00.123456+03:00] app.ERROR: Veritabanı bağlantı hatası {"code":500,"message":"SQLSTATE[HY000] [2002] Connection refused"} {"url":"/api/patients","method":"GET","ip":"127.0.0.1","trace_id":"ab123cd-45ef-67gh-89ij-klm012nop345"}
```

---

## Otomatik Rota Keşfi (Auto-Discovery Routing)

### Yaklaşım: PHP 8 Attributes ile Sıfır Manuel Müdahale

Proje, modern PHP 8.2+ Attributes sistemini kullanarak otomatik rota keşfi yapar. `config/routes.php` dosyası artık statik rota tanımları içermez; bunun yerine `RouteRegistrar` sınıfı, `src/Domain` altındaki tüm Controller'ları otomatik tarar.

**Desteklenen Attribute'lar:**

| Attribute | Hedef | Açıklama |
|-----------|-------|----------|
| `#[Group('/prefix')]` | Sınıf | Tüm metodlar için URL prefix tanımlar |
| `#[Middleware(Class::class)]` | Sınıf/Metod | Koruma katmanı ekler (tekrarlanabilir) |
| `#[Route('METHOD', '/path')]` | Metod | HTTP endpoint tanımlar |

**Örnek Controller:**
```php
#[Group('/api/patients')]
#[Middleware(TenantMiddleware::class)]
class PatientController extends BaseController
{
    #[Route('GET', '')]
    public function listPatients(...) { ... }

    #[Route('POST', '/{id}/vitals')]
    public function addVital(...) { ... }
}
```

**Avantajlar:**
1. **Sıfır Manuel Müdahale:** Yeni Controller eklediğinizde `routes.php`'ye dokunmanız gerekmez.
2. **Tek Noktada Tanım:** Rota bilgisi metodun hemen üzerinde, kodla birlikte yaşar.
3. **IDE Desteği:** Attribute'lar IDE tarafından tanınır, otomatik tamamlama çalışır.
4. **Reflection Gücü:** Runtime'da tüm rotalar dinamik olarak keşfedilir.

**Dosya Yapısı:**
```
src/Core/
├── Attributes/
│   ├── Route.php       # Metod seviyesi rota tanımı
│   ├── Group.php       # Sınıf seviyesi prefix
│   └── Middleware.php  # Koruma katmanı (tekrarlanabilir)
└── RouteRegistrar.php  # Motor: Tarama ve kayıt
```

---

## Multi-Tenancy Stratejisi

### Yaklaşım: Shared Database, Shared Schema

Tüm klinikler (tenant'lar) aynı veritabanını ve aynı tablo şemasını paylaşır. Veri ayrımı, her tablodaki `clinic_id` sütunu ile sağlanır.

**Güvenlik Katmanları:**
1.  **`TenantMiddleware`**: Gelen isteğin `Authorization` başlığındaki JWT'yi doğrular, içindeki `clinic_id`'yi ayıklar ve isteğe bir attribute olarak ekler.
2.  **`BaseController` / `Repository` Katmanı**: Tüm veritabanı sorguları, isteğe eklenmiş olan bu `clinic_id` kullanılarak filtrelenir. Bu, bir kliniğin yanlışlıkla başka bir kliniğin verisine erişmesini engeller.

---

## Güvenlik Prensipleri

1.  **SQL Injection Koruması**: `PDO` üzerinden *her zaman* prepared statement kullanılır.
2.  **Kimlik Doğrulama (Authentication)**: `firebase/php-jwt` kütüphanesi ile JWT tabanlı token sistemi kullanılır.
3.  **Yetkilendirme (Authorization)**: Rol tabanlı yetki kontrolü (RBAC), özel bir middleware aracılığıyla sağlanacaktır. JWT içindeki `role` claim'i (`platform_admin`, `clinic_admin`, `doctor` vb.) kullanılır.
4.  **Veri İzolasyonu**: `clinic_id` ile tenant verilerinin birbirine karışması engellenir.
5.  **Girdi Doğrulama (Input Validation)**: İstemciden gelen tüm veriler, `respect/validation` gibi bir kütüphane ile controller katmanında doğrulanmalıdır.
6. **CSRF ve XSS Stratejisi (Stateless Security):**
   - Sistem **Stateless (Durumsuz)** mimaride olduğu ve oturum bilgisi Cookie yerine `localStorage` (Bearer Token) içinde tutulduğu için, klasik **CSRF (Cross-Site Request Forgery)** saldırılarına karşı mimari olarak korumalıdır. Bu nedenle CSRF Token kullanılmaz.
   - Bunun yerine, güvenliği sağlamak için **Strict CORS (Sıkı Köken Politikası)** ve **XSS (Cross-Site Scripting)** korumalarına odaklanılır. Production ortamında `Access-Control-Allow-Origin` sadece izin verilen domainlere açılır.
7.  **Sıfır Hardcoded Sır Politikası**: Kod içinde hiçbir şekilde API key, JWT secret veya veritabanı şifresi (fallback olarak bile) bulundurulamaz. Tüm hassas veriler sadece `.env` dosyasından okunmalıdır. Aksi durum denetimlerde kritik hata olarak işaretlenir.
8.  **Kriptografi ve Veri Şifreleme (Privacy by Design):**
    - **Depolama (AES-256-GCM):** Hasta hassas verileri (Ad Soyad, TC No, Telefon, Email, Adres) veritabanında AES-256-GCM algoritması ile şifrelenmiş olarak saklanır.
        - **IV (Initialization Vector):** Her şifreleme işlemi için benzersiz bir IV üretilir. Bu sayede aynı veri (örn. aynı isimli iki hasta) veritabanında tamamen farklı şifreli metinler olarak görünür.
        - **Bütünlük:** GCM modu, verinin şifrelendikten sonra değiştirilmediğini garanti eden bir "Authentication Tag" kullanır.
        - **Geri Döndürülebilirlik:** Şifrelenmiş veriler, `CryptoService::decrypt()` metodu kullanılarak her zaman orijinal haline geri döndürülebilir.
    - **Arama (Blind Index - HMAC-SHA256):** AES şifreleme her seferinde farklı sonuç (IV nedeniyle) ürettiği için veritabanı seviyesinde `WHERE name = '...'` gibi aramalar yapılamaz. Bu sorunu çözmek için "Blind Index" pattern'i uygulanır:
        - **Çalışma Mantığı:** Hassas verinin (örn. TC No) HMAC-SHA256 hash'i alınır ve ayrı bir kolonda (`tc_no_hash`) saklanır.
        - **Sabit Sonuç:** Aynı girdi (örn. aynı TC No) her zaman aynı hash sonucunu verir.
        - **Güvenli Arama:** Veritabanında arama yapılmak istendiğinde, aranan kelimenin hash'i alınır ve `WHERE tc_no_hash = '...'` sorgusu ile çok hızlı ve güvenli bir şekilde sonuç bulunur.
        - **Tek Yönlü Koruma:** Hash'ten orijinal veriye (TC No'nun kendisine) geri ulaşılamaz. Veritabanı çalınsa bile saldırgan gerçek kimlik bilgilerini elde edemez.
    - **Anahtar Yönetimi:** `APP_KEY` environment değişkeni (64 karakter hex) hem AES şifrelemesi hem de HMAC hash üretimi için ana bileşendir.
    - **CryptoService:** `src/Core/Security/CryptoService.php` tüm bu karmaşıklığı soyutlayarak `encrypt()`, `decrypt()` ve `blindIndex()` metodlarını sunar. Repo katmanı bu metodları kullanarak şifreleme/çözme işlemlerini şeffaf bir şekilde yönetir.


## Yazılım Kalite Standartları

Mimari bütünlüğü korumak ve teknik borcu önlemek için aşağıdaki katı kurallar uygulanır:

1.  **Strict Types:** Tüm PHP dosyaları `declare(strict_types=1);` ile başlamalı ve tüm metot parametreleri/dönüş değerleri tip korumalı olmalıdır.
2.  **Controller İçinde Logic Yasağı:**
    *   **NO RAW SQL:** Controller sınıflarında SQL sorgusu (`SELECT`, `INSERT`, vb.) yazmak kesinlikle yasaktır.
    *   **Repository Pattern:** Veritabanı ile yapılacak her türlü işlem, ilgili Domain'e ait bir `Repository` sınıfı üzerinden yapılmalıdır. Controller sadece Repository'i çağırır.
    *   **Transaction Yönetimi:** Çoklu tablo güncellemeleri gerektiren işlemler (örn: Klinik + Admin oluşturma) Repository veya Service katmanında `beginTransaction` / `commit` blokları içinde yönetilmelidir. Controller bu detaydan haberdar olmamalıdır.
3.  **Sessiz Hata Yasağı (No Silent Failures):**
    *   Boş `catch` blokları yasaktır.
    *   Hatalar ya anlamlı bir HttpHatası'na dönüştürülüp kullanıcıya sunulmalı ya da `HttpErrorHandler` tarafından yakalanması için `throw` edilmelidir.

