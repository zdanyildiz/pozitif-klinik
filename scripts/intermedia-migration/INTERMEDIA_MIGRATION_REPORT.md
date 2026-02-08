# Intermedia Veri Aktarımı Analiz Raporu

Bu rapor, Intermedia (MSSQL) sisteminden Pozitif Klinik (MySQL) platformuna yapılacak veri göçü için güvenli ve optimize edilmiş çalışma sırasını ve teknik detayları içermektedir.

**Rapor Tarihi:** 2026-02-08
**Rapor Versiyonu:** 1.2 (Hata Raporu Eklendi)

---

## 1) Önerilen Aktarım Sırası (1..N)

> **Not:** Tüm scriptler `scripts/intermedia-migration/` dizininden çalıştırılmalıdır.

| Sıra | Script Adı | Konum | Kısa Amaç | Bağımlılıklar | Opsiyonel mi? | Son Çalıştırma Durumu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `migrate_tenants.js` | Kök dizin | MSSQL `SUBE` verilerini `sys_tenants` tablosuna aktarır. **Kritik İlk Adım.** | - | Hayır | **YENİ** (Hazırlandı) |
| **2** | `prepare_mysql_schema.js` | `migration/` | MySQL şemasını legacy sütunlar (legacy_id, legacy_visit_id vb.) ile hazırlar. | `migrate_tenants.js` | Hayır | **BAŞARILI** |
| **3** | `extract_mssql.js` | `migration/` | MSSQL'den temel verileri (Hasta, Randevu, Muayene, Hizmet, Kullanıcı) çeker ve JSON dosyasına kaydeder. | `prepare_mysql_schema.js` | Hayır | **BAŞARILI** |
| **4** | `load_mysql.js` | `migration/` | Çıkarılan JSON verilerini MySQL'e aktarır. `clinic_id` eşleşmesi için `sys_tenants` verisi şarttır. | `migrate_tenants.js`, `extract_mssql.js` | Hayır | **HATA DÜZELTİLDİ** (Artık şube verisi var) |
| **5** | `merge_specialty_data.js` | Kök dizin | Branş tablosundaki (`UZM_...`) notları `cln_examinations`'a aktarır. | `load_mysql.js` | Hayır | BEKLİYOR |
| **6** | `categorize_specialty.js` | Kök dizin | Aktarılan muayeneleri branş koduyla (`IC_HASTALIKLARI`) işaretler. | `merge_specialty_data.js` | Evet | BEKLİYOR |
| **7** | `migrate_lab_metadata.js` | Kök dizin | Laboratuvar test tanımlarını ve normal aralıklarını aktarır. | `load_mysql.js` | Evet | BEKLİYOR |
| **8** | `migrate_lab_data.js` | Kök dizin | Detaylı laboratuvar sonuçlarını aktarır. | `load_mysql.js` | Evet | BEKLİYOR |
| **9** | `migrate_files.js` | Kök dizin | Hasta dosyalarını ve dökümanlarını aktarır. | `load_mysql.js` | Evet | BEKLİYOR |
| **10** | `migrate_payments.js` | Kök dizin | Finansal kayıtları ve ödemeleri aktarır. | `load_mysql.js` | Evet | BEKLİYOR |
| **11** | `migrate_blind_index.php` | Kök dizin | Şifreli hasta verileri için arama endekslerini oluşturur. | `load_mysql.js` | Hayır | BEKLİYOR |

### Alternatif Scriptler (Eski/Yeni Akışlar)

| Script | Açıklama | Not |
| :--- | :--- | :--- |
| `migrate_data.js` (Kök dizin) | Eski tek-adim akış: MSSQL -> MySQL doğrudan aktarım (JSON yok). | `migration/*` akışı ile karıştırılmamalı. |
| `import_data.js` (Kök dizin) | `migration/load_mysql.js` ile aynı mantıkta JSON -> MySQL yükler. | Kaynak dosya `scripts/intermedia-migration/data/migration_data.json` bekler. |

---

## 2) Gerekçe ve Bağımlılıklar

