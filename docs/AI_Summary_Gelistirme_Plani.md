# AI Hasta Özeti - Geliştirme Planı

Bu doküman, "AI Destekli Hasta Özeti" (Incremental Summarization) özelliğinin adım adım geliştirme planını içermektedir. Seçenek B (Geçmiş versiyonları tutan yeni tablo kurgusu) benimsenmiştir.

## Faz 1: Veritabanı (Storage) Katmanı
- [x] 1. **`cln_patient_summaries` tablosunun oluşturulması.**
  - Alanlar: `id` (PK), `clinic_id`, `patient_id`, `summary_text` (TEXT), `last_examination_id` (INT), `created_at` (TIMESTAMP).
  - İndeksler: `clinic_id` + `patient_id` composite index.
- [x] 2. **AI Ayarları Tablosu/Yapısı (Platform Admin).**
  - Ayarların tutulacağı yapı (Örn: `sys_settings` tablosuna key-value olarak `ai_api_key`, `ai_model`, `ai_prompt` eklenmesi veya yeni bir tablo oluşturulması).

## Faz 2: Backend (Domain) Katmanı - Yapılandırma ve Servis
- [x] 3. **Platform Admin Ayar Uçları ve Controller'ı.**
  - `GET /platform-admin/settings/ai` ve `PUT /platform-admin/settings/ai` uçlarının oluşturulması.
  - Bu sayede API Key, Model Adı (örn: gemini-2.5-flash) ve Sistem Prompt'unun sistem üzerinden güncellenebilmesi.
- [x] 4. **`AiSummaryService` veya `AiService` oluşturulması.**
  - Görevi: Gerekli verileri DB'den toplamak, prompt'u ayarlardan çekerek birleştirmek, Google Gemini API'sine (veya ilgili modelin HTTP servisine) istek atmak.
- [x] 5. **Veri Anonimleştirme (PII Data Stripping) Fonksiyonu.**
  - Hastanın `name`, `tc_no`, `phone`, `email` gibi şifreli özel bilgileri **asla** LLM'e gönderilmeyecek şekilde temizleme metodu hazırlanması.
- [x] 6. **`PatientRepository` güncellemeleri.**
  - Belirli bir `last_examination_id`'den büyük kayıtları (anamnez, bulgu, tedavi vb.) getiren sorgunun yazılması.
- [x] 7. **`POST /api/patients/{id}/ai-summary` endpoint'inin oluşturulması.**
  - Backend akışının orkestrasyonu (izin kontrolü, var olan son özeti çekme, yeni kayıtları çekme, Gemini'den güncelleme isteme ve DB'ye kaydetme).

## Faz 3: Frontend (Web/SSR) Katmanı - Platform Admin
- [x] 8. **Platform Admin - AI Ayarları Sayfası.**
  - Menüye "AI Ayarları" sekmesinin eklenmesi.
  - API Key, Model Adı ve Özel Prompt'un (textarea) güncellenebildiği form kurgusu.

## Faz 4: Frontend (Web/SSR) Katmanı - Klinik Hasta Detay Ekranı
- [x] 9. **Hasta İzin Modülünün Güncellenmesi**
  - `ptn_cards` -> `legal_consents` JSON'ının içine UI tarafında form elemanı (checkbox: "Yapay Zeka (AI) Hasta Özeti İzni") eklenecek.
- [x] 10. **Hasta Özeti Butonu (UI/UX)**
  - `patient_detail.twig` sayfasına bir buton eklenecek.
  - Eğer `legal_consents` onayı yoksa buton "click" eventinde bir SweetAlert2 / Modal çıkarıp "Hastanın izni bulunmamaktadır" diyecek.
  - Onay varsa, asenkron (Axios) olarak API çağrılacak. Yüklenme simgesi gösterilecek (Gecikme payı: 3-8 saniye).
- [x] 11. **Özetin Ekranda Gösterilmesi**
  - Gelen metin (markdown veya düz metin) özel bir kart veya modal içerisinde, "Son Güncelleme" tarihiyle gösterilecek.
  - Hekim "Güncelle" dediğinde endpoint yeniden çağrılacak ve sadece farklı ise değişecek. **"Özeti Oluştur / Güncelle" Etkileşimi (Vanilla JS).**
  - Yeni muayene varsa (Backend kontrolü veya UI'da badge ile) güncelleme butonunun aktifleşmesi.
  - Tıklandığında Fetch API ile `/api/patients/{id}/ai-summary` isteği atılması, yükleniyor (loader) efekti ve dönen sonucun sayfayı yenilemeden DOM'da (veya kartta) güncellenmesi.

## Faz 5: Test ve Doğrulama
- [ ] 12. Token sayımlarının ve API gecikmesinin loglanması.
- [ ] 13. Sadece muayene (`cln_examinations`) değil, gerekirse ek verilerin de (hizmetler, laboratuvar vs.) ileride prompta dahil edilebilecek şekilde mimarinin esnek tutulup tutulmadığının kontrolü.
