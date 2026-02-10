# Geliştirme Planı: Kapsamlı Hasta Formu Sayfası

## 1. Problemin Tanımı
Mevcut sistemde hasta ekleme ve düzenleme işlemleri bir **Modal** (açılır pencere) üzerinden yapılmaktadır. Ancak:
* **Veri Kısıtlılığı:** Modal yapısı, hastanın sahip olduğu geniş veri kümesini (Kimlik, İş, Tıbbi Geçmiş, Sigorta vb.) kullanıcı dostu bir şekilde sunmak için yetersiz kalmaktadır.
* **UX/UI Zorlukları:** Çok sayıda alanın modal içine sıkıştırılması, karmaşıklığa ve hatalı veri girişine neden olmaktadır.
* **Tutarsızlık:** "Hasta Detay" sayfasında görülen birçok profil alanı (Örn: Baba adı, Kronik Hastalıklar, Sigorta Poliçeleri) şu anki düzenleme modalında bulunmamaktadır.

## 2. Önerilen Çözüm
Modal yapısından vazgeçilerek, tüm verilerin kategorize edildiği, sekmeli (tabbed) bir **"Hasta Formu"** sayfası geliştirilecektir.

## 3. Uygulama Detayları

### 3.1. Rota Değişiklikleri (Web)
`PatientWebController` sınıfına aşağıdaki metodlar eklenecektir:
* `GET /admin/patients/add`: Yeni hasta oluşturma formunu yükler.
* `GET /admin/patients/{id}/edit`: Mevcut hastanın verileriyle birlikte düzenleme formunu yükler.

### 3.2. Form Yapısı (UI/UX)
Yeni form sayfası (`patient_form.twig`), aşağıdaki sekmelerden oluşacaktır:
1.  **Genel Bilgiler:** İsim, TC No, Telefon, E-posta, Adres.
2.  **Kimlik & Nüfus:** Anne/Baba adı, Doğum yeri, Medeni hal, Uyruk, Vergi No.
3.  **Çalışma Bilgileri:** Meslek, Şirket, Ünvan, İş telefonları.
4.  **Tıbbi Bilgiler:** Kronik hastalıklar (Multi-select), Alerjiler, Önemli Uyarılar.
5.  **Sigorta & Yasal:** SGK Durumu, Özel Sigorta Poliçeleri, KVKK ve ETK onayları.

### 3.3. Veri Modeli ve API (Backend)
* **JSON Metadata:** Projede kullanılan `extra_metadata` (veya benzeri JSON kolonları) yapısı tam olarak kullanılacaktır.
* **Repository Güncellemesi:** `PatientRepository`, formdan gelen iç içe geçmiş (nested) verileri veritabanındaki JSON alanlarına map edecek şekilde güncellenecektir.
* **Validasyon:** `PatientController` (API) üzerindeki validasyon kuralları, yeni eklenen alanları kapsayacak şekilde genişletilecektir.

## 4. İş Akışı ve Adımlar

### Faz 1: Altyapı Hazırlığı
1.  `PatientRepository` ve `PatientController` sınıflarının yeni alanları (JSON metadata) destekleyip desteklemediği kontrol edilecek, gerekirse güncellenecektir.
2.  `PatientWebController` içinde `add` ve `edit` metodları tanımlanacak.

### Faz 2: Görünüm Geliştirme
1.  `src/Views/patient_form.twig` dosyası oluşturulacak (Premium tasarım kurallarına uygun).
2.  Form içinde Bootstrap Nav-Tabs kullanılarak kategori ayrımı yapılacak.
3.  İl/İlçe seçimi gibi dinamik alanlar entegre edilecek.

### Faz 3: Entegrasyon ve Temizlik
1.  `patients.twig` (Liste) sayfasındaki "Yeni Hasta Ekle" ve "Düzenle" butonları yeni sayfaya yönlendirilecek.
2.  `patient_detail.twig` (Detay) sayfasındaki "Düzenle" butonu yeni sayfaya yönlendirilecek.
3.  Eski modal kodları projeden temizlenecek.

## 5. Hedef
Karmaşık hasta verilerinin %100 yönetilebilir olduğu, ölçeklenebilir ve modern bir veri giriş arayüzü sağlamak.
