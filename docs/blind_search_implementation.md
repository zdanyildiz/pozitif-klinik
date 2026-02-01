# Kör İndeks (Blind Index) ve Gelişmiş Arama Geliştirme Planı

Bu döküman, **Pozitif Klinik** projesinde KVKK/GDPR uyumlu, şifreli veriler üzerinde performanslı ve esnek arama yapılabilmesi için tasarlanan mimariyi açıklar.

## 1. Amaç
Mevcut sistemde şifreli veriler üzerinde arama yapmak, deterministik şifreleme (sabit IV) gerektirdiği için güvenlik riskleri taşımakta ve büyük/küçük harf duyarlılığı nedeniyle kullanıcı deneyimini olumsuz etkilemektedir. Ayrıca "Ahmet Yılmaz" şeklindeki bir kaydı bulmak için tam ismin yazılması gerekmektedir.

Bu geliştirme ile:
1.  Veriler güvenli bir şekilde (Random IV ile) şifrelenmeye devam edecek.
2.  Arama için **normalizasyon** ve **hashleme** (Blind Indexing) yöntemi kullanılacak.
3.  Birden fazla kelimeden oluşan veriler (İsim Soyisim gibi) parçalanarak (tokenization) indekslenecek, böylece kısmi arama ("sadece ad" veya "sadece soyad" ile bulma) mümkün olacak.

## 2. Veritabanı Mimarisi

Mevcut tablolardaki (örn: `ptn_cards`) `_hash` sütunları yerine, tüm aranabilir verilerin tutulduğu merkezi bir `search_index` tablosu kullanılacaktır.

### Tablo: `search_index`

| Sütun | Tip | Açıklama |
| :--- | :--- | :--- |
| `id` | BIGINT (PK) | Benzersiz ID. |
| `table_name` | VARCHAR(50) | Kaydın ait olduğu tablo (örn: `ptn_cards`). |
| `record_id` | INT | Orijinal kaydın ID'si. |
| `type` | VARCHAR(20) | Veri tipi (örn: `name`, `tc`, `phone`). |
| `search_hash` | VARCHAR(64) | Normalizasyon sonrası alınan HMAC-SHA256 özeti. |

**İndeksler:**
1.  `IDX_SEARCH`: `(`type`, `search_hash`)` -> Arama sorguları için.
2.  `IDX_RECORD`: `(`table_name`, `record_id`)` -> Kayıt güncellendiğinde/silindiğinde indeksleri temizlemek için.

## 3. Algoritma ve Mantık

### 3.1. Normalizasyon
Arama kalitesini artırmak için ham veri sırasıyla şu işlemlerden geçer:
1.  **Türkçe Karakter Dönüşümü:** `İ` -> `i`, `I` -> `ı`, `Ğ` -> `ğ`, `Ü` -> `ü`, `Ş` -> `ş`, `Ö` -> `ö`, `Ç` -> `ç`.
2.  **Küçük Harfe Çevirme:** Tüm metin küçük harfe çevrilir.
3.  **Trim:** Baştaki ve sondaki boşluklar temizlenir.

### 3.2. Tokenizasyon (Kelime Parçalama)
Kullanıcı isteği üzerine, çok kelimeli alanlar (Ad Soyad) boşluklardan bölünerek her kelime ayrı ayrı indekslenir.

*   **Örnek Veri:** "Ali Can Yılmaz"
*   **İndekslenecek Değerler:**
    1.  `ali` -> Hashlenip kaydedilir.
    2.  `can` -> Hashlenip kaydedilir.
    3.  `yilmaz` -> Hashlenip kaydedilir.
    4.  (Opsiyonel) `ali can yilmaz` -> Tam metin de kaydedilebilir, ancak kelime bazlı arama genelde yeterlidir.

### 3.3. Hashleme (Blind Indexing)
Normalize edilmiş her parça, `HMAC-SHA256` algoritması ve **gizli bir anahtar (Blind Index Key)** ile hashlenir. Bu anahtar, veritabanı şifreleme anahtarından (`APP_KEY`) farklı olmalıdır.

## 4. Uygulama Planı

### Faz 1: Altyapı
1.  **Config:** `.env` dosyasına `BLIND_INDEX_KEY` eklenecek.
2.  **Veritabanı:** `search_index` tablosu oluşturulacak.
3.  **Servis:** `CryptoService` sınıfına `normalize($text)` ve `createBlindHash($text)` metodları eklenecek.

### Faz 2: Entegrasyon (PatientRepository & PaymentRepository)
1.  **Create/Update:**
    *   Hasta kaydedilirken Ad Soyad kelimelerine ayrılacak.
    *   TC No ve Telefon bütün olarak alınacak.
    *   Her bir parça için `CryptoService` üzerinden hash üretilip `search_index` tablosuna eklenecek.
    *   Güncelleme işleminde; önce o kayda ait eski indeksler (`table_name`, `record_id`) silinecek, sonra yenileri eklenecek.
2.  **Search (PatientRepository):**
    *   Kullanıcının girdiği arama terimi normalize edilecek ve parçalanacak.
    *   Her bir parça hashlenip `search_index` tablosunda `IN (...)` sorgusu ile aranacak.
    *   Eşleşen hasta ID'leri `ptn_cards` tablosundan çekilecek.
3.  **Search (PaymentRepository - Finans):**
    *   Finans aramasında "Zafer" gibi bir isim arandığında, `search_index` tablosunda "zafer" hash'ine sahip hasta ID'leri bulunacak.
    *   Bu ID'ler üzerinden `cln_payments` (Ödemeler) tablosuna `JOIN` veya `EXISTS` sorgusu atılarak, **sadece ödemesi olan** hastalar listelenecek.

### Faz 3: Veri Göçü (Migration)
Mevcut şifreli verilerin yeni yapıya taşınması için bir PHP CLI scripti (`scripts/migrate_blind_index.php`) hazırlanacak.
1.  `ptn_cards` tablosundaki tüm kayıtları çek.
2.  Ad, TC, Telefon alanlarını decrypt et.
3.  Yeni mantığa göre parçala ve hashle.
4.  `search_index` tablosuna (toplu insert ile) yaz.

## 5. Örnek Kullanım Senaryosu

**Kayıt:**
Hasta Adı: "Ayşe Fatma Demir"
*   `search_index` tablosuna 3 satır eklenir:
    *   Hash("ayse")
    *   Hash("fatma")
    *   Hash("demir")

**Arama (Randevu Ekranı):**
Kullanıcı "Fatma" arattığında:
1.  Sorgu: "Fatma" -> Normalize: "fatma" -> Hash: `8f3a2...`
2.  SQL: `SELECT * FROM search_index WHERE search_hash = '8f3a2...'`
3.  Sonuç: Ayşe Fatma Demir kaydı bulunur (Faturası olsun olmasın).

**Arama (Finans Ekranı):**
Kullanıcı "Fatma" arattığında:
1.  Sorgu: "Fatma" -> Normalize: "fatma" -> Hash: `8f3a2...`
2.  SQL: `SELECT p.* FROM ptn_cards p JOIN search_index si ON p.id = si.record_id JOIN cln_payments pm ON p.id = pm.patient_id WHERE si.search_hash = '8f3a2...'`
3.  Sonuç: Eğer Ayşe Fatma Demir'in **ödemesi varsa** gelir, yoksa gelmez.

Bu yapı sayesinde kullanıcı ismin herhangi bir parçasını yazarak kayda ulaşabilir ve modüle göre filtrelenmiş sonuç alır.
