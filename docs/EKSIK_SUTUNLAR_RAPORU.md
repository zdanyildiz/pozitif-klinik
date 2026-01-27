# Veri Aktarımı İçin Veritabanı Eksiklik Analizi

Eski sistem verileri (`HST_ANADOSYA`, `HST_GELISLER`, vb.) ile yeni sistem şeması (`ptn_cards`, `cln_appointments`, vb.) karşılaştırıldığında, veri kaybı yaşanmaması için aşağıdaki tablo ve sütunların yeni sisteme eklenmesi gerektiği tespit edilmiştir.

## 1. Hasta Kartları (`ptn_cards`)
Hasta kayıtlarında demografik verilerin tam taşınabilmesi ve çocuk hastaların takibi için aşağıdaki alanlar eksiktir.

| Eski Sütun Adı | Önerilen Yeni Sütun | Tip | Önem Düzeyi | Açıklama |
| :--- | :--- | :--- | :--- | :--- |
| `BABAADI` | `father_name` | VARCHAR(100) | Yüksek | Çocuk hastalarda yasal veli tespiti için kritik. |
| `ANNEADI` | `mother_name` | VARCHAR(100) | Yüksek | Çocuk hastalarda yasal veli tespiti için kritik. |
| `DOGUMYERI` | `birth_place` | VARCHAR(100) | Orta | Demografik analiz için. |
| `MESLEK` | `profession` | VARCHAR(100) | Düşük | İstatistiki veri. |
| `UYRUGU` | `nationality` | VARCHAR(10) | Orta | Yabancı hasta ayrımı için (TR, DE vb.). |
| `HASTANO` | `legacy_id` | BIGINT | **Kritik** | Eski sistemdeki ID ile ilişki kurmak ve veri tutarlılığını sağlamak için şart. |

## 2. Muayene/Tıbbi Kayıtlar (`cln_examinations`)
Yeni sistemde sadece `anamnez` ve `bulgular` alanları mevcuttur. Eski sistemdeki zengin tıbbi geçmişi (Şikayet, Hikaye, Tanı, Tedavi) ayrıştırarak tutmak için aşağıdaki alanlar gereklidir.

| Eski Sütun Adı | Önerilen Yeni Sütun | Tip | Açıklama |
| :--- | :--- | :--- | :--- |
| `SIKAYETLER` | `complaint` | TEXT | Hastanın geliş şikayeti. |
| `TESHIS` | `diagnosis` | TEXT | Konulan teşhisler (Serbest metin). |
| `TEDAVI` | `treatment` | TEXT | Uygulanan tedavi ve reçete notları. |
| `SONUC` | `result_note` | TEXT | Muayene sonucu veya karar notu. |

## 3. Randevu/Geliş Kayıtları (`cln_appointments`)
| Eski Sütun Adı | Önerilen Yeni Sütun | Tip | Açıklama |
| :--- | :--- | :--- | :--- |
| `PROTOKOLNO` | `protocol_no` | VARCHAR(50) | Resmi protokol numarası takibi için. |
| `GELISNO` | `legacy_visit_id` | BIGINT | Eski sistemdeki geliş kaydıyla eşleşme için. |

---

## Öneri ve Sonraki Adım
Veri aktarımına başlamadan önce bu eksik sütunların veritabanına eklenmesi gerekmektedir. Hazırlanan `00_alter_tables_for_migration.sql` dosyası ile bu değişiklikler uygulanabilir.