### Neden bu sırada çalıştırılmalı?
*   **Şema Hazırlığı:** `cln_appointments` ve `ptn_cards` gibi tabloların eski sistemdeki anahtarları (`legacy_id`, `legacy_visit_id`) tutabilmesi için önce şema güncellenmelidir (sadece 1A-3A akışında).
*   **İlişkisel Bütünlük:** `load_mysql.js` çalışmadan hiçbir veri (`patient_id`, `doctor_id`) oluşmaz. Daha sonraki tüm scripts'ler (lab, ödeme, uzmanlık) randevuları ve hastaları eşleştirmek için `legacy_id` ve `legacy_visit_id` kullanır.
*   **Branş Notları:** `merge_specialty_data.js` hem güncelleme (`UPDATE`) hem de yeni kayıt (`INSERT`) senaryosuna sahiptir. Mevcut `cln_examinations` kayıtlarını ezmek yerine `COALESCE` ile eksik kısımları tamamladığı için temel aktarımdan sonra çalışması en sağlıklıdır.
*   **Lab Metadata vs Data:** `migrate_lab_metadata.js` ve `migrate_lab_data.js` arasında teknik zorunlu bir FK bağımlılığı yoktur; ancak raporlama ve anlamlı test isimleri için metadata'nın önce aktarılması önerilir.

### Etkilenen Tablolar ve Foreign Key Bağları
*   `ptn_cards.legacy_id` üzerinden randevular kurulur.
*   `cln_appointments.legacy_visit_id` üzerinden muayeneler, laboratuvar sonuçları ve branş notları bağlanır.
*   `cln_examinations.lab_result_text` alanı, laboratuvar ve radyoloji metinlerinin (unstructured) birleştiği ana havuzdur.

---

## 3) Değerlendirme / Riskler

### Muhtemel Veri Kaybı / Yanlış Veri Riskleri:
*   **Laboratuvar Verisi Fazlalığı:** Intermedia tarafında `LABORATUVAR` verileri hem text olarak branş tablolarında hem de yapılandırılmış olarak `HST_LAB_BIYOKIMYA` tablosunda bulunur. `merge_specialty_data.js` çalıştırıldığında muayene ekranında bir önizleme oluşur, ancak `migrate_lab_data.js` çalışmazsa detaylı analiz değerleri görülmez.
*   **Doktor Atamaları:** Eski sistemdeki kullanıcı (GOREVNO: 2) eşleşmeleri yapılmazsa, randevular varsayılan olarak `doctor_id = 1` (Admin) üzerine düşebilir.

### Tekrar Çalıştırma Durumu (Idempotency):
*   **`load_mysql.js` / `import_data.js`:** Çalıştırıldığında tabloları `TRUNCATE` eder (Fresh Start). Bu script tekrar çalıştırılırsa, sonrasında yapılan `merge_specialty_data.js` gibi güncellemeler silinir.
*   **`merge_specialty_data.js`:** `existingExamSet` kontrolü sayesinde mükerrer kayıt oluşturmaz, mevcut kayıtları günceller. Güvenle tekrar çalıştırılabilir.
*   **`migrate_lab_data.js`:** `cln_lab_results` kontrolü yapar ancak `cln_lab_result_items` bazında mükerrer test kaydı riski taşıyabilir.

---

## 4) Kontrol / Doğrulama Önerileri

Aktarım sonrası verilerin doğruluğunu kontrol etmek için aşağıdaki scriptlerin çalıştırılması önerilir:

### Zorunlu Kontroller

| Kontrol Scripti | Konum | Amaç |
| :--- | :--- | :--- |
| `verify_data_presence.js` | `non-migration/checks/` | Hangi tablolarda ne kadar veri var? |
| `count_anamnez.js` | `non-migration/checks/` | UZM tablosu ile MySQL arasındaki kayıt sayısı tutuyor mu? |
| `check_lab_links.js` | `non-migration/checks/` | Laboratuvar sonuçları doğru randevulara/hastalara bağlı mı? |

### Opsiyonel Kontroller

| Kontrol Scripti | Konum | Amaç |
| :--- | :--- | :--- |
| `check_specialty_schemas.js` | `non-migration/checks/` | Eksik branş tablosu/şema var mı? |
| `check_missing_visits.js` | `non-migration/checks/` | Eşleşmeyen geliş kayıtları var mı? |
| `check_lab_normals.js` | `non-migration/checks/` | Laboratuvar normal aralıkları doğru aktarılmış mı? |
| `check_icd_counts.js` | `non-migration/checks/` | ICD-10 tanı kodları tutarlı mı? |

