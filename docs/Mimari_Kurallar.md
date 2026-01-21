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
* Her sayfa `layout.twig` şablonundan türetilmelidir (`{% extends 'layout.twig' %}`).
* Kod tekrarını önlemek için ortak HTML parçaları (Menü, Header) layout içinde veya `partials/` altında tutulmalıdır.




---

### 📋 BÖLÜM 2: GELİŞTİRME TALİMATI (PROMPT)

Aşağıdaki metni kopyalayıp Developer Ajanına (Cursor/Windsurf) ver. Adım adım, hata yapmadan uygulamasını sağlayacak.
