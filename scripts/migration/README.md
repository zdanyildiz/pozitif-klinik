# Pozitif Klinik Veri Aktarım Araçları

Bu klasör, farklı kliniklerden (MSSQL tabanlı eski sistemlerden) Pozitif Klinik (MySQL/Laravel tabanlı yeni sistem) platformuna veri aktarımı yapmak için kullanılan scriptleri içerir.

## Dosya Yapısı ve Kullanım Sırası

### 1. Hazırlık ve Keşif
*   **`utils/check_mssql_columns.js`**: Eski veritabanındaki tablo ve sütun isimlerini kontrol etmek için kullanılır. Her kliniğin veritabanı şeması küçük farklılıklar gösterebilir.
*   **`utils/sample_mssql_data.js`**: Veri yapısını ve ilişkileri doğrulamak için tablolardan örnek kayıtlar çeker.

### 2. Hedef Veritabanını Hazırlama
*   **`prepare_mysql_schema.js`**: Yeni MySQL veritabanına, eski sistemden gelen verileri (legacy_id, vb.) ve ek alanları (baba adı, şikayetler, vb.) eklemek için gerekli `ALTER TABLE` komutlarını çalıştırır. **Önemli:** Veri aktarımından önce mutlaka bir kez çalıştırılmalıdır.

### 3. Veri Çıkarma (Extract)
*   **`extract_mssql.js`**: MSSQL veritabanına bağlanır ve tüm ana tabloları (Hastalar, Randevular, Tıbbi Notlar, Hizmetler, Kullanıcılar) ilişkisel olarak çeker. Çıktı olarak `docs/migration_data.json` dosyasını oluşturur.
    *   *Yapılandırma:* Dosya başındaki `mssqlConfig` ve `CLINIC_ID` değişkenlerini her klinik için güncelleyin.

### 4. Veri Yükleme (Load)
*   **`load_mysql.js`**: `docs/migration_data.json` dosyasını okur ve verileri yeni sisteme aktarır.
    *   **Kritik İşlevler:**
        *   KVKK uyumu için Hasta adlarını, telefonlarını ve TC kimlik numaralarını **şifreler** (`src/Core/Security/CryptoService.php` ile tam uyumlu).
        *   Şifreli veriler üzerinde arama yapılabilmesi için **Blind Index** (hash) oluşturur.
        *   Tablolar arası ilişkileri (Eski ID -> Yeni ID) otomatik eşleştirir.
    *   **Uyarı:** Script her çalıştırıldığında hedef tablolara `TRUNCATE` atar (temiz başlangıç).

## Dikkat Edilmesi Gerekenler
1.  **Şifreleme Anahtarı:** `load_mysql.js` içindeki `APP_KEY`, `.env` dosyasındaki anahtar ile aynı olmalıdır.
2.  **Klinik ID:** Her yeni aktarımda hedef kliniğin `CLINIC_ID` bilgisini doğru set ettiğinizden emin olun.
3.  **Performans:** Büyük veri setleri için insert işlemleri batch (toplu) modda yapılır, ancak tıbbi notlar gibi 100k+ kayıtlarda işlem süresi 5-10 dakikayı bulabilir.
