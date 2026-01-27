# Veri Aktarım Eşleştirme Tablosu

Bu döküman, eski MSSQL sistemindeki verilerin yeni MySQL sistemine nasıl aktarılacağını göstermektedir.

## 1. Hasta Verileri
**Kaynak:** `HST_ANADOSYA` → **Hedef:** `ptn_cards`

| Eski Sütun | Yeni Sütun | Dönüşüm Notu |
| :--- | :--- | :--- |
| `HASTANO` | `legacy_id` | Doğrudan |
| `AD` + `SOYAD` | `name` | Birleştir, şifrele |
| `TCKIMLIK` | `tc_no` | Şifrele, hash oluştur |
| `EV_TELEFON` veya `CEPTELEFON` | `phone` | Şifrele, hash oluştur |
| `EMAIL` | `email` | Şifrele (opsiyonel) |
| `DGMTRH` | `birth_date` | Tarih formatı dönüşümü |
| `DOGUMYERI` | `birth_place` | Doğrudan |
| `CINSIYET` | `gender` | 'E'→'M', 'K'→'F', else 'U' |
| `KANGRUP` | `blood_type` | Doğrudan |
| `EV_ADRES1` + `EV_ADRES2` | `address` | Birleştir |
| `NK_ILKODU` | `province_id` | Eşleştir (sys_provinces) |
| `NK_ILCEKODU` | `district_id` | Eşleştir (sys_districts) |
| `BABAADI` | `father_name` | Doğrudan |
| `ANNEADI` | `mother_name` | Doğrudan |
| `MESLEK` | `profession` | Doğrudan |
| `UYRUGU` | `nationality` | Dönüştür (varsa) |
| `NOTLAR` | `notes` | Doğrudan |
| `IPTAL` | `status` | `IPTAL=0` → `status=1` |

## 2. Geliş/Randevu Verileri
**Kaynak:** `HST_GELISLER` → **Hedef:** `cln_appointments`

| Eski Sütun | Yeni Sütun | Dönüşüm Notu |
| :--- | :--- | :--- |
| `GELISNO` | `legacy_visit_id` | Doğrudan |
| `PROTOKOLNO` | `protocol_no` | Doğrudan |
| `HASTANO` | `patient_id` | `ptn_cards.legacy_id` üzerinden eşleştir |
| `DOKTOR_ID` | `doctor_id` | `sys_users.legacy_id` üzerinden eşleştir |
| `TARIH` | `appointment_date` | Tarih formatı dönüşümü |
| `IPTAL` | `status` | `IPTAL=1` → 'cancelled', else 'completed' |

## 3. Hizmet/İşlem Tanımları
**Kaynak:** `TETKIK` → **Hedef:** `cln_services`

| Eski Sütun | Yeni Sütun | Dönüşüm |
| :--- | :--- | :--- |
| `KOD` | `code` | Doğrudan (varchar) |
| `ACIKLAMA` | `name` | Doğrudan |
| `FIYAT` veya `BUTFIYATI` | `price` | Öncelik: FIYAT > BUTFIYATI |
| `IPTAL` | `is_active` | `IPTAL=0` → `is_active=1` |

## 4. Yapılan İşlemler (Adisyon Kalemleri)
**Kaynak:** `HST_ISLEMLER` → **Hedef:** `cln_appointment_items`

| Eski Sütun | Yeni Sütun | Dönüşüm |
| :--- | :--- | :--- |
| `GELISNO` | `appointment_id` | `cln_appointments.legacy_visit_id` üzerinden eşleştir |
| `ISLEMNO` | `service_id` | `cln_services.code` üzerinden eşleştir |
| `ISLEMNO` → `TETKIK.ACIKLAMA` | `item_name` | İşlem adını getir |
| `ADET` | `quantity` | Doğrudan (varsayılan 1) |
| `FIYAT` | `unit_price` | Doğrudan |
| `FIYAT * ADET` | `total_price` | Hesapla |
| `YAPAN` | `performer_id` | Kullanıcı eşleştirmesi |

## 5. Tıbbi Kayıtlar (Muayene Notları)
**Kaynak:** `HST_TIBBI_EPIKRIZ_TAKIP` → **Hedef:** `cln_examinations`

| Eski Sütun | Yeni Sütun | Dönüşüm |
| :--- | :--- | :--- |
| `EPIKRIZ_ID` → `TIBBIDOSYA_ID` → `GELISNO` | `legacy_visit_id` | Zincir takibi gerekli |
| `SIKAYETLER` | `complaint` | Doğrudan (TEXT) |
| `HIKAYESI` | `story` | Doğrudan (TEXT) |
| `BULGULAR` | `bulgular` | Doğrudan (TEXT) |
| `TESHIS` | `diagnosis` | Doğrudan (TEXT) |
| `TEDAVI` | `treatment` | Doğrudan (TEXT) |
| `SONUC` | `result_note` | Doğrudan (TEXT) |

## 6. Kullanıcılar (Personel/Doktor)
**Kaynak:** `KULLANICILAR` → **Hedef:** `sys_users`

| Eski Sütun | Yeni Sütun | Dönüşüm |
| :--- | :--- | :--- |
| `TAKIPNO` | `legacy_id` | Eklenmeli! |
| `GIRISKODU` | `username` | Doğrudan |
| `ISIMSOYISIM` | `name` | Doğrudan |
| `GOREVNO` | `role` | 2→'doctor', 16→'secretary', else 'admin' |
| `IPTAL` | `is_active` | `IPTAL=0` → `is_active=1` |

---

## Aktarım Öncelik Sırası
1. `sys_users` (Kullanıcılar) - Diğer tablolarda referans olarak kullanılıyor
2. `cln_services` (Hizmetler) - İşlem kalemlerinde referans
3. `ptn_cards` (Hastalar) - Ana veri
4. `cln_appointments` (Gelişler/Randevular)
5. `cln_appointment_items` (Yapılan işlemler)
6. `cln_examinations` (Tıbbi notlar)
