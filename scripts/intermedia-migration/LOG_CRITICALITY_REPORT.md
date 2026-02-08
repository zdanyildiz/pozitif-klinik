# MSSQL Veritabanı "Log" Tabloları Kritiklik Analizi Raporu

**Tarih:** 08.02.2026 13:20:45
**Sunucu:** localhost
**Veritabanı:** ErhanOzel

## Amaç
Eski sistemdeki log içerikli tabloların incelenerek, yeni sisteme taşınma gerekliliği, yasal saklama zorunlulukları ve operasyonel önemlerinin belirlenmesi.

---

## 📊 Tablo: `AYAR_TABLOGUNCELLEME`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| TABLEADI | varchar | 100 | NO |
| IDKOLONU | varchar | 50 | NO |
| INDEXKOLONU | varchar | 50 | NO |
| ISTISNA | varchar | 250 | YES |
| SONGUNCELLEME | datetime | - | NO |
| KIM | int | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `CRM_Takip_Durum_Log`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| TakipID | int | - | NO |
| GorusmeDurumuID | smallint | - | NO |
| Notlar | nvarchar | 1000 | YES |
| GuncelleyenID | int | - | NO |
| Tarih | datetime | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `CRM_Takip_Sorumlu_Log`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| TakipID | int | - | NO |
| SorumluPersonelID | smallint | - | NO |
| Notlar | nvarchar | 1000 | YES |
| GuncelleyenID | int | - | NO |
| Tarih | datetime | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `GENELLOG`

- **Toplam Kayıt Sayısı:** 29
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| BOLUM_ID | int | - | YES |
| BOLUM | varchar | 30 | YES |
| KIM | int | - | NO |
| TARIH | datetime | - | NO |
| ACIKLAMA | varchar | 100 | NO |
| DETAY | text | 2147483647 | YES |
| TAKIPNO1 | int | - | YES |
| TAKIPNO2 | int | - | YES |
| TAKIPNO3 | int | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| RECORD_ID | BOLUM_ID | BOLUM | KIM | TARIH | ACIKLAMA | DETAY | TAKIPNO1 | TAKIPNO2 | TAKIPNO3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 300000 |  | 6 | 2025-04-12T10:00:23.217Z | Hastanın adında değişiklik yapıldı | Eski isim soyisim =Kadir   Öztop Yeni isim soyisim =Ahmet Uğur   Can | 1 | 67474 | 0 |
| 4 | 300000 |  | 6 | 2025-04-14T11:20:14.450Z | Hastanın adında değişiklik yapıldı | Eski isim soyisim =Sevim   Yılmaz Yeni isim soyisim =Sevgi   Yılmaz | 1 | 67485 | 0 |
| 5 | 300000 |  | 6 | 2025-04-24T13:30:16.117Z | Hastanın adında değişiklik yapıldı | Eski isim soyisim =Seher   Sakarkaya Yeni isim soyisim =Seher   Sakarya | 1 | 67514 | 0 |
| 6 | 300000 | Randevular_RandevuAl | 6 | 2025-04-25T10:15:27.997Z | Randevu iptal edildi | Hasta ismi =Seher Sakarya Acil işi çıkmış | 1 | 67511 | 0 |
| 7 | 300000 | Randevular_RandevuAl | 6 | 2025-04-25T10:15:38.103Z | Randevu iptal edildi | Hasta ismi =Mahmudağa Mahmud-zade Acil işi çıkmış | 1 | 67503 | 0 |
| 8 | 300000 |  | 6 | 2025-04-25T17:43:14.877Z | Hastanın adında değişiklik yapıldı | Eski isim soyisim =Sinan   Ersoy Yeni isim soyisim =Nebahat   Şengül | 1 | 67645 | 0 |
| 9 | 300000 |  | 7 | 2025-05-05T11:15:22.803Z | Hastanın adında değişiklik yapıldı | Eski isim soyisim =Mehmet Rıfat   Yaşçın Yeni isim soyisim =Mehmet Rıfat   Yalçın | 1 | 67821 | 0 |
| 10 | 300000 |  | 7 | 2025-05-05T17:52:44.383Z | Hastanın adında değişiklik yapıldı | Eski isim soyisim =Neslihan   Ertem Yeni isim soyisim =Neslihan   Erten | 1 | 67530 | 0 |
| 11 | 300000 | Randevular_RandevuAl | 6 | 2025-05-06T11:22:53.433Z | Randevu iptal edildi | Hasta ismi =Mustafa Açıkgöz Acil işi çıkmış | 1 | 67659 | 0 |
| 12 | 300000 | Randevular_RandevuAl | 7 | 2025-05-08T08:59:52.237Z | Randevu iptal edildi | Hasta ismi =Pınar Durmaz Açıklama yapmadı | 1 | 67522 | 0 |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `GENELLOG_HATAMESAJLARI`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| TARIH | datetime | - | NO |
| KIM | int | - | NO |
| HATAMESAJI | varchar | 500 | NO |
| EKRAN | image | 2147483647 | YES |
| INCELENDI | bit | - | YES |
| INCELEYEN | int | - | YES |
| INCELEMETRH | datetime | - | YES |
| NOTLAR | varchar | 500 | YES |
| MODUL | varchar | 20 | YES |
| SISTEMMESAJI | text | 2147483647 | YES |
| VERSIYON | varchar | 10 | YES |
| AktifGelisNo | int | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟠 ORTA
*   **Gerekçe:** Sistem hatalarının takibi için kritik olmakla birlikte, eski sistemden yeni sisteme taşınması "geçmiş hataların analizi" dışında şart değildir. Ancak hata ayıklama sürecinde referans olabilir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `GENELLOG_ISLEM`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ISLEM | varchar | 50 | NO |
| SONTARIH | datetime | - | YES |
| ID1 | int | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `GENELLOG_KONTROL`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| ACIKLAMA | varchar | 50 | YES |
| HASTANO | int | - | YES |
| GELISNO | int | - | YES |
| ID | int | - | YES |
| BILGI | varchar | 1000 | YES |
| KIM | int | - | YES |
| TARIH | datetime | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🔴 YÜKSEK
*   **Gerekçe:** Tablo doğrudan hassas kişisel veriler veya bunların değişim geçmişini barındırıyor olabilir. KVKK gereği veri sorumlusunun bu verilerin geçmişini saklaması veya denetimlerde sunabilmesi gerekebilir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** 🚫 TAŞINMALI / ARŞİVLENMELİ (KRİTİK)

---

