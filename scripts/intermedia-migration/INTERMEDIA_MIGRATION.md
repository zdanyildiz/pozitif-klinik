# Intermedia Migration Dokumani (Taslak)

Bu dokuman Intermedia kaynakli (MSSQL) veri aktarimlarini, Pozitif Klinik (MySQL) veri modeline gore planlamak icin hazirlanmistir.

## 1) Kapsam ve Ilke
- Intermedia ozelinde kaynak tablolar ve alanlar burada anlatilir.
- Sonraki asamada farkli klinik yazilimlari icin ortak iliski modeli ayri bir dokumanda ele alinacaktir.

## 2) Temel Iliski Modeli (Hedef Sistem)

### Klinik (Tenant)
- Tablo: sys_tenants
- Tum klinik verileri clinic_id ile baglanir.

### Personel / Doktor
- Tablo: sys_users
- Role: admin, doctor, secretary
- Personel ve doktor ayrimi role ile yapilir.

### Hasta
- Tablo: ptn_cards
- clinic_id ile sys_tenants'a bagli.

### Randevu
- Tablo: cln_appointments
- clinic_id, patient_id, doctor_id, type_id bagli.

### Muayene
- Tablo: cln_examinations
- clinic_id, patient_id, doctor_user_id bagli.
- appointment_id opsiyonel (NULL olabilir).

### Hizmet ve Adisyon
- Hizmet katalogu: cln_services
- Randevu kalemleri: cln_appointment_items
- appointment_id ile randevuya baglanir.

### Odeme
- Tablo: cln_payments
- clinic_id, patient_id, appointment_id baglari mantiksal olarak kullanilir.

### Laboratuvar
- Sonuc basliklari: cln_lab_results
- Sonuc kalemleri: cln_lab_result_items
- Test tanimlari: sys_lab_test_definitions
- Referans araliklari: sys_lab_test_normals

### Dosyalar (Radyoloji vb.)
- Tablo: sys_files
- module, related_id ve file_category ile baglanti kurulur.

## 3) Intermedia Ozel Alan Eslesmeleri (Notlar)

### 3.1 Tetkik Sonuclari (Text Birlesimi)
Kaynak tablo Intermedia tarafinda brans tablosudur:
- Kaynak: UZM_ICHASTALIKLARI_HST_ANAMNEZ
- Kolonlar: LABORATUVAR, RADYOLOJI

Hedef tarafta iki alan birlestirilir:
- Hedef: cln_examinations.lab_result_text

Birlestirme kurali:
- LABORATUVAR verisi basina "LABORATUVAR:" basligi eklenir.
- RADYOLOJI verisi basina "RADYOLOJI:" basligi eklenir.
- Ikisi de varsa tek alanda alt alta yazilir.

Ornek format:
LABORATUVAR:
{LABORATUVAR_METNI}

RADYOLOJI:
{RADYOLOJI_METNI}

Bu birlestirme su scriptte yapilmaktadir:
- scripts/intermedia-migration/merge_specialty_data.js

### 3.2 Muayene Notlari (Brans Notlari)
- Kaynak: UZM_ICHASTALIKLARI_HST_ANAMNEZ
- Hedef: cln_examinations
- Eslesen alanlar: complaint, story, diagnosis, treatment, bulgular

## 4) Aktarim Sirasina Dair On Notlar
Bu dokuman sadece iliski ve mapping seviyesinde taslaktir.
Aktarim sira ve bagimliliklari Intermedia icin ayrica listelenecek.

Onerilen sira (taslak):
1. sys_tenants, sys_users
2. ptn_cards
3. cln_services, cln_appointment_types
4. cln_appointments
5. cln_examinations
6. cln_appointment_items
7. cln_payments
8. cln_lab_* (sonuclar ve tanimlar)
9. sys_files (radyoloji vb.)

## 5) Acik Noktalar
- Intermedia tarafinda radyoloji verisi dosya olarak geliyorsa, sys_files'a mapping ayrintisi yazilacak.
- Diger brans UZM_ tablolarindan gelen ek alanlar listelenecek.

