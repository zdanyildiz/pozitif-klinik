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
- **Hibrit Kimlik Doğrulama:** Güvenlik middleware'leri (`TenantMiddleware`, `PlatformAdminMiddleware`) hem JWT token hem de Session tabanlı kimlik doğrulamayı destekler. Bu sayede:
    - **Web Paneli:** Kullanıcı SSR ile (Session cookie) giriş yapar, ardından aynı oturumda frontend'den yapılan API çağrıları (hasta detayları vb.) middleware tarafından Session üzerinden doğrulanır.
    - **Mobil Uygulama:** Stateless JWT Bearer Token kullanarak tüm API endpoint'lerine erişir.

---

## Loglama Stratejisi

Etkili hata takibi ve sistem analizi için yapılandırılmış (structured) bir loglama stratejisi benimsenmiştir.

- **Monolog Kütüphanesi:** Tüm loglama işlemleri için endüstri standardı olan Monolog kullanılır.
- **Klinik Bazlı Loglama (Tenant-Aware Logging):**
    - Her kliniğin logları `var/logs/clinic_{id}/` altında izole edilmiş klasörlerde tutulur.
    - Ana sistem logları (login öncesi veya global hatalar) `var/logs/app.log` dosyasına yazılır.
    - `LoggerService` servisi, isteğin bağlamına göre (context) doğru log dosyasını otomatik seçer.
- **Log Seviyeleri ve Optimizasyon:**
    - **Canlı Ortam (Production):** Varsayılan log seviyesi `WARNING` veya `ERROR` olarak ayarlanır. Gereksiz I/O yükünü önlemek için başarılı istekler (200 OK) ve rutin 404 hataları `DEBUG` seviyesine çekilmiştir.
    - **Geliştirme Ortamı:** Tüm detaylar görüntülenebilir.
- **Trace ID:** Sisteme gelen her bir HTTP isteği için benzersiz bir `trace_id` (UUID) oluşturulur.
- **Güvenlik (Sensitive Data Stripping):** Loglarda _asla_ açık şifre, hash veya hassas kişisel veri bulunmaz. Kod tabanındaki tüm "raw password" loglamaları temizlenmiştir.

**Örnek Log Yapısı:**
```
var/logs/
├── app-2026-01-28.log          # Global/Sistem logları
├── clinic_1/
│   └── app-2026-01-28.log      # ID:1 Kliniğine ait loglar
└── clinic_2/
    └── app-2026-01-28.log      # ID:2 Kliniğine ait loglar
```

