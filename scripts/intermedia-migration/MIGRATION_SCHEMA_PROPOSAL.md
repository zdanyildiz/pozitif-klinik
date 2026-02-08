# Veritabanı Şema İyileştirme Önerisi: Yapılandırılmış JSON Sütunları

Mevcut tek bir `extra_metadata` sütunu yerine, verileri "Kullanım Bağlamına (Domain Context)" göre ayrıştırılmış özel JSON sütunlarında tutmanızı öneririm. Bu yaklaşım, veritabanı yönetimini, raporlamayı ve kod okunabilirliğini önemli ölçüde artıracaktır.

## Önerilen Yeni Yapı

`ptn_cards` (Hasta Kartları) tablosuna aşağıdaki yeni JSON sütunlarının eklenmesini ve verilerin bu şekilde dağıtılmasını öneriyorum:

### 1. `medical_info` (JSON) - Tıbbi Geçmiş
Doktorların en sık erişeceği kritik sağlık verileri.
*   **İçerik:**
    *   `chronic_diseases`: ["Diyabet", "Hipertansiyon"] (Array)
    *   `allergies`: {"drug": "...", "food": "..."}
    *   `warnings`: "Penisilin alerjisi var!"
    *   `blood_type_details`: "Rh Negatif (Onaylı)"
    *   `disabilities`: Engel durumu bilgileri.

### 2. `work_details` (JSON) - İş ve İletişim
Sadece iletişim gerektiğinde veya demografik analizde kullanılacak veriler.
*   **İçerik:**
    *   `company_name`: "ABC Lojistik"
    *   `role`: "Depo Sorumlusu"
    *   `phone`: İş telefonu
    *   `address`: İş adresi detayları
    *   `email`: İş e-postası

### 3. `identity_details` (JSON) - Resmi Kimlik Detayları
Sadece fatura, resmi rapor veya SGK işlemlerinde gereken, nadiren sorgulanan detaylar.
*   **İçerik:**
    *   `marital_status`: "Evli"
    *   `spouse_name`: "Ayşe Yılmaz"
    *   `tax_no`: Vergi kimlik numarası
    *   `population_registry`: { "province": "...", "district": "...", "volume_no": "...", "family_no": "..." } (Nüfus cüzdanı detayları)

### 4. `insurance_info` (JSON) - Finans ve Sigorta
Muhasebe ve provizyon süreçleri için özelleşmiş veriler.
*   **İçerik:**
    *   `policies`: [{ "company": "Allianz", "policy_no": "123", "end_date": "2025..." }]
    *   `sgk_status`: "Emekli"
    *   `green_card`: false

### 5. `legacy_metadata` (JSON) - Arşiv ve Migrasyon
Eski sistemden gelen, artık aktif kullanılmayan ama "bulunsun" denilen veriler.
*   **İçerik:**
    *   `archive_no`: Fiziksel arşiv numarası
    *   `legacy_patient_no`: Eski sistemdeki ID'ler
    *   `migration_notes`: "Adres verisi eksik aktarıldı" gibi sistem notları.

### 6. `legal_consents` (JSON) - Yasal Onaylar
KVKK, İYS ve ETK izinlerinin yasal ispatı için saklanan veriler.
*   **İçerik:**
    *   `kvkk`: { "is_accepted": true, "accepted_at": "...", "legal_representative": { "name": "...", "degree": "..." }, "iys_id": "..." }
    *   `etk`: { "sms": { "allowed": true, "date": "..." }, "email": { "allowed": false, "date": "..." }, "call": { ... } }

## Neden Bu Yapıyı Öneriyorum?

1.  **Daha Hızlı Sorgulama:** "Diyabet hastalarını bul" dediğinizde MySQL'in sadece küçük boyutlu `medical_info` sütununu taraması, devasa bir `extra_metadata` bloğunu taramasından çok daha performanslıdır.
2.  **Temiz Kod:** Frontend tarafında (React/Vue/Blade) `patient.work_details.company` şeklinde erişmek, `patient.extra_metadata.work.company` şeklinde derin ve karmaşık bir yapıdan daha temizdir.
3.  **Güvenlik ve Yetkilendirme:** İleride "Sekreterler tıbbi geçmişi göremesin ama iş telefonunu görsün" demek isterseniz, bu sütunları API seviyesinde filtrelemek (`select('work_details')`) çok daha kolaydır.
4.  **Esneklik:** Tıbbi verilerin yapısı değişse bile (örn: yeni bir alerji tipi eklense), bu değişiklik iş bilgileri veya kimlik verilerini etkilemez.

## Uygulama Planı

Onaylarsanız şu adımları uygulayacağım:
1.  **Veritabanı Migrasyonu:** `ptn_cards` tablosuna bu 5 yeni JSON sütununu ekleyen bir SQL/Script çalıştıracağım.
2.  **Script Güncellemesi:** `extract_mssql.js` ve `load_mysql.js` dosyalarını, verileri bu yeni mantıksal kutulara dağıtacak şekilde güncelleyeceğim.
