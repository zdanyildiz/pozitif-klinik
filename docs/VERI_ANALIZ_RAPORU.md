# Veri Analiz Raporu: Pozitif Klinik Veri Aktarımı

**Tarih:** 2026-01-27
**Konu:** MSSQL veritabanından alınan JSON formatındaki örnek kayıtların analizi

## 1. Genel Bakış
`docs/tablo-sql` dizinindeki JSON dosyaları incelenmiş ve eski klinik veritabanının yapısı analiz edilmiştir. İncelenen ana dosyalar:
- **Hasta Kayıtları:** `HST_ANADOSYA`
- **Geliş/Muayene Kayıtları:** `HST_GELISLER`
- **İşlemler/Hizmetler:** `HST_ISLEMLER`
- **Tıbbi Geçmiş:** `HST_TIBBI_ANAMNEZ`, `HST_TIBBI_EPIKRIZ`, `HST_TIBBI_EPIKRIZ_TAKIP`

## 2. Veri Yapısı ve İlişkiler

### A. Ana Tablolar
*   **Hasta Kartı (`HST_ANADOSYA`):**
    *   Temel kimlik (`HASTANO`, `TCKIMLIKNO`), iletişim (`EV_TELEFON`, `EV_ADRES`) ve demografik bilgileri içerir.
    *   Veri kalitesi iyi görünmektedir.
    *   **İlişki:** `HASTANO` alanı diğer tüm tablolar için ana anahtardır.

*   **Gelişler/Muayeneler (`HST_GELISLER`):**
    *   Hastanın kliniğe gelişlerini tutar.
    *   İlişki: `HASTANO` ile hastaya, `DOKTOR_ID` ile doktora bağlanır.
    *   Her gelişin benzersiz bir `GELISNO`'su vardır.

*   **İşlemler (`HST_ISLEMLER`):**
    *   Muayene sırasında yapılan işlemleri ve ücretlerini tutar.
    *   İlişki: `GELISNO` ile geliş kaydına bağlanır.

### B. Tıbbi Veriler (Karmaşık Yapı)
Tıbbi notlar ve geçmiş bilgileri birden fazla tabloya dağılmış ve karmaşık bir yapıdadır:
1.  **`HST_TIBBI_ANAMNEZ`**: Geliş (`GELISNO`) ile tıbbi dosya (`TIBBIDOSYANO`) arasında bağlantı kuruyor gibi görünmektedir ancak örnek kayıtların çoğunda içerik alanları boştur.
2.  **`HST_TIBBI_EPIKRIZ`**: Sonuç, teşhis ve tetkik notlarını tutar. `TIBBIDOSYA_ID` üzerinden bağlanır.
3.  **`HST_TIBBI_EPIKRIZ_TAKIP`**: Bu tablo en zengin tıbbi metin içeriğine (`SIKAYETLER`, `TESHIS`, `TEDAVI`, `HIKAYESI`) sahiptir. Epikriz üzerindeki değişikliklerin tarihçesini (`TAKIP`) tutuyor gibi görünmektedir. Göç sırasında en güncel notun buradan alınması gerekebilir.

## 3. Tespit Edilen Eksiklikler ve Riskler

### 1. Referans (Lookup) Tabloları Eksik
Verilerde geçen bazı ID ve kodların karşılıkları bu dışa aktarımda bulunmamaktadır. Bu tablolar olmadan veriler tam anlamlandırılamaz:
*   **Doktorlar:** `DOKTOR_ID` (örn: 2, 4) kime ait? (`USERS` veya `DOKTORLAR` tablosu eksik)
*   **İşlem/Hizmet Tanımları:** `HST_ISLEMLER` tablosunda `ISLEMNO` (örn: 590010) var ancak işlemin adı yok.
*   **Kurum/Sigorta:** `SIRKETNO` ve `KURUM` bilgileri için tanım tabloları.

### 2. Örnek Veri Uyuşmazlığı (Referential Integrity)
Analiz edilen dosyalar her tablodan "İlk 20" (`TOP 20`) kaydı içermektedir. Ancak bu tabloların sıralaması farklı olduğundan, kayıtlar birbirini tamamlamamaktadır.
*   *Örnek:* `HST_GELISLER` tablosundaki 1 numaralı gelişin, `HST_ISLEMLER` veya `HST_TIBBI` tablolarında karşılığı bu örnek sette yoktur (Tıbbi tablolardaki `GELISNO`lar 65.000'lerdedir).
*   *Risk:* Migration scriptlerini test ederken ilişkilerin doğru kurulup kurulmadığını bu örnek verilerle test etmek imkansızdır.

### 3. Tıbbi Notların Yapısı
Tıbbi veriler (`SIKAYETLER`, `TESHIS` vb.) serbest metin (free-text) formatındadır. Yeni sisteme aktarılırken bu verilerin yapılandırılması (örn: ICD kodlarına dönüştürülmesi) otomatik olarak yapılamaz, "Notlar" veya "Eski Sistem Geçmişi" olarak metin bloğu halinde aktarılması gerekecektir.

## 4. Öneriler ve Sonraki Adımlar

1.  **Eksik Tabloların İstenmesi:** Acilen Doktorlar, İşlem Tanımları (Stok/Hizmet) ve Kurum listelerinin JSON halleri istenmeli.
2.  **İlişkisel Veri Seti İsteği:** Rastgele ilk 20 kayıt yerine, spesifik **5 adet Hasta** ve bu hastalara ait **TÜM** geçmişin (Gelişler, İşlemler, Tıbbi Notlar) olduğu tutarlı bir veri seti istenmeli.
3.  **Veri Aktarım Stratejisi:**
    *   Hastalar ve Muayeneler doğrudan ilişkilendirilebilir.
    *   Tıbbi notlar için `HST_TIBBI_EPIKRIZ_TAKIP` tablosundaki en son tarihli kaydın esas alınması gereken bir mantık kurulmalı.
