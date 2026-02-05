# Dinamik Muayene ve Branş Yönetim Sistemi Geliştirme Planı

Bu döküman, Pozitif Klinik platformunun multi-specialty (çok branşlı) ve multi-tenant (çok kiracılı) yapısını destekleyecek olan dinamik muayene formları altyapısının geliştirme planını içerir.

## 1. Mimari Yaklaşım: "Core Data + Dynamic Metadata"
Mevcut katı veritabanı şeması yerine, her branşın kendine has verilerini esnek bir yapıda tutabileceği hibrit bir mimari benimsenecektir.

### Bileşenler:
*   **Sabit Alanlar (Core Fields):** Tüm branşlarda ortak olan Şikayet (`complaint`), Tanı (`diagnosis`), Hikaye (`story`) gibi alanlar tablo sütunu olarak kalacaktır.
*   **Dinamik Alanlar (Dynamic Fields):** Branşa özel (örneğin Göz için "Göz Tansiyonu", Kardiyoloji için "Eko Bulguları") veriler bir JSON sütununda (`specialty_data`) saklanacaktır.

---

## 2. Veritabanı Değişiklikleri

### A. Mevcut Tablo Güncellemesi (`cln_examinations`)
*   `specialty_data` (JSON / LONGTEXT): Branşa özel dinamik verileri tutar.
*   `specialty_code` (VARCHAR): Kaydın hangi branşa ait olduğunu belirtir (Örn: 'DAHILIYE', 'GOZ').

### B. Yeni Tanım Tablosu (`sys_specialty_forms`)
Bu tablo, her branş için hangi form alanlarının gösterileceğini tanımlayan meta-veriyi tutar.
*   `specialty_code`: Tekil branş kodu.
*   `name`: Branş adı.
*   `form_schema` (JSON): Formun yapısı (input tipleri, validasyonlar, etiketler).

---

## 3. Backend Geliştirmeleri (Domain & Repository)

### A. Repository Katmanı
*   `ExaminationRepository` sınıfı, `specialty_data` sütununu PHP dizisi ile JSON arasında otomatik dönüştürecek şekilde güncellenecektir.
*   Hassas veri içeren dinamik alanlar (varsa), `CryptoService` kullanılarak şifrelenecektir.

### B. Controller Katmanı
*   `POST /api/examinations` endpoint'i, gönderilen JSON içindeki dinamik alanları doğrulayıp kaydedecektir.
*   `GET /api/specialties/forms/{code}`: Belirli bir branşın form şemasını dönecektir.

---

## 4. Frontend & UI Geliştirmeleri (Web/SSR)

### A. Dinamik Form Oluşturucu (Dynamic Form Builder)
*   `examination_form.twig` şablonu, sunucudan gelen `form_schema` değerine göre inputları dinamik olarak render edecektir.
*   Vanilla JS kullanılarak form verileri toplanıp JSON formatında backend'e gönderilecektir.

### B. Branş Seçimi
*   Muayene başlatılırken kliniğin/doktorun branşına göre doğru form otomatik yüklenecektir.

---

## 5. Uygulama ve Geçiş (Migration) Stratejisi

### Mevcut Verilerin Birleştirilmesi
Eski sistemdeki dağınık veriler şu adımlarla yeni yapıya taşınacaktır:
1.  `UZM_ICHASTALIKLARI_HST_ANAMNEZ` gibi dolu tablolar taranacak.
2.  `GELISNO` (Visit ID) üzerinden `cln_examinations` kayıtları bulunacak.
3.  Eski tablodaki branş spesifik alanlar, yeni JSON sütununa (`specialty_data`) taşınacaktır.
4.  Ortak alanlar (`TANI` -> `diagnosis` vb.) ana sütunlara `UPDATE` edilecektir.

---

## 6. Proje Kurallarına Uyumluluk Notları
*   **Veri İzolasyonu:** `clinic_id` kontrolü her sorguda devam edecektir.
*   **Şifreleme:** Dinamik veriler içindeki kişisel sağlık verileri (PHİ) `CryptoService` ile korunacaktır.
*   **Performans:** JSON sütunu kullanımı MySQL'in JSON fonksiyonları ile optimize edilecektir.
*   **Multi-tenant:** Klinikler kendi branş formlarını özelleştirebilecek (gelecekteki faz).