## 📊 Tablo: `GENELLOG_MUHENT`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| TARIHSAAT | datetime | - | YES |
| HATAKODU | int | - | YES |
| ACIKLAMA | varchar | 500 | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `GENELLOG_MUHENT_HATA`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| TABLO | tinyint | - | YES |
| KAYIT_ID | int | - | YES |
| ACIKLAMA | varchar | 500 | YES |
| TARIHSAAT | datetime | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟠 ORTA
*   **Gerekçe:** Sistem hatalarının takibi için kritik olmakla birlikte, eski sistemden yeni sisteme taşınması "geçmiş hataların analizi" dışında şart değildir. Ancak hata ayıklama sürecinde referans olabilir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `GENELLOG_SERVISLER`

- **Toplam Kayıt Sayısı:** 17
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| TAKIPKODU | varchar | 50 | YES |
| SONCALISMA | datetime | - | YES |
| ACIKLAMA | varchar | 150 | YES |
| Kullaniliyor | bit | - | YES |
| CalismaPeriyoduDk | int | - | YES |
| AyarlardaGizle | bit | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | TAKIPKODU | SONCALISMA | ACIKLAMA | Kullaniliyor | CalismaPeriyoduDk | AyarlardaGizle |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | GeriPlanIslemServisi | 2026-01-14T19:54:10.907Z | Geri Plan İşlem Servisi | true | *null* | true |
| 2 | SistemDestekSunucusu | *null* | Sistem Destek Sunucusu | false | *null* | true |
| 3 | Bakim_Saatlik | 2026-01-14T19:15:06.807Z | *null* | true | *null* | true |
| 4 | EmailServisi | 2026-01-14T19:53:31.773Z | interMEDIA Email Gönderim Servisi | false | *null* | false |
| 5 | SMSServisi | *null* | interMEDIA SMS Gönderim Servisi | false | *null* | false |
| 6 | Bakim_Gunluk | 2025-05-08T00:00:59.870Z | *null* | true | *null* | true |
| 7 | Bakim_Haftalik | 2025-05-04T03:00:05.490Z | *null* | true | *null* | true |
| 8 | interCOLD | *null* | Aşı/İlaç Dolabı Sıcaklık Ölçeri | false | *null* | false |
| 9 | KlinikOLAP_Process | *null* | *null* | false | *null* | true |
| 10 | IlacTakipSistemi | 2021-11-25T20:11:15.907Z | İlaç Takip Sistemi Entegrasyon Aracı | false | *null* | false |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `GENELLOG_SISTEMMESAJLARI`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| KULLANICI_ID | int | - | NO |
| TARIH | datetime | - | NO |
| HASTANO | int | - | YES |
| GELISNO | int | - | YES |
| ISLEMNO | int | - | YES |
| MESAJ | varchar | 150 | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🔴 YÜKSEK
*   **Gerekçe:** Tablo doğrudan hassas kişisel veriler veya bunların değişim geçmişini barındırıyor olabilir. KVKK gereği veri sorumlusunun bu verilerin geçmişini saklaması veya denetimlerde sunabilmesi gerekebilir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🔴 KRİTİK
*   **Gerekçe:** Erişim kayıtları (IP, kullanıcı girişi vb.) ve işlem izlerini içermektedir. Güvenlik ihlallerinin tespiti için vazgeçilmezdir.

**NİHAİ KARAR:** 🚫 TAŞINMALI / ARŞİVLENMELİ (KRİTİK)

---

## 📊 Tablo: `Hst_Anadosya_GizlilikOnamFormu_Log`

- **Toplam Kayıt Sayısı:** 4
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| HastaNo | int | - | NO |
| Kim | int | - | NO |
| Tarih | datetime | - | NO |
| Islem | tinyint | - | NO |
| Detay | varchar | 100 | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | HastaNo | Kim | Tarih | Islem | Detay |
| --- | --- | --- | --- | --- | --- |
| 1 | 5143 | 6 | 2023-12-14T13:04:52.853Z | 0 | İlk Kayıt |
| 2 | 17189 | 7 | 2024-10-14T14:43:43.143Z | 0 | İlk Kayıt |
| 3 | 14955 | 7 | 2025-01-06T13:59:01.437Z | 0 | İlk Kayıt |
| 4 | 17428 | 6 | 2025-04-03T16:50:30.007Z | 0 | İlk Kayıt |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🔴 YÜKSEK
*   **Gerekçe:** Tablo doğrudan hassas kişisel veriler veya bunların değişim geçmişini barındırıyor olabilir. KVKK gereği veri sorumlusunun bu verilerin geçmişini saklaması veya denetimlerde sunabilmesi gerekebilir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** 🚫 TAŞINMALI / ARŞİVLENMELİ (KRİTİK)

---

## 📊 Tablo: `IlacTakipSistemi_Log`

- **Toplam Kayıt Sayısı:** 402.690
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| DurumID | tinyint | - | NO |
| Aciklama | nvarchar | 1000 | YES |
| Tarih | datetime | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | DurumID | Aciklama | Tarih |
| --- | --- | --- | --- |
| 1577833 | 2 | Kurum GLN kodu, kullanıcı adı ya da şifre bilgilerinde eksiklik var | 2025-04-08T00:01:23.340Z |
| 1577834 | 2 | Kurum GLN kodu, kullanıcı adı ya da şifre bilgilerinde eksiklik var | 2025-04-08T00:02:23.350Z |
| 1577835 | 2 | Kurum GLN kodu, kullanıcı adı ya da şifre bilgilerinde eksiklik var | 2025-04-08T00:03:23.373Z |
| 1577836 | 2 | Kurum GLN kodu, kullanıcı adı ya da şifre bilgilerinde eksiklik var | 2025-04-08T00:04:23.350Z |
| 1577837 | 2 | Kurum GLN kodu, kullanıcı adı ya da şifre bilgilerinde eksiklik var | 2025-04-08T00:05:23.363Z |
| 1577838 | 2 | Kurum GLN kodu, kullanıcı adı ya da şifre bilgilerinde eksiklik var | 2025-04-08T00:06:23.380Z |
| 1577839 | 2 | Kurum GLN kodu, kullanıcı adı ya da şifre bilgilerinde eksiklik var | 2025-04-08T00:07:23.387Z |
| 1577840 | 2 | Kurum GLN kodu, kullanıcı adı ya da şifre bilgilerinde eksiklik var | 2025-04-08T00:08:23.380Z |
| 1577841 | 2 | Kurum GLN kodu, kullanıcı adı ya da şifre bilgilerinde eksiklik var | 2025-04-08T00:09:23.380Z |
| 1577842 | 2 | Kurum GLN kodu, kullanıcı adı ya da şifre bilgilerinde eksiklik var | 2025-04-08T00:10:23.393Z |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟠 ORTA
*   **Gerekçe:** Yüksek hacimli veri barındırıyor. Sistemin yoğun kullanılan bir parçası olduğu anlaşılıyor.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `ILET_EMAIL_LOG`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| MESAJ | varchar | 200 | YES |
| TARIH | datetime | - | NO |
| TURU | tinyint | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `ILET_EMAIL_LOG_TURU`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | tinyint | - | NO |
| ACIKLAMA | varchar | 20 | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `ILET_SMS_LOG`

