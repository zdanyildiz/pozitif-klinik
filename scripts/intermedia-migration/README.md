# Intermedia MSSQL -> Pozitif Klinik MySQL Migration

Bu dizin, Intermedia (MSSQL) sistemindeki verilerin Pozitif Klinik (MySQL) veritabanına aktarılmasını sağlayan araçları içerir.

## 🚀 Hızlı Başlangıç

Tüm migrasyon sürecini tek bir komutla çalıştırabilirsiniz:

```bash
# 1 Numaralı klinik için aktarımı başlatır
node run.js --clinic=1
```

## 📂 Dökümantasyon

*   **[MIGRATION_PROCESS.md](./MIGRATION_PROCESS.md):** Aktarım adımları, veri akışı ve tablo eşleşmeleri hakkında detaylı teknik rehber.
*   **[MIGRATION_ARCHITECTURE.md](./MIGRATION_ARCHITECTURE.md):** Veri güvenliği (şifreleme), JSON metadata yapısı ve mimari kararlar.
*   **[AGENT_INSTRUCTIONS.md](./AGENT_INSTRUCTIONS.md):** YZ ajanları için özel çalışma talimatları.

## 🛠️ Ana Bileşenler

| Dosya | Görev |
| :--- | :--- |
| `run.js` | Orkestratör - Tüm adımları sırayla çalıştırır. |
| `extraction/` | MSSQL'den veri çekme ve JSON'a dönüştürme scriptleri. |
| `loading/` | JSON verilerini şifreleyerek MySQL'e yükleme scriptleri. |
| `core/db.helper.js` | Veritabanı bağlantı ve yapılandırma yardımcısı. |

## ⚠️ Önemli Uyarılar
1.  **Yedekleme:** Aktarım öncesinde hedef MySQL veritabanının yedeğini almanız önerilir.
2.  **Yapılandırma:** `db.config.json` dosyasının doğru MSSQL ve MySQL bilgilerini içerdiğinden emin olun.
3.  **Güvenlik:** Aktarılan veriler (TC, Telefon vb.) otomatik olarak şifrelenir ve arama indeksleri oluşturulur.
