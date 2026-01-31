# Dosya Modülü Entegrasyon ve Genişletme Planı

Bu belge, mevcut Dosya Depolama Modülü'nün klinik iş akışlarına derinlemesine entegre edilmesi ve merkezi bir arşiv yönetim sistemine dönüştürülmesi için izlenecek stratejiyi kapsar.

## 📌 Genel Prensipler

Yapılacak tüm geliştirmeler **[Mimari Dokümantasyonu](ARCHITECTURE.md)** ve **[Mimari Kurallar](Mimari_Kurallar.md)** belgelerine %100 uyumlu olmalıdır:
- **SSR-First:** Sayfa açılış verileri sunucu taraflı (Twig) hazırlanmalıdır.
- **Data Isolation:** Tüm sorgularda `clinic_id` zorunluluğu ve kurumlar arası izolasyon korunmalıdır.
- **Pattern Consistency:** Veri erişimi için `Repository`, iş mantığı için `Service` katmanları kullanılmalıdır.

---

## 📂 1. Merkezi Dosya Yönetim Sayfası (Dijital Arşiv)

Tüm kliniğe ait dosyaların tek bir noktadan, gelişmiş filtreleme seçenekleri ile yönetilmesi.

- **URL:** `/admin/files`
- **Controller:** `App\Web\Controllers\FileWebController`
- **Görünüm:** `src/Views/clinic_files.twig`
- **Özellikler:**
    - **Hasta Bazlı Filtreleme:** TomSelect/Select2 entegrasyonu ile hasta adına göre hızlı arama.
    - **Modül Filtreleme:** Muayene, Hasta, Fatura vb. bazlı ayrıştırma.
    - **Tür Filtreleme:** PDF, Görüntü (Röntgen/Fotoğraf), Doküman ayrımı.
    - **JOIN Yapısı:** `sys_files` tablosunun `sys_patients` ile ilişkilendirilerek hasta bilgilerinin getirilmesi.

---

## 🏥 2. Bağlamsal (Contextual) Entegrasyonlar

Dosya yönetiminin kullanıcının iş akışına dahil edilmesi.

### 2.1. Hasta Detay Entegrasyonu
- **Konum:** `/admin/patients/{id}` (Detay Sekmesi)
- **Kapsam:** Hastaya ait genel dosyalar (Onam formları, kimlik fotokopileri vb.).
- **Teknik Uygulama:** `file_manager.twig` bileşeninin `module='patient'` parametresi ile yüklenmesi.

### 2.2. Muayene ve Tıbbi Geçiş Entegrasyonu
- **Konum:** `/admin/examination` ve Muayene Detay modal/sayfaları.
- **Kapsam:** Tıbbi ekler (Röntgen, laboratuvar sonuçları, klinik fotoğraflar).
- **Teknik Uygulama:** `module='examination'` ve `related_id={examination_id}` kullanımı.
- **Gelişmiş Özellik:** Bir hastanın detay sayfasında hem direkt kendisine bağlı (`patient`) hem de tüm muayenelerine bağlı (`examination`) dosyaların kronolojik bir zaman çizelgesinde (timeline) gösterilmesi.

---

## ⚙️ 3. Teknik Geliştirmeler (Backend)

### 3.1. Repository Genişletme
- `FileRepository::searchFiles(int $clinicId, array $filters)` metodunun eklenmesi.
- Karmaşık modül hiyerarşisi için (Örn: Hastanın tüm alt kayıtlarını kapsayan dosyalar) recursive veya sub-query destekli sorguların yazılması.

### 3.2. UX / UI İyileştirmeleri
- **Drag & Drop:** `file-manager.js` içine sürükle-bırak desteği.
- **Önizleme (Gallery):** Görüntü dosyaları için modal içinde hızlı önizleme (Lightbox benzeri yapı).
- **Batch Actions:** Birden fazla dosyayı seçip toplu silme veya zip olarak indirme.

---

## 📅 Uygulama Takvimi

1.  **Aşama 1:** `FileRepository` arama metodlarının geliştirilmesi ve API desteği. ✅ **(TAMAMLANDI)**
2.  **Aşama 2:** Merkezi "Dijital Arşiv" sayfasının (SSR) ve menü linkinin oluşturulması. ✅ **(TAMAMLANDI)**
3.  **Aşama 3:** Hasta detay ve muayene sayfalarındaki mevcut bileşenlerin aktive edilmesi. ✅ **(TAMAMLANDI)**
4.  **Aşama 4:** UX iyileştirmeleri (Drag&Drop, Önizleme). ✅ **(TAMAMLANDI)**
