# Görev Dokümanı: Hasta Detay ve Tıbbi Zaman Tüneli Modülü

## 1. Amaç
Kliniğe kayıtlı hastaların tüm tıbbi ve finansal geçmişini kronolojik bir yapıda, modern ve kullanıcı dostu bir arayüzle sunmak. Aktarılan ~75.000 randevu ve ~45.000 tıbbi notun anlamlı bir şekilde raporlanmasını sağlamak.

## 2. Kapsam ve Özellikler

### 2.1. Hasta Bilgi Paneli (Header)
*   **Kritik Veriler:** İsim, Yaş, Kan Grubu, TC No, Telefon, Alerjiler (varsa).
*   **Finansal Özet:** Toplam Borç / Alacak durumu.
*   **Hızlı Aksiyonlar:** Yeni Randevu Oluştur, Muayene Başlat, Dosya Yükle.

### 2.2. Tıbbi Zaman Tüneli (Timeline)
*   **Görünüm:** Dikey bir zaman tüneli yapısında tüm "Gelişler" (Visits).
*   **İçerik:**
    - **Randevu Detayı:** Tarih, Saat, Doktor, Randevu Türü.
    - **Muayene Notları:** Anamnez, Şikayet, Bulgular, Tanı ve Tedavi (Kopya değil, tekil ve temiz veri).
    - **Yapılan İşlemler:** O randevuda uygulanan hizmetler ve fiyatları.
*   **Filtreleme:** Sadece muayeneleri göster, sadece işlemleri göster, doktor bazlı filtrele.

### 2.3. Laboratuvar Sonuçları Sekmesi
*   `cln_lab_results` ve `cln_lab_result_items` tablolarından beslenen liste.
*   Anormal (yüksek/düşük) değerlerin vurgulanması.
*   Geçmiş testlerin sonuçlarını karşılaştırmalı görebilme.

### 2.4. Dijital Arşiv (Dosyalar)
*   Hastaya yüklenmiş tüm radyolojik görüntüler (Röntgen, MR vb.), epikriz raporları ve diğer dökümanlar.
*   Dosya önizleme (Lightbox/PDF viewer).

## 3. Teknik Detaylar

### 3.1. Backend (PHP / Slim Framework)
*   **Endpointler:**
    - `GET /api/patients/{id}/profile`: Temel bilgiler.
    - `GET /api/patients/{id}/timeline`: Randevu + Muayene + İşlem birleştirilmiş veri.
    - `GET /api/patients/{id}/lab-results`: Laboratuvar listesi.
    - `GET /api/patients/{id}/files`: Dosya listesi.

### 3.2. Frontend (Twig + CSS + JS)
*   **Dosya:** `templates/admin/patient_detail.twig`
*   **Estetik:** Premium koyu/açık mod uyumlu, Glassmorphism detaylar, akıcı animasyonlar.
*   **Performans:** Çok fazla randevusu olan hastalar için "Lazy Loading" veya "Pagination" kullanımı.

## 4. Veri Bütünlüğü Kuralları
*   **Duplicates:** `migrate_data.js` ile temizlenen veri yapısı korunmalı, arayüzde mükerrer kayıt basılmamalı.
*   **Gizlilik:** Kişisel veriler gösterilirken şifrelenmiş alanlar (`tc_no`, `phone` vb.) backend'de çözülerek getirilmeli.

## 5. Başarı Kriterleri
*   Sayfanın 1.5 saniyenin altında yüklenmesi.
*   Doktorun bir bakışta hastanın son 3 muayene notunu ve son lab sonucunu görebilmesi.
*   Mobil uyumluluk (Doktorun tabletten inceleyebilmesi için).
