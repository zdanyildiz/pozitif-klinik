# Intermedia Veri Aktarım Rehberi

Bu dizin, Intermedia (MSSQL) tabanlı sistemlerden Pozitif Klinik (MySQL) platformuna veri aktarımı sağlamak için kullanılan scriptleri içerir.

## Ana Aktarım Akışı

Yeni bir klinik müşterisi için aktarım şu sıra ile yapılmalıdır:

1.  **`migrate_data.js`**: Temel verileri (Hastalar, Randevular, Epikrizler, Kullanıcılar) aktarır.
2.  **`migrate_lab_data.js`**: Laboratuvar sonuçlarını ve değerlerini aktarır.
3.  **`migrate_lab_metadata.js`**: Laboratuvar test tanımlarını ve normal değer aralıklarını aktarır.
4.  **`migrate_files.js`**: Hasta dosyalarını ve dökümanlarını (UUID ile) aktarır.
5.  **`migrate_payments.js`**: Finansal kayıtları ve ödemeleri aktarır.

## Yeni Eklenen Branş Bazlı Veri Aktarımı (Merge)

Doktorlar bazı verileri branş tablolarına (`UZM_...`) girmiş olabilir. Bu verileri ana tabloya birleştirmek için:

1.  **`merge_specialty_data.js`**: `UZM_ICHASTALIKLARI` tablosundaki gerçek klinik notlarını `cln_examinations` tablosuna aktarır. Eksik randevu kayıtlarını da otomatik oluşturur.
2.  **`categorize_specialty.js`**: Aktarılan verileri branş koduyla (`IC_HASTALIKLARI` vb.) işaretler.

## Tanı ve ICD Kodları
*   **`check_icd_table.js`**: ICD-10 kütüphanesini kontrol eder.
*   **`verify_data_presence.js`**: Aktarılan verilerin doluluk oranını kontrol eder.

## Gereksinimler
- Node.js (mssql, mysql2 paketleri)
- MSSQL (Kaynak) ve MySQL (Hedef) veritabanı erişimi
- `.env` dosyasındaki şifreleme anahtarları (AES-256 için)
