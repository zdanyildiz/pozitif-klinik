# Veri Tablosu Eşleştirme Raporu

Yapılan analizler sonucunda, daha önce eksik olduğu düşünülen tabloların veritabanındaki karşılıkları tespit edilmiş ve doğrulanmıştır.

## 1. Tespit Edilen Tablo Eşleşmeleri

| Eksik Veri Tipi | Veritabanındaki Tablo Adı | Doğrulama |
| :--- | :--- | :--- |
| **DOKTORLAR / PERSONEL** | **`KULLANICILAR`** | `TAKIPNO` sütunu, diğer tablolardaki `DOKTOR_ID`, `ACANKIM` alanlarıyla eşleşmektedir. (Örn: ID 2 = Erhan Özel) |
| **HİZMET / İŞLEM TANIMLARI** | **`TETKIK`** | `KOD` sütunu, `HST_ISLEMLER` tablosundaki `ISLEMNO` ile eşleşmektedir. (Örn: 590010 = İç Hastalıkları Muayenesi) |
| **KURUMLAR / SİGORTA** | **`SIRKETLER`** | `KOD` sütunu, hasta ve geliş kayıtlarındaki `SIRKETNO` ile eşleşmektedir. (Örn: 1 = SGK, 3 = Ak Sigorta) |
| **FİYAT LİSTELERİ** | **`TETKIK_FIYATLAR`** | `ISLEMNO` üzerinden `TETKIK` tablosuna bağlanır ve işlem fiyatlarını tutar. |

## 2. İlişki Şeması (Güncel)

*   **Hasta - Doktor İlişkisi:**
    *   `HST_GELISLER.DOKTOR_ID`  --> `KULLANICILAR.TAKIPNO`

*   **Yapılan İşlem Detayları:**
    *   `HST_ISLEMLER.ISLEMNO` --> `TETKIK.KOD` (İşlem Adı)
    *   `HST_ISLEMLER.FIYAT` değeri, `TETKIK_FIYATLAR` tablosundan referans alınabilir.

*   **Kurum Bilgisi:**
    *   `HST_GELISLER.SIRKETNO` --> `SIRKETLER.KOD`

## 3. Sonuç
Veri aktarımı (migration) için gerekli olan tüm ana tablolar ve "Lookup" (Tanım) tabloları mevcuttur. Aktarım scriptleri hazırlanırken yukarıdaki eşleşmeler kullanılmalıdır.
