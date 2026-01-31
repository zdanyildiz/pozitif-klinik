### 📜 BÖLÜM 1: MİMARİ KURALLAR (AI Ajanı İçin)

Bu kurallar **kesindir** ve esnetilemez. Ajana önce bunları okutmalısın.

1. **Veri İzolasyonu (No Logic in View):**
* `.twig` dosyaları içinde ASLA veritabanı sorgusu (`SELECT`, `Patient::find` vb.) çalıştırılamaz.
* Twig sadece Controller'dan gelen hazır dizileri (array) ekrana basar.
* *Yasak:* `{% set hastalar = db.query('...') %}` ❌
* *Doğru:* `{% for hasta in hastalar %}` ✅ (Veri controller'dan gelir).

2. **API ve WEB Ayrımı (Separation of Concerns):**
* **API Controllerları:** `src/Domain/...` altında kalmaya devam edecek. JSON dönerler. Mobil uygulama ve dış servisler için kullanılır.
* **Web Controllerları:** `src/Web/Controllers/` altında toplanacak. HTML (TwigView) dönerler. `Response` nesnesine `view->render()` basarlar.
* **Views:** Tüm şablon dosyaları `src/Views/` altında `.twig` uzantılı olarak saklanacak.
* **Service Katmanı Ortak:** Her iki Controller tipi de aynı `Repository` sınıfını kullanır. İş mantığı tek, sunum katmanı (JSON vs HTML) farklıdır.

3. **JS Temizliği (Progressive Enhancement):**
* Sayfa yüklendiğinde (`document.ready`) çalışan veri çekme amaçlı `fetch('/api/...')` çağrıları yasaktır. Veri sunucu tarafında (SSR) hazırlanıp gönderilmelidir.
* JavaScript sadece kullancı etkileşimi (Modal açma, Alert, Client-side basit filtreleme, Form submit handling) için kullanılmalıdır. "Backend-for-Frontend" mantığı sunucuda çalışır.

4. **Güvenlik (Auto-Escaping & Session):**
* Twig varsayılan olarak XSS koruması (auto-escaping) sağlar. `raw` filtresini kullanırken çok dikkatli olunmalıdır.
* Web rotaları için ileride Session/Cookie tabanlı `WebAuthMiddleware` kullanılacaktır (Şu an geçici olarak sabit clinic_id=1 kullanılmakta).

5. **Twig Şablon Yapısı (Layouts):**
* **Klinik Sayfaları:** `layout.twig` şablonundan türetilir (`{% extends 'layout.twig' %}`).
* **Platform Sayfaları:** `platform_layout.twig` şablonundan türetilir (`{% extends 'platform_layout.twig' %}`).
* **Login Sayfaları:** Standalone kalabilir veya özel `login_layout.twig` kullanabilir.
* Kod tekrarını önlemek için ortak HTML parçaları (Menü, Header, CDN kütüphaneleri) layout içinde tutulmalıdır.
* Layout'lar şu blokları sağlar:
  - `{% block content %}`: Sayfa ana içeriği
  - `{% block head %}`: Sayfa özel CSS/style
  - `{% block scripts %}`: Sayfa özel JavaScript
  - `{% block page_title %}`: Sayfa başlığı
  - `{% block navbar_content %}`: Özel navbar içeriği (opsiyonel)






6. **Frontend & UX Kuralları:**
* **Modal İçinde Modal Yasak:** Bootstrap Modal içinde asla SweetAlert (Input içeren) veya ikinci bir Bootstrap Modal açılmamalıdır. Bu durum "Focus Trap" sorunlarına ve mobil uyumsuzluklara yol açar.
* **Inline Panel Kullanımı:** Modal içinde ek bir işlem (örn: Hizmet Ekleme) gerekiyorsa, yeni bir pencere açmak yerine "Inline Panel" (Sayfa içi gizli/açılır div) kullanılmalıdır.
* **JS Bağımlılıkları:** jQuery kullanımı minimize edilmeli, DOM manipülasyonları mümkün olduğunca Vanilla JS ile yapılmalıdır.
---

### 📋 BÖLÜM 2: GELİŞTİRME TALİMATI (PROMPT)

Aşağıdaki metni kopyalayıp Developer Ajanına (Cursor/Windsurf) ver. Adım adım, hata yapmadan uygulamasını sağlayacak.
