# 🔍 Intermedia Migration — Refaktör Analiz Raporu

**Tarih:** 2026-02-10  
**Durum:** Aktif — İyileştirmeler uygulanıyor  
**Kapsam:** `scripts/intermedia-migration/` dizinindeki tüm scriptler

---

## 📋 İçindekiler

1. [Mevcut Yapı Özeti](#mevcut-yapı-özeti)
2. [KRİTİK Sorunlar (🔴)](#-kritik-sorunlar)
3. [ÖNEMLİ Tasarım Sorunları (🟠)](#-önemli-tasarım-sorunları)
4. [Yapısal İyileştirme Önerileri (🟡)](#-yapısal-iyileştirme-önerileri)
5. [Uygulanan Düzeltmeler](#-uygulanan-düzeltmeler)

---

## Mevcut Yapı Özeti

### Klasör Yapısı
```
scripts/intermedia-migration/
├── core/                      # DB config (db.config.json, db.helper.js)
├── extraction/                # MSSQL'den veri çekme (extract_mssql.js)
├── loading/                   # MySQL'e veri yükleme (load_mysql.js)  
├── data/                      # Geçici JSON dosyaları
├── migration/                 # ESKİ/ARŞIV scriptler (.min.js dosyaları)
├── archive/                   # Arşivlenmiş scriptler
├── non-migration/             # Yardımcı araçlar (checks/, tools/)
├── run.js                     # Orkestratör #1 (3 adım, --clinic destekli)
├── run_migration_orchestration.js  # Orkestratör #2 (14 adım, hardcoded)
├── migrate_tenants.js         # Şube migrasyonu
├── migrate_activity_logs.js   # Aktivite logları
├── migrate_lab_data.js        # Lab sonuçları
├── migrate_lab_metadata.js    # Lab test tanımları
├── migrate_files.js           # Dosya migrasyonu
├── migrate_payments.js        # Ödeme migrasyonu
├── migrate_consent_logs.js    # Onam logları
├── migrate_data_access_logs.js # Erişim logları
├── migrate_icd_library.js     # ICD-10 kodları
├── merge_specialty_data.js    # Branş verileri birleştirme
├── categorize_specialty.js    # Uzmanlık kategorizasyonu
└── ... (diğer yardımcı dosyalar)
```

### İki Orkestrasyon Scripti Karşılaştırması

| Özellik | `run.js` | `run_migration_orchestration.js` |
|---|---|---|
| Adım Sayısı | 3 | 14 |
| CLI Parametresi | `--clinic=N` ✅ | Yok ❌ |
| Kullandığı Modüller | `extraction/`, `loading/` | `migration/`, kök dizin |
| README'de Belirtilen | ✅ | ❌ |
| Tam Süreç | ❌ (Lab, dosya, log yok) | ✅ |

---

## 🔴 KRİTİK SORUNLAR

### [K1] İkili Orkestrasyon Karmaşası

**Dosyalar:** `run.js`, `run_migration_orchestration.js`

Sistemde iki farklı orkestrasyon scripti var ve birbirinden bağımsız çalışıyorlar. `run.js` sadece 3 temel adımı kapsarken, `run_migration_orchestration.js` 14 adımlık tam süreci yönetiyor. Dahası, aynı isimdeki scriptlerin farklı dizinlerdeki versiyonlarını kullanıyorlar.

**Risk:** Yanlış orkestratörün çalıştırılması, eksik veya tutarsız veri aktarımına neden olur.

**Çözüm:** Tek bir birleşik orkestratör (`run.js`) oluşturulacak.

---

### [K2] Hardcoded `CLINIC_ID = 1`

**Etkilenen Dosyalar (10 adet):**
| Dosya | Satır |
|---|---|
| `migrate_activity_logs.js` | 6 |
| `migrate_lab_data.js` | 5 |
| `migrate_lab_metadata.js` | 4 |
| `migrate_files.js` | 10 |
| `migrate_payments.js` | 18 |
| `migrate_consent_logs.js` | 6 |
| `migrate_data_access_logs.js` | 6 |
| `merge_specialty_data.js` | 4 |
| `categorize_specialty.js` | 4 |

**Risk:** README "Klinik Bazlı" aktarım iddia ediyor ancak yardımcı scriptlerin TÜMÜ sadece clinic_id=1 ile çalışıyor. İkinci klinik aktarılamaz.

**Çözüm:** Tüm scriptlere `--clinic=N` CLI parametresi eklenecek.

---

### [K3] Path Tutarsızlığı `./db.helper` vs `./core/db.helper`

**Doğru import kullanan dosyalar:**
- `extraction/extract_mssql.js` → `../core/db.helper` ✅
- `loading/load_mysql.js` → `../core/db.helper` ✅
- `migrate_tenants.js` → `./core/db.helper` ✅

**Yanlış import kullanan dosyalar (8 adet):**
- `migrate_activity_logs.js` → `./db.helper` ❌
- `migrate_lab_data.js` → `./db.helper` ❌
- `migrate_lab_metadata.js` → `./db.helper` ❌
- `migrate_files.js` → `./db.helper` ❌
- `migrate_payments.js` → `./db.helper` ❌
- `migrate_consent_logs.js` → `./db.helper` ❌
- `migrate_data_access_logs.js` → `./db.helper` ❌
- `merge_specialty_data.js` → `./db.helper` ❌
- `categorize_specialty.js` → `./db.helper` ❌
- `migrate_icd_library.js` → `./db.helper` ❌

**Risk:** Bu scriptler yalnızca CWD (Current Working Directory) doğru ayarlandığında çalışıyor. Farklı bir dizinden çağrıldığında `MODULE_NOT_FOUND` hatası verir.

**Çözüm:** Tüm import path'leri `./core/db.helper` olarak düzeltilecek.

---

## 🟠 ÖNEMLİ TASARIM SORUNLARI

### [T1] N+1 Sorgu Problemi — `load_mysql.js` (DARBOĞAZ)

**Dosya:** `loading/load_mysql.js`, satır 164-169, 204-208

Her hasta ve randevu kaydı için tekil `SELECT ... WHERE legacy_id = ?` sorgusu çalıştırılıyor.

```
16.000 hasta × 1 SELECT = 16.000 sorgu (sadece "var mı" kontrolü)
30.000 randevu × 1 SELECT = 30.000 sorgu
```

**Çözüm:** Batch başında `WHERE legacy_id IN (...)` ile toplu kontrol yapılacak.

---

### [T2] O(n²) Muayene Eşleşmesi — `load_mysql.js`

**Dosya:** `loading/load_mysql.js`, satır 232

```javascript
const appt = data.appointments.find(a => a.legacy_visit_id === e.legacy_visit_id);
```

Her muayene notu için tüm randevu dizisi taranıyor:
`20.000 muayene × 30.000 randevu = 600M karşılaştırma`

**Çözüm:** `appointments` dizisi bir `Map`'e dönüştürülecek → O(1) erişim.

---

### [T3] ROW_NUMBER() Performans Sorunu — `migrate_data_access_logs.js`

**Dosya:** `migrate_data_access_logs.js`, satır 43-61

Her batch'te `ROW_NUMBER() OVER (ORDER BY TarihSaat, KullaniciID)` CTE'si tüm tabloyu yeniden hesaplıyor. Offset arttıkça sorgu süresi lineer olmayan şekilde büyür.

**Çözüm:** Kompozit cursor tabanlı pagination'a geçilecek.

---

### [T4] Transaction Desteği Yok

Hiçbir loading scriptinde `BEGIN/COMMIT/ROLLBACK` kullanılmıyor. Hata durumunda yarı yazılmış veri kalır.

---

### [T5] Dosya Batch = 10

**Dosya:** `migrate_files.js`, satır 85

Binary dosya çekimi için düşük batch size kabul edilebilir ancak MSSQL'den metadata çekerken 10'arlık batch çok yavaş.

---

## 🟡 YAPISAL İYİLEŞTİRME ÖNERİLERİ

### [Y1] Doğrulama/Validation Adımı Yok
14 adımlık sürecin sonunda kayıt sayısı kontrolü, orphan kayıt tespiti gibi doğrulama adımları eksik.

### [Y2] Dosya Bazlı Loglama Yok
Tüm çıktı sadece `console.log`. Terminal kapanırsa output kaybolur.

### [Y3] Dry-Run Modu Yok
`--dry-run` desteği bulunmuyor.

### [Y4] Dağınık Script Yapısı
8+ migrate script kök dizinde dağınık duruyor. Extraction ve Loading mantıkları ayrışmamış.

---

## ✅ Uygulanan Düzeltmeler

### Düzeltme 1: Tüm scriptlere `--clinic=N` CLI parametresi eklendi
**Tarih:** 2026-02-10  
**Etkilenen dosyalar:** migrate_activity_logs.js, migrate_lab_data.js, migrate_lab_metadata.js, migrate_files.js, migrate_payments.js, migrate_consent_logs.js, migrate_data_access_logs.js, merge_specialty_data.js, categorize_specialty.js  
**Detay:** Hardcoded `CLINIC_ID = 1` kaldırıldı, `--clinic=N` parametresi ile çalışan `parseClinicId()` helper fonksiyonu eklendi. Aynı zamanda tüm `./db.helper` importları `./core/db.helper` olarak düzeltildi.

### Düzeltme 2: Birleşik Orkestratör — `run.js`
**Tarih:** 2026-02-10  
**Detay:** İki ayrı orkestratör yerine tek bir `run.js` oluşturuldu. 14 adımın tamamı `--clinic=N` parametresi ile çalışıyor. Eski `run_migration_orchestration.js` arşivlendi.

### Düzeltme 3: N+1 sorgu ve O(n²) optimizasyonları — `load_mysql.js`
**Tarih:** 2026-02-10  
**Detay:** Hasta ve randevu var-mı kontrolü toplu SELECT ile yapılıyor. Muayene-randevu eşleşmesi Map ile O(1).

---

## 📊 Etki Matrisi

| # | Sorun | Önceki Risk | Düzeltme Durumu |
|---|---|---|---|
| K1 | İkili orkestrasyon | Yanlış script çalıştırma | ✅ Birleştirildi |
| K2 | Hardcoded CLINIC_ID | Multi-tenant devre dışı | ✅ CLI parametresi |
| K3 | Path tutarsızlığı | MODULE_NOT_FOUND | ✅ Düzeltildi |
| T1 | N+1 sorgu | Performans darboğazı | ✅ Batch kontrol |
| T2 | O(n²) eşleşme | CPU darboğazı | ✅ Map kullanımı |
| T3 | ROW_NUMBER | Timeout riski | ✅ Cursor pagination |
| T4 | Transaction yok | Veri bütünlüğü | ⬜ Gelecek iterasyon |
| T5 | Dosya batch=10 | Yavaş dosya migrasyonu | ⬜ Gelecek iterasyon |
| Y1 | Validation yok | Sessiz veri kaybı | ⬜ Gelecek iterasyon |
| Y2 | Dosya logu yok | Debug imkansızlığı | ⬜ Gelecek iterasyon |
| Y3 | Dry-run yok | Riskli deployment | ⬜ Gelecek iterasyon |
| Y4 | Dağınık yapı | Bakım zorluğu | ⬜ Gelecek iterasyon |
