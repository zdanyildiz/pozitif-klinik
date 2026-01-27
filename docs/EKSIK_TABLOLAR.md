# Eksik Tablolar ve Veri İlişki Analizi

Mevcut JSON verilerindeki sütun simlerinden yola çıkarak tespit edilen eksik tablolar aşağıdadır. Veri aktarımının eksiksiz olması için bu tabloların da dökümü gerekmektedir.

## 1. Kritik Eksik Tablolar (Sistem ve Personel)
Bu tablolar olmadan "işlemi kim yaptı", "hasta hangi doktora geldi" gibi temel sorular yanıtlanamaz.

| Tahmini Tablo Adı | İlişkili Sütunlar (JSON Verisindeki) | Açıklama |
| :--- | :--- | :--- |
| **KULLANICILAR / PERSONEL** | `ACANKIM`, `SILENKIM`, `SONISLEMKIM`, `IPTALKIM`, `ONAYLAYAN`, `KAYDEDEN`, `ISTEYEN`, `YAPAN` | Sistemi kullanan tüm personelin (sekreter, hemşire, doktor) listesi. Örnek verilerde `1`, `2`, `6`, `7` gibi ID'ler var. |
| **DOKTORLAR** | `DOKTOR_ID`, `DOKTORU`, `MEDULA_DR` | Doktorların listesi. Muhtemelen `KULLANICILAR` tablosu ile ilişkili veya ayrı bir tablo. |
| **SUBELER / POLIKLINIKLER** | `SUBE_ID` | Hastanenin şubeleri veya poliklinikleri. |

## 2. Tanım ve Hizmet Tabloları (Finansal ve Operasyonel)
"Yapılan işlem nedir?" sorusunun cevabı bu tablolardadır. Şu an sadece işlemin kodu (örn: 590010) var, adı yok.

| Tahmini Tablo Adı | İlişkili Sütunlar | Açıklama |
| :--- | :--- | :--- |
| **HIZMETLER / STOKLAR** | `ISLEMNO`, `PAKETKODU`, `BUT_PAKETKODU` | Yapılan işlemlerin tanımları (Örn: "Dahiliye Muayenesi", "Tam Kan Sayımı"). Fiyat listesi isimleri de burada olabilir. |
| **KURUMLAR / SIRKETLER** | `SIRKETNO`, `SGK_KURUM`, `SG_KURUM` | Hastanın bağlı olduğu sigorta kurumları veya şirketler. |
| **BRANSLAR / UZMANLIKLAR** | `UZMANLIK_ID` | Tıbbi birimlerin listesi. |
| **ODEME_TURLERI** | `ODEMETURU`, `ODEMETURUNO` | Nakit, Kredi Kartı vb. ödeme tipi tanımları. |

## 3. Demografik Referans Tabloları
Adres ve kimlik bilgilerinin standartlaştırılması için gereklidir.

| Tahmini Tablo Adı | İlişkili Sütunlar | Açıklama |
| :--- | :--- | :--- |
| **ILLER / ILCELER** | `NK_ILKODU`, `NK_ILCEKODU` | MERNIS uyumlu il/ilçe kodları. |
| **MESLEKLER** | `MESLEK` (ID olarak tutuluyorsa) | Meslek kodları listesi. |
| **TANIMLAR (Genel)** | `GelisNedeniID`, `TedaviTuruID`, `VakaTuruID` | Geliş nedenleri, vaka türleri gibi genel tanımlar. |

## 4. Tıbbi Tanımlar
| Tahmini Tablo Adı | İlişkili Sütunlar | Açıklama |
| :--- | :--- | :--- |
| **ICD_TANILAR** | `TANI` (Eğer kod olarak tutulsaydı) | Mevcut veride tanılar "Metin" olarak görünüyor, ancak arka planda bir kod tablosu olabilir. |
| **LAB_TEST_TANIMLARI** | `TESTNO` | `HST_LAB_BIYOKIMYA` tablosundaki `271820.0` gibi kodların karşılığı (Örn: "Glukoz", "Üre"). |

---

### Alınacak Aksiyon
Veritabanı yöneticisinden aşağıdaki SQL sorgusuna benzer bir sorgu ile **tablo listesini** istemek faydalı olabilir:

```sql
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME
```

Bu liste üzerinden yukarıdaki eksikler teyit edilerek JSON dökümleri istenmelidir.
