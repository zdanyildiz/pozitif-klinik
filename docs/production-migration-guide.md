# Canlı Sunucu Migrasyon ve Senkronizasyon Rehberi

Bu belge, yeni bir kliniğin verilerini canlı sunucuya aktarma ve local ortamdaki verileri güncel tutma adımlarını içerir.

## 1. Canlı Sunucuya Veri Aktarımı (Migration)

Canlı sunucuda yeni bir klinik verisi eklemek için şu adımları izleyin:

### A. Hazırlık (Local)
1.  Local MSSQL üzerinden verileri export edin:
    ```bash
    node scripts/intermedia-migration/migration/extract_mssql.js
    ```
2.  Oluşan `scripts/intermedia-migration/data/migration_data.json` dosyasını canlı sunucuya (aynı dizine) kopyalayın (SCP/SFTP).

### B. Uygulama (Canlı)
1.  Canlı sunucuda ssh ile bağlanın.
2.  Yeni orkestrasyon scriptini çalıştırın:
    ```bash
    # Bu komut mevcut verileri silmez, sadece migration_data.json içindeki kliniği ekler
    node scripts/intermedia-migration/run_migration_orchestration.js --append
    ```

---

## 2. Local Verileri Canlıdan Güncelleme (Sync)

Local verilerinizin eski kalmaması için canlı veritabanından bir dump alıp locale yüklemek en temiz yöntemdir.

### Otomatik Senkronizasyon Scripti (`db:sync`)

Aşağıdaki komutu local terminalinizde çalıştırarak canlıdaki son durumu locale çekebilirsiniz:

```bash
# Canlıdan dump al ve locale yükle (Örnek workflow)
ssh user@live-server "mysqldump -u db_user -p db_name" > live_dump.sql
mysql -u local_user -p local_db_name < live_dump.sql
```

---

## 3. Önemli Notlar

- **ID Çakışmaları**: `load_mysql_v2.js` artık veritabanı ID'lerini kendisi oluşturduğu için `Duplicate ID` hatası almazsınız.
- **Dosya Transferi**: `migrate_files.js` çalıştırıldıktan sonra `storage/app/tenants/{clinic_id}` klasörünü de canlı sunucuya taşımayı unutmayın.
- **Yedekleme**: Herhangi bir migrasyon öncesi canlı veritabanının bir yedeğini (Snapshot/Dump) almanız **ŞİDDETLE** tavsiye edilir.
