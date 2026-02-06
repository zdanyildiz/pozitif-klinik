# Pozitif Klinik - Epikriz ve Doküman Modülü Geliştirme Dokümanı

**Versiyon:** 1.0
**Tarih:** 06.02.2026
**Durum:** Taslak (Draft)
**Referans Belgeler:** `docs/ARCHITECTURE.md`, `docs/Mimari_Kurallar.md`

## 1. Mimari Yaklaşım ve Kurallar

Projenin mevcut MVC yapısı ve "Domain Driven" klasörleme mantığına uygun olarak, Epikriz sistemi tek bir "Doküman Oluşturma" fonksiyonu değil, yönetilebilir bir **Domain** olarak kurgulanmalıdır.

### Temel Prensipler (Mimari Kurallar'dan Türetilmiştir):

1. **İş Mantığı Serviste Kalacak:** Controller sadece HTTP isteğini karşılayıp `DocumentService`'i çağıracak. PDF oluşturma, veri toplama işleri serviste yapılacak.
2. **Repo Sorumluluğu:** Veritabanından şablon çekme işlemi `DocumentTemplateRepository` içinde olacak.
3. **Dinamik Yapı:** Şablonlar "Hard-coded" HTML değil, Twig motoru ile render edilen dinamik yapılar olacak.
4. **Multi-Tenant Uyumu:** Her kliniğin kendi şablonu olabileceği gibi, sistem genelinde "Varsayılan" şablonlar da olacak.

---

## 2. Veritabanı Şeması (Migration Planı)

Epikriz şablonlarını ve oluşturulan dokümanların kaydını tutmak için aşağıdaki tablolar gereklidir.

```sql
-- 1. Doküman Şablonları Tablosu
CREATE TABLE clinic_document_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NULL, -- NULL ise Sistem Varsayılanı, Dolu ise Kliniğe Özel
    name VARCHAR(100) NOT NULL, -- Örn: "Standart Epikriz", "Özet Epikriz (İng)"
    type VARCHAR(50) NOT NULL, -- 'epicrisis', 'prescription', 'consent_form'
    content_html MEDIUMTEXT NOT NULL, -- Twig formatında HTML şablon
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 2. Oluşturulan Dokümanlar Logu (Opsiyonel ama önerilir)
CREATE TABLE patient_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    patient_id INT NOT NULL,
    examination_id INT NULL,
    template_id INT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT NOT NULL, -- User ID
    file_path VARCHAR(255) NULL, -- Eğer PDF olarak saklanacaksa
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

```

---

## 3. Backend Geliştirme Planı

### A. Klasör Yapısı (Domain)

Yeni bir domain oluşturulmalıdır: `src/Domain/Document`

```
src/Domain/Document/
├── DocumentController.php       # Web/API Endpoint'leri
├── DocumentService.php          # İş Mantığı ve PDF Render
├── DocumentRepository.php       # DB İşlemleri
├── TemplateRenderer.php         # Twig Data Binding (Helper)
└── Templates/                   # (Opsiyonel) Varsayılan .twig dosyaları

```

### B. Service Katmanı (`DocumentService.php`)

Bu servis, bir epikriz oluşturmak için gerekli olan `Patient`, `Examination`, `LabResults` ve `Diagnosis` verilerini toplar ve tek bir veri paketine (DTO) dönüştürür.

**Veri Toplama Mantığı:**

1. `ExaminationRepository`'den muayene detaylarını çek.
2. `PatientRepository`'den hasta kimlik bilgilerini çek.
3. `LabRepository`'den o muayeneye (`appointment_id`) bağlı sonuçları çek.
4. Legacy Veri Kontrolü: Eğer `examination.lab_notes` doluysa bunu da veriye ekle.

### C. PDF Kütüphanesi

Projede PHP tabanlı olduğu için **mPDF** kütüphanesi önerilir (UTF-8 ve CSS desteği güçlüdür).
*Kurulum:* `composer require mpdf/mpdf`

---

## 4. Şablon Motoru (Twig) ve Veri Değişkenleri

Veritabanındaki `content_html` alanında veya `.twig` dosyasında kullanılacak standart değişken seti belirlenmelidir. Bu sayede şablonları düzenleyen kişi hangi verinin nereden geleceğini bilir.

### Standart Değişken Listesi (Variables)

| Değişken | Açıklama | Kaynak |
| --- | --- | --- |
| `{{ clinic.name }}` | Klinik Adı | Tenant |
| `{{ clinic.logo }}` | Logo URL | Tenant |
| `{{ patient.full_name }}` | Hasta Adı Soyadı | Patient |
| `{{ patient.tc_no }}` | TC Kimlik No | Patient |
| `{{ patient.birth_date }}` | Doğum Tarihi | Patient |
| `{{ exam.date }}` | Muayene Tarihi | Examination |
| `{{ exam.complaint }}` | Şikayet | Examination |
| `{{ exam.history }}` | Hikaye (Anamnez) | Examination |
| `{{ exam.findings }}` | Bulgular | Examination |
| `{{ exam.result_note }}` | Sonuç Notu / Tedavi | Examination |
| `{{ diagnoses }}` | Tanılar (Array) | Examination (ICD Pivot) |
| `{{ lab_results }}` | Lab Sonuçları (Array) | LabRepository |
| `{{ legacy_lab_note }}` | Manuel Tetkik Notu | Examination (Textarea) |
| `{{ doctor.name }}` | Doktor Adı | User |

### Örnek Twig Şablonu (Parça)

