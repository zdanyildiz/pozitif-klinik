# Pozitif Klinik - Epikriz ve Doküman Modülü Geliştirme Dokümanı

**Versiyon:** 1.0
**Tarih:** 06.02.2026
**Durum:** Taslak (Draft)
**Referans Belgeler:** `docs/ARCHITECTURE.md`, `docs/Mimari_Kurallar.md`

## 1. Mimari Yaklaşım ve Kurallar

Projenin mevcut MVC yapısı ve "Domain Driven" klasörleme mantığına uygun olarak, Epikriz sistemi tek bir "Doküman Oluşturma" fonksiyonu değil, yönetilebilir bir **Domain** olarak kurgulanmıştır.

### Hibrit Kayıt Modeli (Snapshot Pattern)

Tıbbi dokümantasyonun yasal geçerliliği ve veri güvenliği için **Hibrit Model** uygulanmıştır:

1.  **Dinamik Önizleme (Preview):** Doktor, istediği şablonu seçerek anlık verilerle oluşturulan PDF'i görebilir. Bu aşamada veritabanına kayıt atılmaz, sadece bellek üzerinde (on-the-fly) oluşturulur.
2.  **Kesinleştirip Kaydetme (Finalize & Snapshot):** Doktor "Onayla ve Kaydet" dediğinde:
    *   PDF fiziksel olarak sunucuya dosya sistemine (`storage/`) kaydedilir.
    *   Bu dosya, o anki verilerin **değiştirilemez bir anlık görüntüsüdür (snapshot)**.
    *   Veritabanına dosya yolu ve metadata kaydedilir.
    *   Sonradan hasta verisi değişse bile, o tarihteki epikriz değişmez.

---

## 2. Veritabanı Şeması (Migration Planı)

Epikriz şablonlarını ve oluşturulan dokümanların kaydını tutmak için aşağıdaki tablolar kullanılmıştır.

```sql
-- 1. Doküman Şablonları Tablosu
CREATE TABLE clinic_document_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NULL, -- NULL ise Sistem Varsayılanı (Platform templates), 0 ise tüm klinikler, diğerleri kliniğe özel
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'epicrisis', 'prescription', 'consent_form'
    content_html MEDIUMTEXT NOT NULL, -- Twig formatında HTML şablon
    css_styles TEXT NULL, -- Şablona özel CSS
    footer_html TEXT NULL, -- Sayfa altı bilgisi
    page_format VARCHAR(20) DEFAULT 'A4',
    orientation VARCHAR(20) DEFAULT 'portrait', -- 'portrait' veya 'landscape'
    margin_left INT DEFAULT 15,
    margin_right INT DEFAULT 15,
    margin_top INT DEFAULT 15,
    margin_bottom INT DEFAULT 15,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Hasta Dokümanları Tablosu
CREATE TABLE cln_patient_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NOT NULL,
    patient_id INT NOT NULL,
    examination_id INT NULL,
    appointment_id INT NULL,
    template_id INT NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'epicrisis'
    document_title VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NULL, -- Relatif yol: clinic_1/documents/dosya.pdf
    generated_content MEDIUMTEXT NULL, -- HTML içeriğin yedeği (Opsiyonel)
    metadata JSON NULL, -- Doktor adı, tanı vb. bilgiler (Snapshot)
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (clinic_id, patient_id),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);
```

---

## 3. Backend Geliştirme Detayları

### A. Dosya Depolama (Storage)

Yasal saklama gereklilikleri nedeniyle, dosya sistemi tabanlı depolama tercih edilmiştir.

*   **Ana Dizin:** Proje kök dizininde `/storage` (Absolute path: `PROJECT_ROOT/storage`)
*   **Klinik Dizini:** `/storage/clinic_{id}/documents/`
*   **Dosya Adı:** `epikriz_{examId}_{YYYYMMDD_HHMMSS}.pdf`
*   **Erişim:** `/Public/storage` sembolik linki üzerinden web erişimi sağlanır.

### B. PDF Kütüphanesi (mPDF v8)

Modern PHP (8.x) uyumluluğu için **mPDF v8.2.7** kullanılmıştır.
*Kurulum:* `composer require mpdf/mpdf:^8.2 --ignore-platform-reqs`

Türkçe karakter desteği için `autoScriptToLang: true` ve `autoLangToFont: true` ayarları aktiftir.

---

## 4. API Endpoint'leri

Doküman yönetimi için aşağıdaki endpoint'ler geliştirilmiştir:

| Metod | Endpoint | Açıklama |
| --- | --- | --- |
| `GET` | `/api/documents/templates?type=epicrisis` | Kullanılabilir şablonları listeler |
| `GET` | `/api/documents/epicrisis/{examinationId}?template_id=1` | PDF Önizleme (Stream döner, kaydetmez) |
| `GET` | `/api/documents/epicrisis/{examinationId}/preview` | HTML Önizleme |
| `POST` | `/api/documents/epicrisis` | **Kesinleştir ve Kaydet** (JSON Body: `{examination_id, template_id}`) |

**POST Yanıtı:**
```json
{
    "status": true,
    "message": "Epikriz başarıyla oluşturuldu ve kaydedildi",
    "data": {
        "id": 123,
        "file_url": "/storage/clinic_1/documents/epikriz_75060_20260206.pdf",
        "file_path": "clinic_1/documents/epikriz_75060_20260206.pdf"
    }
}
```

---

## 5. Şablon Motoru (Twig)

Şablonlar veritabanında saklanır ve çalışma zamanında render edilir.

### Özellikler:
*   **Footer Layout:** Doktor imzası (solda) ve Tarih (sağda) için tablo tabanlı layout kullanılır (Flexbox desteği mPDF'de sınırlıdır).
*   **Değişkenler:** `{{ patient.* }}`, `{{ examination.* }}`, `{{ doctor.* }}`, `{{ clinic.* }}`

---

## 6. Özet Kontrol Listesi (Checklist)

* [x] `cln_document_templates` tablosu oluşturuldu
* [x] `cln_patient_documents` tablosu oluşturuldu
* [x] Varsayılan şablonlar (Standart ve Özet) eklendi
* [x] mPDF kütüphanesi v8 sürümüne yükseltildi (PHP 8.3 uyumlu)
* [x] `DocumentService` - Dinamik PDF oluşturma
* [x] `DocumentService` - Dosya sistemi kayıt (Snapshot)
* [x] `storage` klasörü yapılandırıldı ve izinleri ayarlandı (chmod 777)
* [x] `Public/storage` sembolik linki oluşturuldu
* [x] Frontend: Epikriz butonu (Önizle / Kaydet seçenekleri)
* [x] Frontend: Onay dialogu ve PDF açma entegrasyonu
* [x] Platform Yönetimi: Şablon düzenleme arayüzü (`platform_document_templates.twig`)

---

## 7. Kurulum ve Sorun Giderme

### Storage İzinleri
Dosya yazma hatası alınırsa sunucuda izinleri ve sembolik linki kontrol edin:

```bash
# Proje dizininde
chmod -R 777 storage/
# Sembolik link (Eğer yoksa)
ln -s ../storage Public/storage
```

---

## 8. Gelecek Geliştirmeler

1. **E-İmza Entegrasyonu:** Kaydedilen PDF'lerin 5070 sayılı kanuna uygun imzalanması.
2. **Toplu Yazdırma:** Birden fazla hasta için toplu epikriz dökümü.
3. **Şablon Versiyonlama:** Şablon değişikliklerinin geçmişini tutma.
4. **Hasta Portalı:** Hastaların kendi epikrizlerine online erişimi.