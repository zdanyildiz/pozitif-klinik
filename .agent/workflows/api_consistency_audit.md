---
description: API Consistency and Logging Audit
---
# API ve Frontend Veri Tutarlılığı Denetimi

Bu iş akışı, projedeki tüm API endpoint'lerinin ve bunları kullanan JavaScript dosyalarının standart veri yapısına (`status`, `message`, `data`) uyup uymadığını ve gerekli loglamaların yapılıp yapılmadığını denetlemek içindir.

## 1. Backend Yanıt Standartları Denetimi
- [ ] **BaseController:** Tüm metodların (`success`, `error`) standart JSON yapısını (`{ status: bool, message: string, data: mixed }`) garanti ettiğini kontrol et.
- [ ] **Controller Taraması:** Tüm Controller sınıflarını (`src/Domain/**/*.php`) tara.
    - [ ] `json_encode` veya manuel `Response` body yazımı var mı? (Varsa `BaseController` metodlarına çevir).
    - [ ] Pagination dönen endpoint'lerin yapısı standart mı (`items`, `total`, `page` vb.)?
- [ ] **Middleware:** `HttpErrorHandler` ve diğer middleware'lerin hata durumunda aynı standart yapıyı döndürdüğünü doğrula.

## 2. Loglama Denetimi
- [ ] **Request Logging:** `RequestLoggingMiddleware`'in tüm istekleri doğru seviyede (DEBUG/INFO) logladığını teyit et.
- [ ] **Controller Logging:** Kritik işlemlerde (Create, Update, Delete) controller içinde explicit `error_log` veya `Logger` kullanımını kontrol et. Gereksiz `console.log` veya `error_log` debug kalıntılarını temizle.

## 3. Frontend (JS) Tüketim Denetimi
- [ ] **API Çağrıları:** `Public/assets/js/` altındaki tüm `.js` dosyalarını tara (özellikle `services.js`, `examination.js`, `appointments.js`, `patients.js`).
- [ ] **Response Handling:**
    - [ ] `res.status === true` kontrolü yapılıyor mu?
    - [ ] Veriye `res.data` üzerinden mi erişiliyor, yoksa direkt `res` mi kullanılıyor?
    - [ ] Pagination (örneğin `services.js`'deki gibi) yapısının `res.data.items` şeklinde mi yoksa `res.data` (array) olarak mı beklendiğini kontrol et ve backend ile eşleştir.

## 4. Düzeltme ve Standardizasyon
- [ ] Tespit edilen uyumsuzlukları gider.
- [ ] Tüm JS dosyalarında `console.log` temizliği yap (Geliştirme logları hariç).

## Özet Rapor
- Denetim sonunda hangi endpoint'lerin düzeltildiği ve hangi JS dosyalarının güncellendiğine dair rapor oluştur.