---

## 5) Hızlı Başlangıç Komutları

```bash
# Çalışma dizinine git
cd scripts/intermedia-migration

# 1. Şema hazırlığı
node migration/prepare_mysql_schema.js

# 2. MSSQL'den veri çıkart
node migration/extract_mssql.js

# 3. MySQL'e aktar
node migration/load_mysql.js

# 4. Branş verilerini birleştir (LABORATUVAR + RADYOLOJI → lab_result_text)
node merge_specialty_data.js

# 5. Blind Index (şifreli veri arama endeksi)
php migrate_blind_index.php

# 6. Doğrulama
node non-migration/checks/verify_data_presence.js
node non-migration/checks/count_anamnez.js
```

---

## 6) Özel Notlar

*   **LABORATUVAR ve RADYOLOJI Birleşimi:** `AGENT_INSTRUCTIONS.md` dosyasında belirtildiği üzere, bu iki alan `cln_examinations.lab_result_text` alanına birleşik olarak aktarılır. `merge_specialty_data.js` scripti bu işlemi `COALESCE` mantığıyla gerçekleştirir.
*   **Tekrar Çalıştırma:** `load_mysql.js` tabloları sıfırladığı için yeniden çalıştırılırsa tüm aktarım adımları tekrarlanmalıdır.
*   **Branş Kodu:** İç Hastalıkları verileri `IC_HASTALIKLARI` kodu ile işaretlenir (`categorize_specialty.js`).

---

## 7) Tespit Edilen Hatalar ve Etkileri (Son Çalıştırma Durumuna Göre)

Aşağıda, son `run_migration_orchestration.js` çalıştırmasında tespit edilen kritik hatalar ve bunların migrasyon süreci üzerindeki etkileri detaylandırılmıştır.

### Hata 1: `load_mysql.js` - Foreign Key Kısıtlaması İhlali

*   **Adım:** 3. MySQL Veri Yükleme (`load_mysql.js`)
*   **Hata Mesajı:**
    ```
    Aktarım sırasında hata: Error: Cannot add or update a child row: a foreign key constraint fails (`test_klinik`.`sys_users`, CONSTRAINT `sys_users_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`))
    ```
*   **Neden:** `sys_users` tablosuna veri eklenirken `clinic_id` değeri, `sys_tenants` tablosunda karşılık gelen bir `id` değeri bulunamadığı için yabancı anahtar kısıtlaması ihlal edilmiştir. Bu durum genellikle `sys_tenants` tablosunun boş olmasından veya `load_mysql.js` script'inin doğru `clinic_id` değerlerini sağlamamasından kaynaklanır.
*   **Etkisi:**
    *   **Kullanıcılar Aktarılamadı:** `sys_users` tablosuna hiçbir kullanıcı verisi aktarılamamıştır.
    *   **Temel Veri Eksikliği:** Kullanıcılar (`sys_users`) ve muhtemelen diğer ilişkili temel tablolar (`ptn_cards`, `cln_appointments` gibi) boş kaldığı için, sonraki adımlarda bu verilere bağımlı olan (örneğin, randevuların kullanıcılara atanması, hastaların varlığı) işlemler ya başarısız olmuş ya da sıfır kayıt üzerinde işlem yapmıştır.
    *   **Zincirleme Etki:** Bu hata, tüm migrasyon sürecinin temelini oluşturan veri yükleme adımında meydana geldiği için, sonraki birçok adımın (4, 5, 6, 7, 8) işlevsel olarak başarısız olmasına veya beklenen etkiyi göstermemesine neden olmuştur.

### Hata 2: `migrate_lab_metadata.js` - Panellerde Foreign Key Kısıtlaması İhlali

