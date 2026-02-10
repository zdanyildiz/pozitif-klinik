# INTERMEDIA → POZİTİF KLİNİK MİGRASYON KILAVUZU

Bu klasör (`scripts/intermedia-migration`), eski MSSQL tabanlı Intermedia sisteminden yeni Pozitif Klinik MySQL sistemine veri aktarımı yapan araçları ve scriptleri içerir.

Bu yapı **"Klinik Bazlı" (Per-Tenant)** aktarım için tasarlanmıştır. Tüm scriptler `--clinic=N` parametresi ile çalışır.

## 📁 Klasör Yapısı

- **core/** → Merkezi yapılandırma modülleri
  - `db.config.json` — Veritabanı bağlantı ayarları
  - `db.helper.js` — MSSQL/MySQL config fonksiyonları
  - `cli.helper.js` — CLI parametre ayrıştırma (`--clinic=N`)
- **extraction/** → MSSQL'den verileri çeken modüller (`extract_mssql.js`)
- **loading/** → Çekilen verileri MySQL'e yükleyen modüller (`load_mysql.js`)
- **data/** → Geçici veri dosyalarının (JSON) oluşturulduğu yer
- **archive/** → Arşivlenmiş eski scriptler

## 🚀 Nasıl Çalıştırılır?

### 1. Hazırlık
Veritabanının temiz olduğundan emin olmak isterseniz:
```bash
bash scripts/setup_test_db.sh
```

### 2. Tam Migrasyon (13 Adım)
Klinik ID'sini (Eski sistemdeki SUBE_ID) belirterek:

```bash
node scripts/intermedia-migration/run.js --clinic=1
```

### 3. Diğer Seçenekler

```bash
# Adımları listele (çalıştırmadan)
node scripts/intermedia-migration/run.js --clinic=1 --list

# 5. adımdan devam et (hata sonrası)
node scripts/intermedia-migration/run.js --clinic=1 --from=5

# Sadece belirli bir adımı çalıştır
node scripts/intermedia-migration/run.js --clinic=1 --only=3
```

### 4. Migrasyon Adımları

| # | Adım | Script | Açıklama |
|---|---|---|---|
| 1 | Şube Senkronizasyonu | `migrate_tenants.js` | sys_tenants tablosunu günceller |
| 2 | Veri Çıkarma | `extraction/extract_mssql.js` | MSSQL'den klinik verisini JSON'a çeker |
| 3 | Veri Yükleme | `loading/load_mysql.js` | JSON'dan MySQL'e yükler (Append Mode) |
| 4 | Branş Birleştirme | `merge_specialty_data.js` | Lab/Radyoloji metinlerini birleştirir |
| 5 | Uzmanlık Kategorizasyonu | `categorize_specialty.js` | Branş kodlarını işaretler |
| 6 | Lab Metadata | `migrate_lab_metadata.js` | Test tanımları ve referans aralıkları |
| 7 | Lab Sonuçları | `migrate_lab_data.js` | Detaylı lab sonuçları |
| 8 | Dosya Migrasyonu | `migrate_files.js` | Hasta dosyaları ve raporlar |
| 9 | Ödeme Migrasyonu | `migrate_payments.js` | Finansal kayıtlar |
| 10 | ICD-10 Kodu | `migrate_icd_library.js` | Tanı kodları (global) |
| 11 | Activity Logs | `migrate_activity_logs.js` | Aktivite logları |
| 12 | Data Access Logs | `migrate_data_access_logs.js` | Erişim logları |
| 13 | Consent Logs | `migrate_consent_logs.js` | Onam logları |

## ⚠️ Önemli Notlar

- **Multi-Tenant:** Her script `--clinic=N` parametresi ile çalışır. Klinik ID belirtmeden çalıştırılamaz.
- **Timeout:** Büyük veri aktarımlarında MSSQL bağlantısı zaman aşımına uğrayabilir. Bu durumda `core/db.helper.js` içindeki `requestTimeout` değerini artırın (varsayılan: 5 dakika).
- **Temiz Başlangıç:** Veriler karıştıysa `test_klinik` veritabanını silip `setup_test_db.sh` ile yeniden kurun.
- **Devam Desteği:** Hata durumunda `--from=N` ile kaldığınız adımdan devam edebilirsiniz.
- **Append Mode:** Veri yükleme scripti mevcut kayıtları kontrol eder ve sadece yeni olanları ekler.

## 🛠 Sorun Giderme

**Hata:** `Task timed out after 60000 ms`  
**Çözüm:** `core/db.helper.js` → `requestTimeout` değerini `300000` veya daha fazla yapın.

**Hata:** `Cannot find module ...`  
**Çözüm:** Tüm scriptler `./core/db.helper` üzerinden config'e erişir. Hata alırsanız proje kök dizininde olduğunuzdan emin olun.

**Hata:** `HATA: Klinik ID belirtilmedi!`  
**Çözüm:** `--clinic=N` parametresini eklemeyi unutmayın.

## 📊 Detaylı Analiz

Yapısal analiz ve refaktör detayları için: [`MIGRATION_REFACTOR_ANALYSIS.md`](./MIGRATION_REFACTOR_ANALYSIS.md)