```html
<div class="header">
    <img src="{{ clinic.logo }}" width="150">
    <h1>{{ clinic.name }} - Epikriz Raporu</h1>
</div>

<table class="patient-info">
    <tr>
        <td><strong>Hasta:</strong> {{ patient.full_name }}</td>
        <td><strong>TC:</strong> {{ patient.tc_no }}</td>
        <td><strong>Tarih:</strong> {{ exam.date|date("d.m.Y") }}</td>
    </tr>
</table>

<h3>Tanılar (ICD-10)</h3>
<ul>
    {% for diag in diagnoses %}
        <li>{{ diag.code }} - {{ diag.name }}</li>
    {% endfor %}
</ul>

<h3>Tetkik Sonuçları</h3>
{% if lab_results is not empty %}
    <table border="1">
        {% for lab in lab_results %}
            <tr>
                <td>{{ lab.test_name }}</td>
                <td>{{ lab.result_value }} {{ lab.unit }}</td>
                <td>{{ lab.reference_range }}</td>
            </tr>
        {% endfor %}
    </table>
{% endif %}

{% if legacy_lab_note %}
    <div class="legacy-note">
        <strong>Ek Notlar:</strong><br>
        {{ legacy_lab_note|nl2br }}
    </div>
{% endif %}

```

---

## 5. Uygulama Adımları (Implementation Steps)

### Adım 1: Migration Çalıştırılması

`migrations/` klasörüne yeni SQL dosyası eklenip çalıştırılacak.

### Adım 2: Repository ve Entity Oluşturma

`src/Domain/Document/DocumentTemplateRepository.php` oluşturulacak. Sadece `SELECT` ve `INSERT` işlemlerini içerecek.

### Adım 3: Service Kodlaması

`generateEpicrisisPdf(int $examinationId, int $templateId)` metodu yazılacak.
Bu metod:

1. Verileri toplayacak (`getDataForTemplate`).
2. Twig'i render edecek (`renderView`).
3. mPDF'i başlatıp HTML'i verecek.
4. Çıktıyı (Output) stream olarak dönecek.

### Adım 4: Controller Entegrasyonu

`ExaminationController` veya yeni `DocumentController` içine şu route eklenecek:
`GET /examination/{id}/epicrisis?template_id=1`

```php
// Örnek Controller Metodu
public function printEpicrisis($request, $response, $args) {
    $examId = $args['id'];
    $templateId = $request->getQueryParam('template_id', 1); // Varsayılan 1

    $pdfContent = $this->documentService->generateEpicrisisPdf($examId, $templateId);

    $response->getBody()->write($pdfContent);
    return $response
        ->withHeader('Content-Type', 'application/pdf')
        ->withHeader('Content-Disposition', 'inline; filename="epikriz.pdf"');
}

```

### Adım 5: Frontend (UI) Düzenlemesi

1. Muayene ekranındaki "Yazdır" butonuna tıklandığında küçük bir Modal açılacak.
2. Modal içinde: "Şablon Seçiniz" (Standart, Özet, İngilizce) dropdown'ı olacak.
3. "Oluştur" dendiğinde yeni sekmede PDF açılacak.

---

## 6. Özet Kontrol Listesi (Checklist)

* [x] `cln_document_templates` tablosu oluşturuldu mu? ✓ (migration/database/migrations/13_document_templates.sql)
* [x] Varsayılan şablon (Standart Epikriz) veritabanına seed edildi mi? ✓ (2 şablon: Standart ve Özet)
* [x] mPDF kütüphanesi projeye dahil edildi mi? ✓ (v6.1.3)
* [x] `DocumentRepository` tamamlandı mı? ✓ (src/Domain/Document/DocumentRepository.php)
* [x] `DocumentService` mimari kurallara uygun mu? ✓ (src/Domain/Document/DocumentService.php)
* [x] `DocumentController` tamamlandı mı? ✓ (src/Domain/Document/DocumentController.php)
* [x] DI Container kayıtları yapıldı mı? ✓ (config/container.php)
* [x] API Dokümantasyonu güncellendi mi? ✓ (docs/API.md)
* [x] Frontend (Muayene Ekranı) epikriz butonu eklendi mi? ✓ (clinic_examination.twig, examination.js)
* [x] Veritabanı migration'ı çalıştırıldı mı? ✓ (XAMPP üzerinde başarıyla çalıştırıldı)
* [ ] Legacy veriler (`lab_notes`) şablona dahil edildi mi? (İsteğe bağlı)
* [ ] Çoklu ICD kodları döngüye (loop) alındı mı? (Şablonlarda mevcut, ICD API bağlantısı bekliyor)

---

## 7. Kurulum Rehberi

### Veritabanı Migration
```bash
mysql -u root pozitif_klinik < migration/database/migrations/13_document_templates.sql
```

### Kullanım
1. Muayene ekranında bir hastayı açın
2. Muayeneyi kaydedin
3. "Epikriz" butonunun görünmesini bekleyin
4. Dropdown'dan şablon seçin veya varsayılan ile PDF oluşturun
5. PDF yeni sekmede açılacaktır

---

## 8. Gelecek Geliştirmeler

1. **Şablon Yönetim Ekranı**: Platform admin panelinde şablon CRUD işlemleri
2. **Klinik Özel Şablonlar**: Her kliniğin kendi şablonunu oluşturabilmesi
3. **Reçete ve Onay Formları**: Epikriz dışında diğer doküman türleri
4. **E-İmza Entegrasyonu**: PDF'lere dijital imza ekleme
5. **Doküman Arşivi**: Oluşturulan tüm dokümanları listeleme ve arama