**Örnek Log Kaydı:**
```json
[2026-01-28T09:15:00] Clinic_1.DEBUG: Response Sent: [200] in 45.2ms {"method":"GET","uri":"/api/appointments","clinic_id":1,"trace_id":"ab123..."}
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
 
 ## SMS Modülü Mimarisi (Provider Builder & Driver Pattern)
 
 Proje, farklı SMS sağlayıcılarının (NetGSM, Twilio, BizimSMS vb.) kod yazmadan veya minimum kodla entegre edilebileceği esnek bir SMS modülüne sahiptir.
 
 **Mimarinin Bileşenleri:**
 
 1. **Driver Pattern:** Tüm gönderim işlemleri `SmsDriverInterface` arayüzünü uygulayan sürücüler üzerinden yapılır.
    - `NetgsmDriver`: Sabit XML yapılı geleneksel sürücü.
    - `GenericHttpDriver`: **[Low-Code]** URL, HTTP Metodu, Headerlar ve Body (JSON/XML) şablonunu veritabanından okuyarak dinamik istek oluşturan esnek sürücü.
 
 2. **Provider Builder:** Platform yöneticisi, yeni bir SMS sağlayıcısını şu adımlarla tanımlar:
    - **Şablon**: API uç adresi ve Payload şablonu (Örn: `<sms><msg>{{message}}</msg></sms>`).
    - **Şema (Schema)**: Kliniğin doldurması gereken alanlar (Username, Password vb.).
    - Bu değişkenler klinik ayarlar sayfasında otomatik olarak dinamik bir forma dönüşür.
 
 3. **Güvenlik (Encryption):**
    - Kliniklerin girdiği API anahtarları ve şifreler, veritabanında **AES-256-GCM** ile şifrelenmiş olarak saklanır.
    - Konfigürasyon verileri sadece gönderim anında bellekte çözülür (Decrypt).
 
 4. **Gönderim Akışı:**
    - `SmsService::sendSms()` metodu çağrıldığında, kliniğin şifreli ayarları çözülür.
    - Sağlayıcının şablonundaki değişkenler (`{{phone}}`, `{{message}}` vb.) gerçek verilerle değiştirilir.
    - Driver, son halini almış isteği (Request) ilgili API'ye senkron veya asenkron (planlanan) olarak iletir.
 
 ---
 
 ## Multi-Tenancy Stratejisi

### Yaklaşım: Shared Database, Shared Schema

Tüm klinikler (tenant'lar) aynı veritabanını ve aynı tablo şemasını paylaşır.

**Tablo İsimlendirme ve İzolasyon:**
1.  **`cln_` Öneki (Tenant Verileri):** İşlem verileri (hasta, randevu, laboratuvar sonuçları, klinik bazlı paneller vb.) bu önekle başlar. Veri ayrımı, her tablodaki `clinic_id` sütunu ile sağlanır.
2.  **`sys_` Öneki (Global Veri / Kütüphaneler):** Tüm klinikler tarafından ortak kullanılan, her kliniğin ayrı ayrı tanımlamasına gerek olmayan merkezi kütüphanelerdir (örn: İller/İlçeler, Tanı Kodları (ICD-10), Merkezi Test Tanımları). Bu tablolarda genellikle `clinic_id` bulunmaz.

**Güvenlik Katmanları:**
1.  **`TenantMiddleware`**: Gelen isteğin `Authorization` başlığındaki JWT'yi doğrular, içindeki `clinic_id`'yi ayıklar ve isteğe bir attribute olarak ekler.
2.  **`BaseController` / `Repository` Katmanı**: Tüm `cln_` tablosu sorguları, isteğe eklenmiş olan bu `clinic_id` kullanılarak filtrelenir. Bu, bir kliniğin yanlışlıkla başka bir kliniğin verisine erişmesini engeller.


---

## Güvenlik Prensipleri

1.  **SQL Injection Koruması**: `PDO` üzerinden *her zaman* prepared statement kullanılır.
2.  **Kimlik Doğrulama (Authentication)**: `firebase/php-jwt` kütüphanesi ile JWT tabanlı token sistemi kullanılır.
3.  **Yetkilendirme (Authorization)**: Rol tabanlı yetki kontrolü (RBAC), özel bir middleware aracılığıyla sağlanacaktır. JWT içindeki `role` claim'i (`platform_admin`, `clinic_admin`, `doctor` vb.) kullanılır.
4.  **Veri İzolasyonu**: `clinic_id` ile tenant verilerinin birbirine karışması engellenir.
5.  **Girdi Doğrulama (Input Validation)**: İstemciden gelen tüm veriler, `respect/validation` gibi bir kütüphane ile controller katmanında doğrulanmalıdır.
6. **CSRF ve XSS Stratejisi (Hibrit Güvenlik):**
   - **SSR (Web Paneli):** Twig şablonları üzerinden sunulan formlar (login, vb.) için `Slim\Csrf\Guard` middleware'i kullanılarak klasik CSRF token koruması sağlanır. Token'lar session'da tutulur ve her form gönderiminde doğrulanır.
   - **API (Mobil/Stateless):** Mobil uygulamalar ve harici API istekleri JWT Bearer Token ile kimlik doğrulaması yapar. Bu istekler stateless olduğu için CSRF koruması gerekmez.
   - **XSS Koruması:** `SecurityHeadersMiddleware` ile Content-Security-Policy başlıkları eklenir. Production ortamında strict policy uygulanır.
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