- **Toplam Kayıt Sayısı:** 787.463
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| MESAJ | varchar | 200 | YES |
| TARIH | datetime | - | NO |
| TURU | tinyint | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

| RECORD_ID | MESAJ | TARIH | TURU |
| --- | --- | --- | --- |
| 3691527 | Sistem ayarlarında eksiklik var. Lütfen kullanıcı adı, şifre, şirket kodu gibi ayarlarınızın tam old | 2025-04-08T00:00:58.130Z | 1 |
| 3691528 | Sistem ayarlarında eksiklik var. Lütfen kullanıcı adı, şifre, şirket kodu gibi ayarlarınızın tam old | 2025-04-08T00:01:28.127Z | 1 |
| 3691529 | Sistem ayarlarında eksiklik var. Lütfen kullanıcı adı, şifre, şirket kodu gibi ayarlarınızın tam old | 2025-04-08T00:01:58.140Z | 1 |
| 3691530 | Sistem ayarlarında eksiklik var. Lütfen kullanıcı adı, şifre, şirket kodu gibi ayarlarınızın tam old | 2025-04-08T00:02:28.143Z | 1 |
| 3691531 | Sistem ayarlarında eksiklik var. Lütfen kullanıcı adı, şifre, şirket kodu gibi ayarlarınızın tam old | 2025-04-08T00:02:58.157Z | 1 |
| 3691532 | Sistem ayarlarında eksiklik var. Lütfen kullanıcı adı, şifre, şirket kodu gibi ayarlarınızın tam old | 2025-04-08T00:03:28.180Z | 1 |
| 3691533 | Sistem ayarlarında eksiklik var. Lütfen kullanıcı adı, şifre, şirket kodu gibi ayarlarınızın tam old | 2025-04-08T00:03:58.183Z | 1 |
| 3691534 | Sistem ayarlarında eksiklik var. Lütfen kullanıcı adı, şifre, şirket kodu gibi ayarlarınızın tam old | 2025-04-08T00:04:28.187Z | 1 |
| 3691535 | Sistem ayarlarında eksiklik var. Lütfen kullanıcı adı, şifre, şirket kodu gibi ayarlarınızın tam old | 2025-04-08T00:04:58.197Z | 1 |
| 3691536 | Sistem ayarlarında eksiklik var. Lütfen kullanıcı adı, şifre, şirket kodu gibi ayarlarınızın tam old | 2025-04-08T00:05:28.220Z | 1 |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟠 ORTA
*   **Gerekçe:** Yüksek hacimli veri barındırıyor. Sistemin yoğun kullanılan bir parçası olduğu anlaşılıyor.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `ILET_SMS_LOG_TURU`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | tinyint | - | NO |
| ACIKLAMA | varchar | 20 | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `Iletisim_Email_Log`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| LogTuruID | tinyint | - | YES |
| Aciklama | nvarchar | 1000 | YES |
| Tarih | datetime | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `Iletisim_Email_LogTuru`

- **Toplam Kayıt Sayısı:** 2
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | tinyint | - | NO |
| LogTuru | nvarchar | 100 | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | LogTuru |
| --- | --- |
| 1 | Bilgi |
| 2 | Hata |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `IsiOlcum_Log`

- **Toplam Kayıt Sayısı:** 5
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| DurumID | tinyint | - | NO |
| Aciklama | nvarchar | 200 | YES |
| Tarih | datetime | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | DurumID | Aciklama | Tarih |
| --- | --- | --- | --- |
| 1 | 1 | Sensör listesi bulunamadı | 2021-03-10T10:57:16.600Z |
| 2 | 1 | Sensör listesi bulunamadı | 2021-03-10T12:35:12.020Z |
| 3 | 1 | Sensör listesi bulunamadı | 2021-03-10T13:51:33.143Z |
| 4 | 1 | Sensör listesi bulunamadı | 2021-03-10T13:57:20.667Z |
| 5 | 2 | Servis durduruldu | 2021-03-10T13:58:10.507Z |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `Kalite_KlinikGosterge_Hesaplama_Log`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| KullaniciID | int | - | NO |
| RaporIlkTarih | datetime | - | NO |
| RaporSonTarih | datetime | - | NO |
| TarihSecimiID | tinyint | - | NO |
| GostergeIDler | varchar | 20 | NO |
| GostergeSayisi | int | - | NO |
| SorgulamaTrh | datetime | - | NO |
| SorgulamaBitisTrh | datetime | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `Kiosk_Log`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| LogTuruID | tinyint | - | NO |
| Aciklama | nvarchar | 1000 | YES |
| Tarih | datetime | - | YES |
| KioskID | int | - | YES |
| IslemYapanHasta_TCKimlikNo | varchar | 11 | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🔴 YÜKSEK
*   **Gerekçe:** Tablo doğrudan hassas kişisel veriler veya bunların değişim geçmişini barındırıyor olabilir. KVKK gereği veri sorumlusunun bu verilerin geçmişini saklaması veya denetimlerde sunabilmesi gerekebilir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** 🚫 TAŞINMALI / ARŞİVLENMELİ (KRİTİK)

---

## 📊 Tablo: `Kiosk_LogTuru`

