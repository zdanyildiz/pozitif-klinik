# Intermedia Veri Aktarımı Analiz Raporu

Bu rapor, Intermedia (MSSQL) sisteminden Pozitif Klinik (MySQL) platformuna yapılacak veri göçü için güvenli ve optimize edilmiş çalışma sırasını ve teknik detayları içermektedir.

**Rapor Tarihi:** 2026-02-07
**Rapor Versiyonu:** 1.1

---

## 1) Önerilen Aktarım Sırası (1..N)

> **Not:** Tüm scriptler `scripts/intermedia-migration/` dizininden çalıştırılmalıdır.
> **Kritik:** Asagidaki iki ana yaklasimdan sadece birini secin. Ayni aktarimda **migrate_data.js** ile **migration/** akisini karistirmayin.

| Sıra | Script Adı | Konum | Kısa Amaç | Bağımlılıklar | Opsiyonel mi? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1A** | `prepare_mysql_schema.js` | `migration/` | MySQL şemasını legacy sütunlar (legacy_id, legacy_visit_id vb.) ile hazırlar. | - | Hayır |
| **2A** | `extract_mssql.js` | `migration/` | MSSQL'den temel verileri (Hasta, Randevu, Muayene, Hizmet, Kullanıcı) çeker ve `docs/migration_data.json` dosyasına kaydeder. | `prepare_mysql_schema.js` | Hayır |
| **3A** | `load_mysql.js` | `migration/` | Çıkarılan JSON verilerini MySQL'e aktarır, KVKK şifrelemesi yapar. | `extract_mssql.js` | Hayır |
| **1B** | `migrate_data.js` | Kök dizin | Eski MSSQL'den doğrudan MySQL'e temel verileri aktarır (tek adım, JSON yok). | - | Hayır |
| **4** | `merge_specialty_data.js` | Kök dizin | Branş tablosundaki (`UZM_...`) notları `cln_examinations`'a aktarır. LABORATUVAR ve RADYOLOJI alanlarını birleştirir. | `load_mysql.js` **veya** `migrate_data.js` | Hayır |
| **5** | `categorize_specialty.js` | Kök dizin | Aktarılan muayeneleri branş koduyla (`IC_HASTALIKLARI`) işaretler. | `merge_specialty_data.js` | Evet |
| **6** | `migrate_lab_metadata.js` | Kök dizin | Laboratuvar test tanımlarını ve normal aralıklarını aktarır. | `load_mysql.js` **veya** `migrate_data.js` | Evet |
| **7** | `migrate_lab_data.js` | Kök dizin | Yapılandırılmış laboratuvar sonuçlarını ve değerlerini aktarır. | `load_mysql.js` **veya** `migrate_data.js` | Evet |
| **8** | `migrate_files.js` | Kök dizin | Hasta dosyalarını ve dökümanlarını (radyoloji taramaları vb.) aktarır. | `load_mysql.js` **veya** `migrate_data.js` | Evet |
| **9** | `migrate_payments.js` | Kök dizin | Finansal kayıtları ve ödemeleri aktarır. | `load_mysql.js` **veya** `migrate_data.js` | Evet |

### Alternatif Scriptler (Eski/Yeni Akışlar)

| Script | Açıklama | Not |
| :--- | :--- | :--- |
| `migrate_data.js` (Kök dizin) | Eski tek-adim akış: MSSQL -> MySQL doğrudan aktarım (JSON yok). | `migration/*` akışı ile karıştırılmamalı. |
| `import_data.js` (Kök dizin) | `migration/load_mysql.js` ile aynı mantıkta JSON -> MySQL yükler. | Kaynak dosya `docs/migration_data.json` bekler. |

---

## 2) Gerekçe ve Bağımlılıklar

### Neden bu sırada çalıştırılmalı?
*   **Şema Hazırlığı:** `cln_appointments` ve `ptn_cards` gibi tabloların eski sistemdeki anahtarları (`legacy_id`, `legacy_visit_id`) tutabilmesi için önce şema güncellenmelidir (sadece 1A-3A akışında).
*   **İlişkisel Bütünlük:** `load_mysql.js` çalışmadan hiçbir veri (`patient_id`, `doctor_id`) oluşmaz. Daha sonraki tüm scripts'ler (lab, ödeme, uzmanlık) randevuları ve hastaları eşleştirmek için `legacy_visit_id` kullanır.
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

# 5. Doğrulama
node non-migration/checks/verify_data_presence.js
node non-migration/checks/count_anamnez.js
```

---

## 6) Özel Notlar

*   **LABORATUVAR ve RADYOLOJI Birleşimi:** `AGENT_INSTRUCTIONS.md` dosyasında belirtildiği üzere, bu iki alan `cln_examinations.lab_result_text` alanına birleşik olarak aktarılır. `merge_specialty_data.js` scripti bu işlemi `COALESCE` mantığıyla gerçekleştirir.
*   **Tekrar Çalıştırma:** `load_mysql.js` tabloları sıfırladığı için yeniden çalıştırılırsa tüm aktarım adımları tekrarlanmalıdır.
*   **Branş Kodu:** İç Hastalıkları verileri `IC_HASTALIKLARI` kodu ile işaretlenir (`categorize_specialty.js`).