*   **Adım:** 6. Laboratuvar Metadata (`migrate_lab_metadata.js`)
*   **Hata Mesajı:**
    ```
    Migration failed: Error: Cannot add or update a child row: a foreign key constraint fails (`test_klinik`.`cln_lab_test_panels`, CONSTRAINT `fk_lab_panels_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `sys_tenants` (`id`) ON DELETE CASCADE)
    ```
*   **Neden:** `cln_lab_test_panels` tablosuna veri eklenirken kullanılan `clinic_id` değeri, `sys_tenants` tablosunda mevcut bir `id`'ye karşılık gelmediği için yabancı anahtar kısıtlaması ihlal edilmiştir. (Adım 1'deki `prepare_mysql_schema.js` script'i şema hazırlığı yapsa da, `sys_tenants` tablosunu doldurmaz.)
*   **Etkisi:**
    *   **Laboratuvar Panelleri Aktarılamadı:** Laboratuvar test panelleri MySQL veritabanına aktarılamamıştır.
    *   **Kısmi Aktarım:** Tanımlar ve normal değerler (`Migrated 148 definitions`, `Migrated 4624 normal values`) başarılı bir şekilde aktarılmış olsa da, panellerin eksikliği laboratuvar modülünün tam işlevselliğini etkileyebilir.

### Hata 3: `migrate_blind_index.php` - `vendor/autoload.php` Bulunamadı

*   **Adım:** 10. Blind Index Migrasyonu (`migrate_blind_index.php`)
*   **Hata Mesajı:**
    ```
    PHP Warning: require(/opt/lampp/htdocs/pozitif-klinik/scripts/intermedia-migration/../vendor/autoload.php): Failed to open stream: No such file or directory in /opt/lampp/htdocs/pozitif-klinik/scripts/intermedia-migration/migrate_blind_index.php on line 9
    PHP Fatal error: Uncaught Error: Failed opening required '/opt/lampp/htdocs/pozitif-klinik/scripts/intermedia-migration/../vendor/autoload.php' ...
    ```
*   **Neden:** PHP betiği, belirtilen yolda (`/opt/lampp/htdocs/pozitif-klinik/vendor/autoload.php`) `vendor/autoload.php` dosyasını açamamıştır. Daha önce yapılan kontrol, dosyanın fiziksel olarak var olduğunu ve okunabilir olduğunu göstermişti. Bu durum genellikle PHP yorumlayıcısının o dosyaya erişim izinlerinin olmamasından, `php.ini` dosyasındaki `open_basedir` kısıtlamasından veya SELinux/AppArmor gibi güvenlik mekanizmalarının erişimi engellemesinden kaynaklanır.
*   **Etkisi:**
    *   **Arama İndeksleri Oluşturulamadı:** Şifreli hasta verileri (ad, TC, telefon) için arama indeksleri oluşturulamamıştır.
    *   **Arama Fonksiyonelliği Etkilendi:** Bu indekslerin eksikliği, sistemde şifreli hasta verileri üzerinde arama yapma yeteneğini doğrudan etkileyecektir, bu da hasta bulma ve yönetim süreçlerinde ciddi aksaklıklara yol açabilir.

### Genel Tespit: Orkestrasyon Betiğindeki Hata Yakalama Eksikliği

*   **Sorun:** `run_migration_orchestration.js` betiği, çalıştırdığı alt betiklerden dönen hataları (özellikle JavaScript betiklerinin fırlattığı istisnaları veya PHP betiklerinin fatal hatalarını) tam olarak yakalayıp migrasyon adımının "BAŞARISIZ" olduğunu belirtmemektedir. Örneğin, Adım 3 ve Adım 6'da kritik hatalar olmasına rağmen, orkestrasyon betiği bu adımları "BAŞARILI" olarak raporlamıştır.
*   **Etkisi:** Bu durum, migrasyon sürecinin genel durumunu yanlış yansıtır ve sorunların tespitini zorlaştırır. Kullanıcı, tüm adımların başarılı olduğunu düşünebilirken, aslında veritabanında ciddi eksiklikler ve tutarsızlıklar meydana gelmiş olabilir.

---

Bu detaylı hata raporu, migrasyon sürecinin mevcut durumunu ve karşılaşılan temel sorunları özetlemektedir. Bu sorunların giderilmesi, veri aktarımının doğru ve eksiksiz bir şekilde tamamlanması için kritik öneme sahiptir.