- **Toplam Kayıt Sayısı:** 13
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | tinyint | - | NO |
| LogTuru | nvarchar | 100 | YES |
| Aciklama | nvarchar | 1000 | YES |
| Hata | bit | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | LogTuru | Aciklama | Hata |
| --- | --- | --- | --- |
| 1 | Belirtilen TC kimlik numaraları hasta kartı bulunamadı. |  | false |
| 2 | TC kimlik numarası MERNIS`ten başarıyla sorgulandı. |  | false |
| 3 | TC kimlik numarası MERNIS`te bulunamadı. |  | false |
| 4 | MERNIS`ten sorgulama esnasında hata oluştu. |  | true |
| 5 | Hasta kartı kaydedildi. |  | false |
| 6 | Provizyon alınamadı. |  | true |
| 7 | Provizyon başarıyla alındı. |  | false |
| 8 | Provizyon silinemedi. |  | true |
| 9 | Provizyon başarıyla silindi. |  | false |
| 10 | Barkod basıldı. |  | false |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `Kullanici_Log_AyarGiris`

- **Toplam Kayıt Sayısı:** 156
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| KullaniciID | int | - | NO |
| SubeID | int | - | NO |
| AyarID | int | - | NO |
| GirisTarihSaat | datetime | - | NO |
| CikisTarihSaat | datetime | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | KullaniciID | SubeID | AyarID | GirisTarihSaat | CikisTarihSaat |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 1 | 36 | 2021-01-04T14:46:09.913Z | 2021-01-04T14:46:17.710Z |
| 2 | 1 | 1 | 36 | 2021-01-04T15:01:30.930Z | 2021-01-04T15:11:06.023Z |
| 3 | 1 | 1 | 29 | 2021-02-22T20:46:00.770Z | 2021-02-22T20:46:52.220Z |
| 4 | 1 | 1 | 36 | 2021-02-23T14:08:09.790Z | 2021-02-23T14:08:52.903Z |
| 5 | 1 | 1 | 28 | 2021-02-23T14:08:52.937Z | 2021-02-23T14:26:57.860Z |
| 6 | 1 | 1 | 35 | 2021-02-23T14:26:57.910Z | 2021-02-23T15:56:15.450Z |
| 7 | 1 | 1 | 29 | 2021-02-24T09:09:52.440Z | 2021-02-24T09:11:48.730Z |
| 8 | 1 | 1 | 101 | 2021-02-24T09:11:48.933Z | 2021-02-24T09:12:48.970Z |
| 9 | 1 | 1 | 36 | 2021-02-24T09:12:49.173Z | 2021-02-24T09:17:21.610Z |
| 10 | 1 | 1 | 1 | 2021-02-24T09:24:26.367Z | 2021-02-24T09:25:49.277Z |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `Kullanici_Log_DokumGiris`

- **Toplam Kayıt Sayısı:** 42
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| KullaniciID | int | - | NO |
| SubeID | int | - | NO |
| DokumID | int | - | NO |
| ListeIlkTarih | datetime | - | NO |
| ListeSonTarih | datetime | - | NO |
| Parametreler | varchar | 500 | YES |
| GirisTarihSaat | datetime | - | NO |
| CikisTarihSaat | datetime | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | KullaniciID | SubeID | DokumID | ListeIlkTarih | ListeSonTarih | Parametreler | GirisTarihSaat | CikisTarihSaat |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | 1 | 70 | 2021-02-24T00:00:00.000Z | 2021-02-24T23:59:59.000Z |  | 2021-02-24T12:33:00.783Z | 2021-02-24T12:33:12.780Z |
| 2 | 1 | 1 | 45 | 2021-02-25T00:00:00.000Z | 2021-02-25T23:59:59.000Z |  | 2021-02-25T11:48:40.883Z | 2021-02-25T11:50:09.257Z |
| 3 | 1 | 1 | 45 | 2021-02-25T00:00:00.000Z | 2021-02-25T23:59:59.000Z |  | 2021-02-25T12:09:50.213Z | 2021-02-25T12:10:09.337Z |
| 4 | 1 | 1 | 4 | 2021-02-25T00:00:00.000Z | 2021-02-25T23:59:59.000Z |  | 2021-02-25T12:10:15.257Z | 2021-02-25T12:10:29.113Z |
| 5 | 6 | 1 | 45 | 2021-02-01T00:00:00.000Z | 2021-02-28T23:59:59.000Z |  | 2021-02-25T13:40:20.083Z | 2021-02-25T13:41:36.270Z |
| 6 | 6 | 1 | 4 | 2021-02-01T00:00:00.000Z | 2021-02-28T23:59:59.000Z |  | 2021-02-25T13:41:43.163Z | 2021-02-25T13:42:08.930Z |
| 7 | 6 | 1 | 20 | 2021-02-25T00:00:00.000Z | 2021-02-25T23:59:59.000Z |  | 2021-02-25T13:58:44.970Z | 2021-02-25T13:58:52.517Z |
| 8 | 6 | 1 | 20 | 2021-02-18T00:00:00.000Z | 2021-02-25T23:59:59.000Z |  | 2021-02-25T13:58:52.610Z | 2021-02-25T13:59:20.963Z |
| 9 | 6 | 1 | 60 | 2021-02-25T00:00:00.000Z | 2021-02-25T23:59:59.000Z |  | 2021-02-25T15:13:01.050Z | 2021-02-25T15:13:18.700Z |
| 10 | 1 | 1 | 45 | 2021-03-19T00:00:00.000Z | 2021-03-19T23:59:59.000Z |  | 2021-03-19T17:57:31.710Z | 2021-03-19T17:57:39.170Z |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🔴 YÜKSEK
*   **Gerekçe:** Tablo doğrudan hassas kişisel veriler veya bunların değişim geçmişini barındırıyor olabilir. KVKK gereği veri sorumlusunun bu verilerin geçmişini saklaması veya denetimlerde sunabilmesi gerekebilir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** 🚫 TAŞINMALI / ARŞİVLENMELİ (KRİTİK)

---

## 📊 Tablo: `Kullanici_Log_DokumYazdirma`

- **Toplam Kayıt Sayısı:** 19
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| SubeID | int | - | NO |
| KullaniciID | int | - | NO |
| DokumID | int | - | NO |
| DokumGirisLogID | int | - | NO |
| YazdirmaTarihSaat | datetime | - | NO |
| CihazTuru | varchar | 5 | NO |
| RaporID | int | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | SubeID | KullaniciID | DokumID | DokumGirisLogID | YazdirmaTarihSaat | CihazTuru | RaporID |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | 1 | 45 | 3 | 2021-02-25T12:10:05.523Z | E | 42 |
| 2 | 1 | 1 | 4 | 4 | 2021-02-25T12:10:23.113Z | E | 18 |
| 3 | 1 | 1 | 0 | 0 | 2024-04-18T09:56:38.630Z | E | 92 |
| 4 | 1 | 2 | 0 | 0 | 2024-11-30T14:46:26.740Z | Y | 92 |
| 5 | 1 | 2 | 0 | 0 | 2025-04-03T11:30:21.723Z | Y | 47 |
| 6 | 1 | 6 | 0 | 0 | 2025-04-05T11:16:51.753Z | Y | 47 |
| 7 | 1 | 6 | 0 | 0 | 2025-04-08T09:12:30.203Z | Y | 47 |
| 8 | 1 | 6 | 0 | 0 | 2025-04-08T10:28:18.370Z | Y | 47 |
| 9 | 1 | 7 | 0 | 0 | 2025-04-24T08:46:43.803Z | Y | 47 |
| 10 | 1 | 7 | 0 | 0 | 2025-04-24T08:46:45.780Z | Y | 47 |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `Kullanici_Log_GridVeriTransferi`

- **Toplam Kayıt Sayısı:** 1
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| SubeID | int | - | NO |
| KullaniciID | int | - | NO |
| DokumID | int | - | NO |
| DokumGirisLogID | int | - | NO |
| DosyaTuru | varchar | 10 | NO |
| RaporAdi | varchar | 100 | NO |
| GridAdi | varchar | 100 | NO |
| TransferTarihSaat | datetime | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | SubeID | KullaniciID | DokumID | DokumGirisLogID | DosyaTuru | RaporAdi | GridAdi | TransferTarihSaat |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | 6 | 70 | 1040 | Excel | Hasta Sorgulama - Bulunan Kayıtlar | DBGridEhBulunanKayitlar | 2025-12-23T16:23:00.750Z |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `Kullanici_Log_HastaSorgulama`

- **Toplam Kayıt Sayısı:** 4
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| SubeID | int | - | NO |
| KullaniciID | int | - | NO |
| DokumGirisLogID | int | - | NO |
| SorgulamaSQL | varchar | 5000 | NO |
| SorgulamaTarihSaat | datetime | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | SubeID | KullaniciID | DokumGirisLogID | SorgulamaSQL | SorgulamaTarihSaat |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 1 | 1 | IF OBJECT_ID('tempdb..#tmpHastaNo') IS NOT NULL DROP TABLE #tmpHastaNo SELECT DISTINCT TOP 10000   | 2021-02-24T12:33:06.043Z |
| 2 | 1 | 1 | 0 | IF OBJECT_ID('tempdb..#tmpHastaNo') IS NOT NULL DROP TABLE #tmpHastaNo SELECT DISTINCT TOP 10000   | 2021-02-24T12:38:06.860Z |
| 3 | 1 | 6 | 1040 | IF OBJECT_ID('tempdb..#tmpHastaNo') IS NOT NULL DROP TABLE #tmpHastaNo SELECT DISTINCT TOP 10000   | 2025-12-23T16:20:57.387Z |
| 4 | 1 | 6 | 1040 | IF OBJECT_ID('tempdb..#tmpHastaNo') IS NOT NULL DROP TABLE #tmpHastaNo SELECT DISTINCT TOP 100000  | 2025-12-23T16:21:57.013Z |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟠 ORTA/YÜKSEK
*   **Gerekçe:** Audit log niteliğindedir. Kimin hangi veriye ne zaman eriştiği/değiştirdiği bilgisi yasal denetimlerde (forensic analysis) zorunlu olabilir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🔴 KRİTİK
*   **Gerekçe:** Erişim kayıtları (IP, kullanıcı girişi vb.) ve işlem izlerini içermektedir. Güvenlik ihlallerinin tespiti için vazgeçilmezdir.

**NİHAİ KARAR:** 🚫 TAŞINMALI / ARŞİVLENMELİ (KRİTİK)

---

## 📊 Tablo: `Kullanici_Log_KayitErisim`

- **Toplam Kayıt Sayısı:** 21.783
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| KullaniciID | int | - | NO |
| SubeID | int | - | NO |
| HastaNo | int | - | NO |
| GelisNo | int | - | NO |
| KayitTuruTanimID | tinyint | - | NO |
| KayitID | int | - | NO |
| TarihSaat | datetime | - | NO |
| Notlar | varchar | 50 | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| KullaniciID | SubeID | HastaNo | GelisNo | KayitTuruTanimID | KayitID | TarihSaat | Notlar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 6 | 1 | 7353 | 63877 | 1 | 7353 | 2025-05-02T09:30:23.433Z | *null* |
| 7 | 1 | 16883 | 79102 | 1 | 16883 | 2025-05-14T10:12:33.243Z | *null* |
| 7 | 1 | 17177 | 77746 | 1 | 17177 | 2024-11-12T09:42:55.440Z | *null* |
| 7 | 1 | 17177 | 77807 | 200 | 101555 | 2024-11-12T09:45:14.683Z | *null* |
| 7 | 1 | 14598 | 77799 | 1 | 14598 | 2024-11-12T09:45:26.083Z | *null* |
| 7 | 1 | 14598 | 77799 | 200 | 101546 | 2024-11-12T09:45:26.827Z | *null* |
| 7 | 1 | 17177 | 77807 | 200 | 101555 | 2024-11-12T10:49:01.037Z | *null* |
| 7 | 1 | 17291 | 0 | 1 | 17291 | 2024-11-12T10:50:22.980Z | *null* |
| 7 | 1 | 17289 | 77800 | 1 | 17289 | 2024-11-12T10:56:15.527Z | *null* |
| 7 | 1 | 17289 | 77800 | 200 | 101547 | 2024-11-12T10:56:16.410Z | *null* |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🔴 YÜKSEK
*   **Gerekçe:** Tablo doğrudan hassas kişisel veriler veya bunların değişim geçmişini barındırıyor olabilir. KVKK gereği veri sorumlusunun bu verilerin geçmişini saklaması veya denetimlerde sunabilmesi gerekebilir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** 🚫 TAŞINMALI / ARŞİVLENMELİ (KRİTİK)

---

## 📊 Tablo: `Kullanici_Log_OzelTasarimRapor`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| SubeID | int | - | NO |
| KullaniciID | int | - | NO |
| OzelRaporID | int | - | NO |
| RaporSQL | varchar | 5000 | NO |
| CalistirmaTarihSaat | datetime | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟠 ORTA/YÜKSEK
*   **Gerekçe:** Audit log niteliğindedir. Kimin hangi veriye ne zaman eriştiği/değiştirdiği bilgisi yasal denetimlerde (forensic analysis) zorunlu olabilir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🔴 KRİTİK
*   **Gerekçe:** Erişim kayıtları (IP, kullanıcı girişi vb.) ve işlem izlerini içermektedir. Güvenlik ihlallerinin tespiti için vazgeçilmezdir.

**NİHAİ KARAR:** 🚫 TAŞINMALI / ARŞİVLENMELİ (KRİTİK)

---

## 📊 Tablo: `Kullanici_Log_SQLIslemleri`

- **Toplam Kayıt Sayısı:** 79
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| KullaniciID | int | - | NO |
| SubeID | int | - | NO |
| SQLCumlesi | varchar | 1000 | NO |
| KomutTuru | varchar | 10 | NO |
| TarihSaat | datetime | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | KullaniciID | SubeID | SQLCumlesi | KomutTuru | TarihSaat |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 1 | TRUNCATE TABLE LOG_SQLISLEMLERI  |  | 2017-10-14T04:06:46.000Z |
| 2 | 1 | 1 | TRUNCATE TABLE LOGIN_LOGOUT  |  | 2017-10-14T04:07:00.000Z |
| 3 | 1 | 1 | SELECT * FROM Lst_Doviz  | SELECT | 2017-10-14T04:07:20.000Z |
| 4 | 1 | 1 | SELECT * FROM Lst_HastaIsyeri  | SELECT | 2017-10-14T04:07:35.000Z |
| 5 | 1 | 1 | SELECT * FROM Sube  | SELECT | 2017-10-14T04:08:19.000Z |
| 6 | 1 | 1 | SELECT * FROM TMP_EXCEL_FIYATLISTESI  | SELECT | 2017-10-14T04:08:38.000Z |
| 7 | 1 | 1 | TRUNCATE TABLE TMP_EXCEL_FIYATLISTESI  |  | 2017-10-14T04:08:53.000Z |
| 8 | 1 | 1 | TRUNCATE TABLE TMP_EXCEL_FIYATLISTESI_FIYATLAR  |  | 2017-10-14T04:09:01.000Z |
| 9 | 1 | 1 | TRUNCATE TABLE TMP_HST_YATIS  |  | 2017-10-14T04:09:06.000Z |
| 10 | 1 | 1 | TRUNCATE TABLE Tmp_MedulaSutIlacEtkenMadde  |  | 2017-10-14T04:09:13.000Z |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟠 ORTA/YÜKSEK
*   **Gerekçe:** Audit log niteliğindedir. Kimin hangi veriye ne zaman eriştiği/değiştirdiği bilgisi yasal denetimlerde (forensic analysis) zorunlu olabilir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🔴 KRİTİK
*   **Gerekçe:** Erişim kayıtları (IP, kullanıcı girişi vb.) ve işlem izlerini içermektedir. Güvenlik ihlallerinin tespiti için vazgeçilmezdir.

**NİHAİ KARAR:** 🚫 TAŞINMALI / ARŞİVLENMELİ (KRİTİK)

---

## 📊 Tablo: `Kuyruk_Mobil_Bildirim_Log`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| KullaniciID | int | - | NO |
| BildirimTuruID | tinyint | - | NO |
| BildirimNotu | varchar | 100 | YES |
| EklenmeTrh | datetime | - | NO |
| SonucID | tinyint | - | NO |
| KaynakTuruID | tinyint | - | NO |
| KaynakID | int | - | NO |
| BildirimTrh | datetime | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `LOG_DEGISIKLIKLER`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| TARIH | datetime | - | YES |
| HASTANO | int | - | YES |
| GELISNO | int | - | YES |
| ISLEMNO | int | - | YES |
| TABLENAME | varchar | 50 | YES |
| DETAY | text | 2147483647 | YES |
| KIM | int | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🔴 YÜKSEK
*   **Gerekçe:** Tablo doğrudan hassas kişisel veriler veya bunların değişim geçmişini barındırıyor olabilir. KVKK gereği veri sorumlusunun bu verilerin geçmişini saklaması veya denetimlerde sunabilmesi gerekebilir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** 🚫 TAŞINMALI / ARŞİVLENMELİ (KRİTİK)

---

## 📊 Tablo: `Log_HataMesaji`

- **Toplam Kayıt Sayısı:** 24
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| Tarih | datetime | - | NO |
| PersonelID | int | - | NO |
| HataMesaji | varchar | 500 | NO |
| Log | varchar | -1 | YES |
| Versiyon | varchar | 10 | NO |
| Modul | varchar | 50 | NO |
| GelisNo | int | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | Tarih | PersonelID | HataMesaji | Log | Versiyon | Modul | GelisNo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1176 | 2025-04-14T13:50:41.310Z | 6 | RandevuSaatleri: Field 'TARIH' not found. | Bilgisayar Adı  : DESKTOP-T18MJJJ Çalışma Süresi  : 4 hour(s), 8 minute(s), 26 second(s) Ekran Boy | 1030.03 | Hasta Kayıt | 78902 |
| 1177 | 2025-05-09T16:24:40.550Z | 6 | EksikVeriler: Cannot perform this operation on an empty dataset. | Bilgisayar Adı  : DESKTOP-T18MJJJ Çalışma Süresi  : 3 hour(s), 56 minute(s), 35 second(s) Ekran Bo | 1030.03 | Hasta Kayıt | 75477 |
| 1178 | 2025-05-14T17:09:00.250Z | 6 | EksikVeriler: Cannot perform this operation on an empty dataset. | Bilgisayar Adı  : DESKTOP-T18MJJJ Çalışma Süresi  : 6 hour(s), 38 minute(s), 23 second(s) Ekran Bo | 1030.03 | Hasta Kayıt | 75666 |
| 1179 | 2025-05-26T15:50:15.643Z | 6 | Cannot focus a disabled or invisible window. | Bilgisayar Adı  : DESKTOP-T18MJJJ Çalışma Süresi  : 5 hour(s), 43 minute(s), 9 second(s) Ekran Boy | 1030.03 | Hasta Kayıt | 0 |
| 1180 | 2025-05-30T11:18:05.917Z | 7 | Grid index out of range. | Bilgisayar Adı  : HASTAKABUL Çalışma Süresi  : 1 hour(s), 53 minute(s), 50 second(s) Ekran Boyutla | 1030.03 | Hasta Kayıt | 79239 |
| 1181 | 2025-05-30T14:24:15.697Z | 7 | Access violation at address 00950CA6 in module 'im.exe'. Read of address 000010C2. | Bilgisayar Adı  : HASTAKABUL Çalışma Süresi  : 4 hour(s), 59 minute(s), 59 second(s) Ekran Boyutla | 1030.03 | Hasta Kayıt | 79240 |
| 1182 | 2025-05-30T14:24:16.597Z | 7 | Access violation at address 00950CA6 in module 'im.exe'. Read of address 000010C2. | Bilgisayar Adı  : HASTAKABUL Çalışma Süresi  : 5 hour(s), 2 second(s) Ekran Boyutları : 1600x900  | 1030.03 | Hasta Kayıt | 79240 |
| 1183 | 2025-05-30T17:05:50.567Z | 7 | Access violation at address 00AD089B in module 'im.exe'. Read of address BEDD0FF6. | Bilgisayar Adı  : HASTAKABUL Çalışma Süresi  : 7 hour(s), 41 minute(s), 36 second(s) Ekran Boyutla | 1030.03 | Hasta Kayıt | 79247 |
| 1184 | 2025-05-30T17:39:55.863Z | 6 | Access violation at address 00000064 in module 'im.exe'. Execution of address 00000064. | Bilgisayar Adı  : DESKTOP-T18MJJJ Çalışma Süresi  : 3 hour(s), 2 minute(s), 56 second(s) Ekran Boy | 1030.03 | Hasta Kayıt | 0 |
| 1185 | 2025-05-30T17:39:58.690Z | 6 | Access violation at address 00000064 in module 'im.exe'. Execution of address 00000064. | Bilgisayar Adı  : DESKTOP-T18MJJJ Çalışma Süresi  : 3 hour(s), 2 minute(s), 59 second(s) Ekran Boy | 1030.03 | Hasta Kayıt | 0 |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟠 ORTA
*   **Gerekçe:** Sistem hatalarının takibi için kritik olmakla birlikte, eski sistemden yeni sisteme taşınması "geçmiş hataların analizi" dışında şart değildir. Ancak hata ayıklama sürecinde referans olabilir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `LOG_KAYITDEGISIKLIGI`

- **Toplam Kayıt Sayısı:** 826
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | bigint | - | NO |
| TARIH | datetime | - | NO |
| KIM | int | - | NO |
| TABLE_ID | int | - | NO |
| RECORD_ID | int | - | NO |
| ESKIDEGERLER | varchar | 4000 | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | TARIH | KIM | TABLE_ID | RECORD_ID | ESKIDEGERLER |
| --- | --- | --- | --- | --- | --- |
| 1 | 2021-02-26T12:39:57.507Z | 6 | 95443514 | 14447 | DOGUMYERI="" MESLEK="" BABAADI="" ANNEADI="" ESININADI="" VERGINO="" KIMLIKNO="" ARSIVNO="" BILGI="" |
| 2 | 2021-02-27T10:26:56.143Z | 6 | 95443514 | 14470 | KIMLIKNO=""  |
| 3 | 2021-02-27T10:27:02.043Z | 6 | 95443514 | 14470 | AD="Aşırı"  |
| 4 | 2021-02-27T10:27:46.193Z | 6 | 95443514 | 14470 | DGMTRH="Oca  1 1950 12:00AM" YAS="71"  |
| 5 | 2021-03-01T12:14:39.650Z | 6 | 95443514 | 1377 | CINSIYET="E" DOGUMYERI="" MESLEK="" BABAADI="" ANNEADI="" ESININADI="" VERGINO="" KIMLIKNO="" ARSIVN |
| 6 | 2021-03-02T09:12:25.020Z | 6 | 95443514 | 786 | DOGUMYERI="" MESLEK="" BABAADI="" ANNEADI="" ESININADI="" VERGINO="" KIMLIKNO="" ARSIVNO="" BILGI="" |
| 7 | 2021-03-02T09:12:40.803Z | 6 | 95443514 | 786 | EV_MOBIL="0537 745 60 06"  |
| 8 | 2021-03-03T15:02:32.957Z | 6 | 95443514 | 3050 | DOGUMYERI="" MESLEK="" BABAADI="" ANNEADI="" ESININADI="" VERGINO="" KIMLIKNO="" ARSIVNO="" BILGI="" |
| 9 | 2021-03-03T15:02:40.653Z | 6 | 95443514 | 3050 | CINSIYET="E"  |
| 10 | 2021-03-03T15:40:33.963Z | 6 | 95443514 | 11597 | DOGUMYERI="" MESLEK="" BABAADI="" ANNEADI="" ESININADI="" VERGINO="" KIMLIKNO="" ARSIVNO="" BILGI="" |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `LOG_SQLISLEMLERI`

- **Toplam Kayıt Sayısı:** 76
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| KIM | int | - | YES |
| TARIH | datetime | - | YES |
| KOMUTTURU | varchar | 10 | YES |
| SQLCUMLESI | varchar | 1000 | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| RECORD_ID | KIM | TARIH | KOMUTTURU | SQLCUMLESI |
| --- | --- | --- | --- | --- |
| 1 | 1 | 2017-10-14T04:06:46.000Z | *null* | TRUNCATE TABLE LOG_SQLISLEMLERI  |
| 2 | 1 | 2017-10-14T04:07:00.000Z | *null* | TRUNCATE TABLE LOGIN_LOGOUT  |
| 3 | 1 | 2017-10-14T04:07:20.000Z | SELECT | SELECT * FROM Lst_Doviz  |
| 4 | 1 | 2017-10-14T04:07:35.000Z | SELECT | SELECT * FROM Lst_HastaIsyeri  |
| 5 | 1 | 2017-10-14T04:08:19.000Z | SELECT | SELECT * FROM Sube  |
| 6 | 1 | 2017-10-14T04:08:38.000Z | SELECT | SELECT * FROM TMP_EXCEL_FIYATLISTESI  |
| 7 | 1 | 2017-10-14T04:08:53.000Z | *null* | TRUNCATE TABLE TMP_EXCEL_FIYATLISTESI  |
| 8 | 1 | 2017-10-14T04:09:01.000Z | *null* | TRUNCATE TABLE TMP_EXCEL_FIYATLISTESI_FIYATLAR  |
| 9 | 1 | 2017-10-14T04:09:06.000Z | *null* | TRUNCATE TABLE TMP_HST_YATIS  |
| 10 | 1 | 2017-10-14T04:09:13.000Z | *null* | TRUNCATE TABLE Tmp_MedulaSutIlacEtkenMadde  |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `LOGIN_LOGOUT`

- **Toplam Kayıt Sayısı:** 840
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| TERMINAL | varchar | 20 | YES |
| IP | varchar | 25 | YES |
| KULLANICI_ID | int | - | YES |
| MODUL | varchar | 20 | YES |
| LOGIN_TIME | datetime | - | YES |
| LOGOUT_TIME | datetime | - | YES |
| Versiyon | varchar | 10 | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| RECORD_ID | TERMINAL | IP | KULLANICI_ID | MODUL | LOGIN_TIME | LOGOUT_TIME | Versiyon |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 8028 | DESKTOP-S4UMKNC | 192.168.1.127 | 2 | Kayıt | 2024-11-08T08:25:41.577Z | *null* | 1029.01 |
| 8029 | HASTAKABUL | 192.168.1.124 | 7 | Kayıt | 2024-11-08T09:24:58.197Z | 2024-11-08T17:40:28.727Z | 1029.01 |
| 8030 | DESKTOP-T18MJJJ | 192.168.1.125 | 6 | Kayıt | 2024-11-08T12:21:01.937Z | *null* | 1029.01 |
| 8031 | DESKTOP-S4UMKNC | 192.168.1.127 | 2 | Kayıt | 2024-11-09T08:26:19.313Z | 2024-11-09T15:20:46.593Z | 1029.01 |
| 8032 | HASTAKABUL | 192.168.1.124 | 7 | Kayıt | 2024-11-09T09:06:27.160Z | 2024-11-09T14:39:26.987Z | 1029.01 |
| 8033 | DESKTOP-T18MJJJ | 192.168.1.125 | 6 | Kayıt | 2024-11-09T09:41:48.580Z | *null* | 1029.01 |
| 8034 | DESKTOP-S4UMKNC | 192.168.1.127 | 2 | Kayıt | 2024-11-11T08:32:45.247Z | *null* | 1029.01 |
| 8035 | HASTAKABUL | 192.168.1.124 | 7 | Kayıt | 2024-11-11T09:57:33.733Z | 2024-11-11T17:27:23.810Z | 1029.01 |
| 8036 | DESKTOP-T18MJJJ | 192.168.1.125 | 6 | Kayıt | 2024-11-11T09:59:12.453Z | *null* | 1029.01 |
| 8037 | DESKTOP-S4UMKNC | 192.168.1.127 | 2 | Kayıt | 2024-11-12T08:13:41.287Z | 2024-11-12T18:43:31.967Z | 1029.01 |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `SaglikNet_Log`

- **Toplam Kayıt Sayısı:** 9.459
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| DurumID | tinyint | - | YES |
| Aciklama | nvarchar | 1000 | YES |
| Tarih | datetime | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

| ID | DurumID | Aciklama | Tarih |
| --- | --- | --- | --- |
| 1 | 2 | Kullanıcı adı, şifre veya kurum SKRS kodu ayarlarında eksiklik var | 2023-11-07T03:30:10.140Z |
| 2 | 2 | Kullanıcı adı, şifre veya kurum SKRS kodu ayarlarında eksiklik var | 2023-11-07T03:31:10.143Z |
| 3 | 2 | Kullanıcı adı, şifre veya kurum SKRS kodu ayarlarında eksiklik var | 2023-11-07T03:31:54.943Z |
| 4 | 2 | Kullanıcı adı, şifre veya kurum SKRS kodu ayarlarında eksiklik var | 2023-11-07T03:32:10.150Z |
| 5 | 2 | Kullanıcı adı, şifre veya kurum SKRS kodu ayarlarında eksiklik var | 2023-11-07T03:33:10.163Z |
| 6 | 2 | Kullanıcı adı, şifre veya kurum SKRS kodu ayarlarında eksiklik var | 2023-11-07T03:33:39.117Z |
| 7 | 2 | Kullanıcı adı, şifre veya kurum SKRS kodu ayarlarında eksiklik var | 2023-11-07T03:33:41.147Z |
| 8 | 2 | Kullanıcı adı, şifre veya kurum SKRS kodu ayarlarında eksiklik var | 2023-11-07T03:33:55.000Z |
| 9 | 2 | Kullanıcı adı, şifre veya kurum SKRS kodu ayarlarında eksiklik var | 2023-11-07T03:34:10.187Z |
| 10 | 2 | Kullanıcı adı, şifre veya kurum SKRS kodu ayarlarında eksiklik var | 2023-11-07T03:35:10.190Z |

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `SaglikNet_Log_ProtokolBildirimi`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| ID | int | - | NO |
| HekimID | int | - | NO |
| HekimTCKimlikNo | varchar | 11 | NO |
| XML | xml | -1 | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🔴 YÜKSEK
*   **Gerekçe:** Tablo doğrudan hassas kişisel veriler veya bunların değişim geçmişini barındırıyor olabilir. KVKK gereği veri sorumlusunun bu verilerin geçmişini saklaması veya denetimlerde sunabilmesi gerekebilir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** 🚫 TAŞINMALI / ARŞİVLENMELİ (KRİTİK)

---

## 📊 Tablo: `UZM_COCUKKARDIYOLOGU_ANAMNEZSAYFALARI`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| SAYFAADI | varchar | 30 | YES |
| GIZLE | bit | - | NO |
| UZMANLIK_ID | int | - | NO |
| SIRANO | int | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `UZM_COCUKKARDIYOLOGU_HST_ANAMNEZ`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| GELISNO | int | - | NO |
| TIBBIDOSYANO | int | - | NO |
| SIKAYETLER | text | 2147483647 | YES |
| HIKAYESI | text | 2147483647 | YES |
| TANI | text | 2147483647 | YES |
| TEDAVI | text | 2147483647 | YES |
| TAVSIYELER | text | 2147483647 | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `UZM_COCUKKARDIYOLOGU_SAHALAR`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| SIRA | int | - | YES |
| TURU | varchar | 25 | YES |
| SOL | int | - | YES |
| UST | int | - | YES |
| GENISLIK | int | - | YES |
| YUKSEKLIK | int | - | YES |
| ZEMIN_RENK | float | - | YES |
| FONT_NAME | varchar | 30 | YES |
| FONT_SIZE | int | - | YES |
| FONT_STYLE | varchar | 30 | YES |
| FONT_RENK | float | - | YES |
| DATAFIELD | varchar | 20 | YES |
| LABEL | varchar | 40 | YES |
| LABEL_FONT_NAME | varchar | 30 | YES |
| LABEL_FONT_SIZE | int | - | YES |
| LABEL_FONT_STYLE | varchar | 20 | YES |
| LABEL_KONUMTURU | varchar | 20 | YES |
| LABEL_UST | int | - | YES |
| LABEL_SOL | int | - | YES |
| LABEL_GENISLIK | int | - | YES |
| LABEL_YUKSEKLIK | int | - | YES |
| LABEL_SOL_FARK | int | - | YES |
| LABEL_UST_FARK | int | - | YES |
| RADIO_KOLONSAYISI | int | - | YES |
| INDEXNO | int | - | YES |
| ACIKLAMANOTU | varchar | 500 | YES |
| LABEL_FONT_RENK | float | - | YES |
| SECENEKSIRALAMA | smallint | - | YES |
| SAYFA_ID | int | - | YES |
| UZMANLIK_ID | int | - | YES |
| IPTAL | bit | - | YES |
| SONRAKIGELISEAKTAR | bit | - | YES |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

---

## 📊 Tablo: `UZM_COCUKKARDIYOLOGU_SAHALAR_SECENEKLER`

- **Toplam Kayıt Sayısı:** 0
### 🏗️ Sütun Yapısı (Schema)

| Sütun Adı | Veri Tipi | Uzunluk | NULL? |
| :--- | :--- | :--- | :--- |
| RECORD_ID | int | - | NO |
| SAHA_ID | int | - | NO |
| SIRA | int | - | NO |
| SECENEK | varchar | 100 | YES |
| KOD | varchar | 100 | YES |
| IPTAL | bit | - | NO |

### 📄 Örnek Veri (İlk 10 Kayıt)

*Tablo boş veya veri okunamadı.*

### 🧐 Kritiklik Değerlendirmesi

#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.

#### 2. Operasyonel Önem
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.

#### 3. Güvenlik ve Denetim
*   **Durum:** 🟡 DÜŞÜK
*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.

**NİHAİ KARAR:** ✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)

