# Mimari Dokümantasyonu

## Genel Bakış

Pozitif Klinik, multi-tenant SaaS mimarisi üzerine kurulu bir klinik yönetim sistemidir. Backend, API-first yaklaşımıyla geliştirilmiş olup, tüm istemciler (web, mobil, admin paneli) için bir JSON API sunar.

---

## Mimarinin Ana Katmanları

```
+-------------------+      +------------------------+      +---------------------+
|    İSTEMCİLER     |      |    PLATFORM ADMIN      |      |   KLİNİK KULLANICI  |
| (Web/Mobil App)   |      |      (Static UI)       |      |    (Web/Mobil App)  |
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
|    |             ROUTING (Auto-Discovery + Attributes)         |    |
|    |        RouteRegistrar: Controller'ları otomatik tarar     |    |
|    +-----------------------------------------------------------+    |
|                                |                                    |
|    +-----------------------------------------------------------+    |
|    |                      DI CONTAINER (PHP-DI)                |    |
|    |       (Controller'lara bağımlılıkları enjekte eder)       |    |
|    +-----------------------------------------------------------+    |
|                                |                                    |
|    +-----------------------------------------------------------+    |
|    |                       CONTROLLERS                         |    |
|    |              (İstekleri alır, yanıtları döner)            |    |
|    +-----------------------------------------------------------+    |
|                                |                                    |
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

İstemci ile sunucu arasındaki tüm iletişim (başarılı veya hatalı), "Tek Zar, Tek Format" prensibi gereği aynı zarf yapısında gerçekleşir. Bu yapı `BaseController` ve `HttpErrorHandler` tarafından garanti altına alınmıştır.

**Zarf Yapısı:**
```json
{
  "status": true,           // İşlem sonucu: true (başarılı) veya false (hatalı)
  "message": "Mesaj metni", // Kullanıcıya veya geliştiriciye not
  "data": { ... }           // Payload: Obje, Array veya null.
}
```

- **Backend Koruması:** `BaseController` içindeki `success()` ve `error()` metodları bu formatı zorunlu kılar.
- **Hata Koruması:** `HttpErrorHandler`, Framework veya veritabanı seviyesindeki her türlü hatayı otomatik olarak bu formata dönüştürür.
- **Frontend Garantisi:** `config.js` içindeki Axios interceptor, gelen her yanıtın `status` alanını kontrol eder ve hataları merkezi olarak yönetir.

---

## Frontend Yaklaşımı

Uygulama, "decoupled" (ayrık) bir frontend mimarisini benimser.

- **Backend (Bu Proje):** Saf bir JSON API'dir. HTML, CSS veya JavaScript render etmez. Görevi, veri işlemek, iş mantığını uygulamak ve sonuçları JSON formatında sunmaktır.
- **Platform Admin Paneli:** `/public/admin` klasörü altında bulunan, tamamen statik bir web uygulamasıdır. HTML, CSS ve JavaScript (Axios kütüphanesi ile) dosyalarından oluşur. Bu panel, backend ile standart API endpoint'leri üzerinden haberleşir. Bu yapı, backend ve frontend geliştirmesinin bağımsız olarak yürütülmesine olanak tanır.
- **Klinik Frontend'leri:** Gelecekte geliştirilecek olan klinik personeli ve hasta portalları da (React, Vue, Angular veya mobil uygulama) bu backend API'sini tüketecektir.

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

