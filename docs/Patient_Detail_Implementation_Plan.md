# Görev Dokümanı: Hasta Detay ve Tıbbi Zaman Tüneli Modülü

## 1. Amaç
Kliniğe kayıtlı hastaların tüm tıbbi ve finansal geçmişini kronolojik bir yapıda, modern ve kullanıcı dostu bir arayüzle sunmak. Aktarılan ~75.000 randevu ve ~45.000 tıbbi notun anlamlı bir şekilde raporlanmasını sağlamak.

## 2. Kapsam ve Özellikler

### 2.1. Hasta Bilgi Paneli (Header) [x]
*   **Kritik Veriler:** İsim, Yaş, Kan Grubu, TC No, Telefon, Alerjiler (varsa). [x]
*   **Finansal Özet:** Toplam Borç / Alacak durumu. [x]
*   **Hızlı Aksiyonlar:** Yeni Randevu Oluştur, Muayene Başlat, Dosya Yükle. [x]

### 2.2. Tıbbi Zaman Tüneli (Timeline) [x]
*   **Görünüm:** Dikey bir zaman tüneli yapısında tüm "Gelişler" (Visits). [x]
*   **İçerik:**
    - **Randevu Detayı:** Tarih, Saat, Doktor, Randevu Türü. [x]
    - **Muayene Notları:** Anamnez, Şikayet, Bulgular, Tanı ve Tedavi (Kopya değil, tekil ve temiz veri). [x]
    - **Yapılan İşlemler:** O randevuda uygulanan hizmetler ve fiyatları. [x]
*   **Filtreleme:** Sadece muayeneleri göster, sadece işlemleri göster, doktor bazlı filtrele. [ ] (Opsiyonel, temel yapı kuruldu)

### 2.3. Laboratuvar Sonuçları Sekmesi [x]
*   `cln_lab_results` ve `cln_lab_result_items` tablolarından beslenen liste. [x]
*   Anormal (yüksek/düşük) değerlerin vurgulanması. [x]
*   Geçmiş testlerin sonuçlarını karşılaştırmalı görebilme. [x]

### 2.4. Dijital Arşiv (Dosyalar) [x]
*   Hastaya yüklenmiş tüm radyolojik görüntüler (Röntgen, MR vb.), epikriz raporları ve diğer dökümanlar. [x]
*   Dosya önizleme (Lightbox/PDF viewer). [x] (FileManager component ile sağlandı)

## 3. Teknik Detaylar

### 3.1. Backend (PHP / Slim Framework) [x]
*   **Endpointler:**
    - `GET /api/patients/{id}/profile`: Temel bilgiler. [x] (findById ile birleşik)
    - `GET /api/patients/{id}/timeline`: Randevu + Muayene + İşlem birleştirilmiş veri. [x] (Controller katmanında hibritleştirildi)
    - `GET /api/patients/{id}/lab-results`: Laboratuvar listesi. [x] (LabRepository ile sağlandı)
    - `GET /api/patients/{id}/files`: Dosya listesi. [x] (FileManager ile sağlandı)

### 3.2. Frontend (Twig + CSS + JS) [x]
*   **Dosya:** `src/Views/patient_detail.twig` [x]
*   **Estetik:** Premium koyu/açık mod uyumlu, Glassmorphism detaylar, akıcı animasyonlar. [x]
*   **Performans:** Çok fazla randevusu olan hastalar için "Lazy Loading" veya "Pagination" kullanımı. [ ] (Şu an 100+ kayıt stabil, gerekirse eklenecek)

## 4. Veri Bütünlüğü Kuralları [x]
*   **Duplicates:** `migrate_data.js` ile temizlenen veri yapısı korunmalı, arayüzde mükerrer kayıt basılmamalı. [x]
*   **Gizlilik:** Kişisel veriler gösterilirken şifrelenmiş alanlar (`tc_no`, `phone` vb.) backend'de çözülerek getirilmeli. [x]

## 5. Başarı Kriterleri [x]
*   Sayfanın 1.5 saniyenin altında yüklenmesi. [x]
*   Doktorun bir bakışta hastanın son 3 muayene notunu ve son lab sonucunu görebilmesi. [x]
*   Mobil uyumluluk (Doktorun tabletten inceleyebilmesi için). [x]
