# Intermedia Migrasyonu: Mimari Değişiklikler ve Kararlar

Bu doküman, Intermedia (MSSQL) sisteminden Pozitif Klinik (MySQL) sistemine veri aktarımı sırasında yapılan mimari geliştirmeleri, yeni eklenen alanları ve veri eşleştirme mantığını açıklamaktadır.

## 1. Konfigürasyon ve Altyapı
**Merkezi Yönetim (`db.config.json` & `db.helper.js`)**
Veritabanı bağlantı ayarları, şifreleme anahtarları ve migrasyon parametreleri (batch size, clinic id) tek bir JSON dosyasında toplanmıştır.
- **Konfigürasyon:** `scripts/intermedia-migration/db.config.json`
- **Helper:** `scripts/intermedia-migration/db.helper.js` (Environment variable desteği ile)

## 2. Mimari Kararlar ve Yaklaşım

### 2.1 JSON Metadata Yapısı (`extra_metadata`)
**Amaç:** Eski sistemdeki dağınık tıbbi ve arşivsel verileri, ana tablo şemasını (RDBMS) kirletmeden esnek bir yapıda toplamak.

**Neden?**
- Eski sistemde alerjiler, kronik hastalıklar ve arşiv bilgileri onlarca farklı sütuna yayılmıştı.
- Bu veriler her zaman sorgu kriteri (index) gerektirmez, ancak hasta kartında bir bütün olarak görülmesi kritiktir.
- JSON yapısı, gelecekte farklı branşlardan gelecek yeni veri tiplerine (örn: Diş hekimliği özel verileri) şema değişikliği yapmadan uyum sağlar.

**Kapsam:**
```json
{
  "medical": {
    "allergies": { "drug": "...", "substance": "..." },
    "chronic_diseases": ["Diyabet", "Hepatit", "..."],
    "medical_warnings": "..."
  },
  "archival": {
    "archive_no": "...",
    "family_no": "..."
  },
  "insurance": {
    "policy_no": "...",
    "institution": "..."
  }
}
```

### 2.2 İlişkisel Veri Eşleştirme (İl/İlçe)
**Yöntem:** String birleştirme yerine, Pozitif Klinik'in `sys_provinces` ve `sys_districts` tablolarıyla ID bazlı ilişki kurulur.

**Mantık:**
- `extract_mssql.js` ile il ve ilçe isimleri metin olarak çekilir.
- `load_mysql.js` aşamasında bu metinler, hedef sistemdeki mevcut coğrafi veri setiyle (Case-insensitive) eşleştirilir.
- Eşleşen kayıtlar `province_id` ve `district_id` sütunlarına fiziksel anahtar (Foreign Key) olarak yazılır.

### 2.3 Metin Birleştirme Stratejisi (Lab & Radyoloji)
**Sorun:** Eski sistemde tetkik sonuçları ve radyoloji raporları, yapılandırılmış veri yerine metin blokları halinde (text) tutuluyordu ve farklı sütunlardaydı.
**Çözüm:** Bu veriler `cln_examinations` tablosundaki `lab_result_text` alanında birleştirilir.
**Format:**
```text
LABORATUVAR:
{Eski sistemdeki Lab sonucu}

RADYOLOJI:
{Eski sistemdeki Radyoloji sonucu}
```
Bu işlem `merge_specialty_data.js` scripti ile yapılır.

## 3. Şema Seviyesindeki Değişiklikler

Yapılan tüm geliştirmeler projenin orijinal SQL dosyalarına (`migration/database/migrations/`) yansıtılmıştır:

### 3.1 Hasta Kartları (`ptn_cards`)
- **`extra_metadata` (JSON):** Yukarıda açıklanan tıbbi ve idari profili tutar.
- **`legacy_id`:** Eski sistemdeki `HASTANO` bilgisini tutar (Geriye dönük takip için).
- **`father_name`, `mother_name`, `birth_place`:** Standart hasta profilini tamamlayan ek alanlar.

### 3.2 Muayene Kayıtları (`cln_examinations`)
- **Tıbbi Alanlar:** `complaint` (Şikayet), `story` (Hikaye), `diagnosis` (Tanı), `treatment` (Tedavi), `bulgular` (Fizik Muayene) ve `result_note` (Genel Sonuç) alanları eklendi.
- **Birleştirilmiş Alan:** `lab_result_text` (Eski sistem Lab ve Radyoloji metinleri).
- **Esnek Yapı:** `specialty_data` (JSON) ve `specialty_code` alanları, gelecekteki branş bazlı veriler için eklendi.
- **İlişki:** `legacy_visit_id` üzerinden eski sistemdeki geliş numarasıyla (`GELISNO`) bağ kuruldu.

### 3.3 Hizmet Kataloğu (`cln_services`)
- **`legacy_code`:** Eski sistemdeki `TETKIK.KOD` bilgisini tutar. Bu sayede işlem kalemleri (adisyon) aktarılırken doğru hizmetle eşleşme sağlanır.

## 4. Veri Güvenliği ve KVKK

Aktarım sırasında şu güvenlik önlemleri uygulanmaktadır:
- **Şifreleme (Encryption):** TC No, Ad Soyad, Telefon gibi hassas veriler `AES-256-GCM` ile şifrelenir.
- **Blind Index:** KVKK uyumlu arama yapılabilmesi için hassas verilerin SHA-256 hash'leri oluşturulur.
- **Aktif/Pasif Durumu:** MSSQL'de `IPTAL` olan kayıtlar silinmez, `status: 0` olarak aktarılarak veri kaybı önlenir.

## 5. Uygulama Yöntemi

Mimari değişikliklerin sisteme uygulanması iki aşamalıdır:
1. **Sıfır Kurulum:** Proje ana SQL dosyaları güncellendiği için yeni kurulumlarda otomatik gelir.
2. **Canlı Sistem:** `apply_alters.js` scripti, mevcut veritabanlarındaki verileri bozmadan eksik sütunları `ALTER TABLE` komutlarıyla ekler.
