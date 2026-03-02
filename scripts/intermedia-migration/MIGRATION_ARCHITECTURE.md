# Intermedia Migrasyonu: Mimari Kararlar ve Veri Güvenliği

Bu doküman, Intermedia (MSSQL) sisteminden Pozitif Klinik (MySQL) sistemine geçiş sırasında uygulanan temel mimari kararları, güvenlik standartlarını ve veri eşleştirme mantığını açıklamaktadır.

## 1. Mimari Yaklaşım: Üç Aşamalı ETL
Süreç, doğrudan veritabanından veritabanına (DB-to-DB) aktarım yerine, daha kontrollü olan üç aşamalı bir yapıya evrilmiştir:

1.  **Extraction (Çıkarma):** MSSQL'den ham veriler okunur ve branş bazlı dağınık muayene verileri birleştirilerek JSON formatına dönüştürülür.
2.  **Transformation (Dönüşüm):** JSON verileri üzerinde temizlik, normalizasyon ve multi-tenant hazırlığı yapılır.
3.  **Loading (Yükleme):** Veriler şifrelenerek (AES-256) ve arama indeksleri (Blind Index) oluşturularak hedef MySQL veritabanına yazılır.

## 2. Veri Güvenliği ve KVKK Standartları

Aktarım sırasında tüm hassas veriler aşağıdaki güvenlik katmanlarından geçer:

### 2.1 Veri Şifreleme (Encryption)
- **Yöntem:** `AES-256-GCM` standardı kullanılır.
- **Kapsam:** Hasta adı, TC Kimlik No, Telefon, E-posta ve Adres bilgileri veritabanında şifreli olarak saklanır.
- **Anahtar Yönetimi:** Şifreleme anahtarı projenin ana `.env` dosyasındaki `APP_KEY` üzerinden türetilir.

### 2.2 Blind Index ile Güvenli Arama
- **Sorun:** Şifreli veriler üzerinde standart SQL sorguları (`LIKE %...%`) çalışmaz.
- **Çözüm:** Hassas verilerin normalleştirilmiş halleri `SHA-256 HMAC` ile hash'lenerek `search_index` tablosuna yazılır.
- **Kullanım:** Arama yapıldığında, aranan kelime aynı hash algoritmasıyla dönüştürülür ve index tablosunda eşleştirilir. Bu sayede veritabanı çalınsa dahi, arama anahtarları üzerinden gerçek verilere ulaşılamaz.

## 3. Akıllı Veri Birleştirme

### 3.1 JSON Metadata Yapısı (`extra_metadata`)
Eski sistemdeki onlarca farklı sütuna yayılmış (alerjiler, kronik hastalıklar, arşiv bilgileri vb.) ikincil veriler, ana tablo şemasını şişirmemek için `ptn_cards` tablosundaki `extra_metadata` JSON alanına toplanır.

### 3.2 Muayene Verilerinin Konsolidasyonu
MSSQL'de branşlara göre (`UZM_KARDIYO`, `UZM_KBB` vb.) farklı tablolarda tutulan anamnez bilgileri, `GELISNO` (Visit ID) üzerinden birleştirilerek MySQL'deki `cln_examinations` tablosuna tek bir kayıt olarak aktarılır.

## 4. İlişkisel Veri Eşleştirme

- **Legacy ID Takibi:** Her kayıt (Hasta, Randevu, Ödeme vb.) eski sistemdeki orijinal ID'sini `legacy_id` veya `legacy_visit_id` alanında saklar. Bu, aktarımın yarıda kalması durumunda kaldığı yerden devam etmesini (idempotency) sağlar.
- **Coğrafi Veriler:** İl ve ilçe isimleri metin olarak çekilir ve yükleme aşamasında Pozitif Klinik'in merkezi `sys_provinces` ve `sys_districts` tablolarıyla ID bazlı otomatik eşleştirilir.
