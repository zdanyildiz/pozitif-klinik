# Dosya ve Laboratuvar Sonuçları Aktarım Planı

Bu belge, eski MSSQL veritabanında gömülü (binary) olarak tutulan laboratuvar sonuçlarının ve harici dosya yollarının, yeni Pozitif Klinik dosya mimarisine (`sys_files`) aktarılması için gereken adımları içerir.

## 1. Kaynak Analizi

Eski sistemde dosyalar iki farklı yapıda tutulmaktadır:

### A. Gömülü Binary Veriler (`HST_LAB_RAPOR`)
Laboratuvar sonuçları doğrudan veritabanında `IMAGE` (blob) formatında saklanmaktadır.
*   **Tablo:** `HST_LAB_RAPOR`
*   **Kolonlar:**
    *   `ID`: Kayıt ID
    *   `GELISNO`: Randevu/Geliş Numarası (Bağlantı anahtarı)
    *   `RAPOR`: Binary dosya verisi (Genellikle RTF, PDF veya Resim)
    *   `TARIH`: Rapor tarihi

### B. Dosya Yolları (`HST_TIBBI_DOSYALAR`)
Tıbbi dosyalar disk üzerinde tutulup, veritabanında sadece yolları saklanmaktadır.
*   **Tablo:** `HST_TIBBI_DOSYALAR`
*   **Kolonlar:**
    *   `GELISNO`: Randevu ID
    *   `DOSYAADI`: Orijinal dosya ismi
    *   `DOSYAYOLU`: Dosyanın eski sunucudaki konumu (Erişim gerektirir)

**Not:** Bu plan öncelikli olarak **Gömülü (A)** verilerin kurtarılmasına odaklanacaktır.

## 2. Aktarım Stratejisi

Aktarım işlemi `scripts/migrate_files.js` adlı yeni bir Node.js scripti ile gerçekleştirilecektir.

### Adım 1: Hazırlık
1.  Yeni sistemde `sys_files` tablosunun mevcut ve temiz olduğundan emin olunacak.
2.  `storage/app/uploads/{clinic_id}/{YIL}/{AY}` dizin yapısı oluşturulacak.
3.  Eski `GELISNO` ile yeni `cln_appointments.id` eşleştirmesi için MySQL'den lookup verisi çekilecek.

### Adım 2: Binary Verilerin Okunması ve Dosyalaştırılması
1.  MSSQL'den `HST_LAB_RAPOR` tablosu okunacak (Streaming veya Chunking ile).
2.  Her bir kayıt için:
    *   `RAPOR` kolonu okunup, dosya türü (Magic Bytes) tespit edilecek (PDF, JPG, RTF, PNG).
    *   Eğer tür tespit edilemezse varsayılan olarak `.dat` veya içerik analizine göre işlem yapılacak.
    *   Benzersiz bir dosya ismi (UUID) oluşturulacak.
    *   Dosya fiziksel olarak hedef dizine kaydedilecek.

### Adım 3: Veritabanı Kaydı (`sys_files`)
Oluşturulan dosya için MySQL `sys_files` tablosuna kayıt atılacak:
*   `clinic_id`: Aktarım yapılan klinik ID (Örn: 1)
*   `module`: `'examination'` (Muayene ile ilişki)
*   `related_id`: MySQL'deki `cln_appointments.id` (Eşleşen `legacy_visit_id` üzerinden bulunur)
*   `original_name`: "Laboratuvar Sonucu - {ID}.{ext}"
*   `storage_path`: `{YIL}/{AY}/{UUID}.{ext}`
*   `mime_type`: Tespit edilen MIME type
*   `file_hash`: Dosyanın SHA-256 hash'i
*   `size_kb`: Dosya boyutu / 1024

## 3. Script Yapısı (`scripts/migrate_files.js`)

```javascript
// Taslak Kod Bloğu (Uygulama aşamasında detaylandırılacaktır)
const sql = require('mssql');
const mysql = require('mysql2/promise');
const fs = require('fs');
const crypto = require('crypto');
const { fileTypeFromBuffer } = require('file-type'); // Opsiyonel: Dosya türü tespiti için

// 1. Bağlantıları Kur
// 2. MySQL'den Randevu Eşleştirmelerini Al (Map: LegacyID -> NewID)
// 3. MSSQL'den HST_LAB_RAPOR Çek
// 4. Döngü ile İşle:
//    - Buffer'dan dosya türü bul
//    - UUID üret ve diske yaz
//    - sys_files Insert Query hazırla
// 5. Raporla
```

## 4. Dosya Türü Tespiti (Magic Bytes)
Binary verinin formatı veritabanında yazmadığı için, buffer'ın ilk byte'larına bakılarak karar verilecek:
*   `%PDF` -> `application/pdf`
*   `{\rtf` -> `application/rtf` (RTF ise PDF'e dönüştürme gerekebilir veya olduğu gibi saklanır)
*   `FF D8` -> `image/jpeg`
*   `89 50` -> `image/png`

## 5. Uygulama Adımları
1.  `npm install file-type uuid` komutu ile gerekli paketler yüklenecek (Eğer yoksa).
2.  Script çalıştırılacak: `node scripts/migrate_files.js`
3.  Oluşan dosyalar ve veritabanı kayıtları kontrol edilecek.
4.  Frontend (`file_manager.twig`) üzerinden randevu detayında dosyaların görünürlüğü test edilecek.

## 6. Migration Durumu (Son Güncelleme)
`scripts/migrate_files.js` scripti hazırlanmış ve çalıştırılmıştır.
- **Tarih:** 31.01.2026
- **Bulgu (Dosya):** Mevcut MSSQL veritabanında `HST_LAB_RAPOR` ve `HST_TIBBI_DOSYALAR` tabloları boş (0 kayıt) olduğu gözlemlenmiştir. Bu nedenle binary dosya aktarımı yapılamamıştır.
- **Bulgu (Veri):** Binary yerine `HST_LAB_BIYOKIMYA` tablosunda **sayısal test sonuçları** (Glukoz, Hemogram vb.) bulunmuştur.
- **Aksiyon:** `scripts/migrate_lab_data.js` yazılarak bu veriler `cln_lab_results` tablolarına aktarılmıştır.
- **Sonuç:** 826 adet laboratuvar sonucu başarıyla yeni sisteme aktarılmış ve randevularla eşleştirilmiştir.
