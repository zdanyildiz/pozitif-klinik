-- ============================================
-- EPIKRIZ VE DOKÜMAN MODÜLÜ MIGRATION
-- ============================================
-- Tarih: 2026-02-06
-- Açıklama: Epikriz şablonları ve hasta dokümanları tabloları
-- ============================================

-- 1. Doküman Şablonları Tablosu
-- clinic_id NULL ise sistem varsayılanı
-- type: epicrisis, prescription, consent_form, report vb.
CREATE TABLE IF NOT EXISTS cln_document_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT(20) UNSIGNED NULL COMMENT 'NULL ise Sistem Varsayılanı, Dolu ise Kliniğe Özel',
    name VARCHAR(100) NOT NULL COMMENT 'Şablon adı (Standart Epikriz, Özet Rapor vb.)',
    type VARCHAR(50) NOT NULL DEFAULT 'epicrisis' COMMENT 'epicrisis, prescription, consent_form, report',
    content_html MEDIUMTEXT NOT NULL COMMENT 'Twig formatında HTML şablon içeriği',
    header_html TEXT NULL COMMENT 'Sayfa üst bilgisi (logo, klinik adı)',
    footer_html TEXT NULL COMMENT 'Sayfa alt bilgisi (imza, tarih)',
    css_styles TEXT NULL COMMENT 'Özel CSS stilleri',
    page_format VARCHAR(20) DEFAULT 'A4' COMMENT 'A4, A5, Letter vb.',
    orientation VARCHAR(20) DEFAULT 'portrait' COMMENT 'portrait, landscape',
    margin_top INT DEFAULT 20 COMMENT 'Üst kenar boşluğu (mm)',
    margin_right INT DEFAULT 15 COMMENT 'Sağ kenar boşluğu (mm)',
    margin_bottom INT DEFAULT 20 COMMENT 'Alt kenar boşluğu (mm)',
    margin_left INT DEFAULT 15 COMMENT 'Sol kenar boşluğu (mm)',
    is_default TINYINT(1) DEFAULT 0 COMMENT 'Türü için varsayılan şablon mu?',
    is_active TINYINT(1) DEFAULT 1,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_clinic_type (clinic_id, type),
    INDEX idx_active_type (is_active, type),
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Oluşturulan Dokümanlar Logu
-- Tıbbi Audit Trail için önemli
CREATE TABLE IF NOT EXISTS cln_patient_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT(20) UNSIGNED NOT NULL,
    patient_id BIGINT(20) UNSIGNED NOT NULL,
    examination_id BIGINT(20) UNSIGNED NULL COMMENT 'Hangi muayeneye ait',
    appointment_id BIGINT(20) UNSIGNED NULL COMMENT 'Hangi randevuya ait',
    template_id INT NULL COMMENT 'Kullanılan şablon',
    document_type VARCHAR(50) NOT NULL DEFAULT 'epicrisis' COMMENT 'epicrisis, prescription, report',
    document_title VARCHAR(255) NULL COMMENT 'Doküman başlığı',
    generated_content MEDIUMTEXT NULL COMMENT 'Oluşturulan HTML içerik (arşiv amaçlı)',
    file_path VARCHAR(500) NULL COMMENT 'PDF dosya yolu (saklanıyorsa)',
    file_id INT NULL COMMENT 'cln_files tablosuna referans',
    metadata JSON NULL COMMENT 'Ek bilgiler (doktor, tanı vb.)',
    created_by BIGINT(20) UNSIGNED NOT NULL COMMENT 'Oluşturan kullanıcı ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_clinic_patient (clinic_id, patient_id),
    INDEX idx_clinic_exam (clinic_id, examination_id),
    INDEX idx_type (document_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (clinic_id) REFERENCES sys_tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES ptn_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES sys_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Varsayılan Epikriz Şablonu (Türkçe)
-- clinic_id NULL = tüm klinikler için geçerli varsayılan
INSERT INTO cln_document_templates (clinic_id, name, type, content_html, header_html, footer_html, css_styles, is_default, is_active) VALUES
(NULL, 'Standart Epikriz', 'epicrisis',
'<div class="epicrisis-document">
    <div class="patient-section">
        <h3>HASTA BİLGİLERİ</h3>
        <table class="info-table">
            <tr>
                <td><strong>Adı Soyadı:</strong></td>
                <td>{{ patient.name }}</td>
                <td><strong>TC Kimlik No:</strong></td>
                <td>{{ patient.tc_no }}</td>
            </tr>
            <tr>
                <td><strong>Doğum Tarihi:</strong></td>
                <td>{{ patient.birth_date }}</td>
                <td><strong>Cinsiyet:</strong></td>
                <td>{{ patient.gender_text }}</td>
            </tr>
            <tr>
                <td><strong>Telefon:</strong></td>
                <td>{{ patient.phone }}</td>
                <td><strong>Muayene Tarihi:</strong></td>
                <td>{{ examination.date }}</td>
            </tr>
        </table>
    </div>

    {% if examination.complaint %}
    <div class="section">
        <h4>ŞİKAYET</h4>
        <p>{{ examination.complaint }}</p>
    </div>
    {% endif %}

    {% if examination.anamnez %}
    <div class="section">
        <h4>HİKAYE (ANAMNEZ)</h4>
        <p>{{ examination.anamnez|nl2br }}</p>
    </div>
    {% endif %}

    {% if examination.bulgular %}
    <div class="section">
        <h4>FİZİK MUAYENE BULGULARI</h4>
        <p>{{ examination.bulgular|nl2br }}</p>
    </div>
    {% endif %}

    {% if examination.diagnosis %}
    <div class="section">
        <h4>TANI</h4>
        <p>{{ examination.diagnosis }}</p>
    </div>
    {% endif %}

    {% if diagnoses|length > 0 %}
    <div class="section">
        <h4>ICD-10 TANI KODLARI</h4>
        <ul class="diagnosis-list">
            {% for diag in diagnoses %}
            <li><strong>{{ diag.code }}</strong> - {{ diag.name }}</li>
            {% endfor %}
        </ul>
    </div>
    {% endif %}

    {% if lab_results|length > 0 %}
    <div class="section">
        <h4>LABORATUVAR SONUÇLARI</h4>
        <table class="lab-table">
            <thead>
                <tr>
                    <th>Test Adı</th>
                    <th>Sonuç</th>
                    <th>Birim</th>
                    <th>Referans</th>
                </tr>
            </thead>
            <tbody>
                {% for lab in lab_results %}
                {% for item in lab.items %}
                <tr{% if item.is_abnormal %} class="abnormal"{% endif %}>
                    <td>{{ item.test_name }}</td>
                    <td>{{ item.result_value }}</td>
                    <td>{{ item.unit }}</td>
                    <td>{{ item.reference_range }}</td>
                </tr>
                {% endfor %}
                {% endfor %}
            </tbody>
        </table>
    </div>
    {% endif %}

    {% if examination.treatment %}
    <div class="section">
        <h4>TEDAVİ VE ÖNERİLER</h4>
        <p>{{ examination.treatment|nl2br }}</p>
    </div>
    {% endif %}

    {% if examination.result_note %}
    <div class="section">
        <h4>SONUÇ NOTU</h4>
        <p>{{ examination.result_note|nl2br }}</p>
    </div>
    {% endif %}
</div>',

'<div class="header">
    {% if clinic.logo_url %}
    <img src="{{ clinic.logo_url }}" class="clinic-logo" alt="{{ clinic.name }}">
    {% endif %}
    <div class="clinic-info">
        <h1>{{ clinic.name }}</h1>
        {% if clinic.address %}<p>{{ clinic.address }}</p>{% endif %}
        {% if clinic.phone %}<p>Tel: {{ clinic.phone }}{% if clinic.email %} | {{ clinic.email }}{% endif %}</p>{% endif %}
    </div>
    <div class="document-title">
        <h2>EPİKRİZ RAPORU</h2>
    </div>
</div>',

'<div class="footer">
    <div class="signature-area">
        <p>Düzenleyen Hekim</p>
        <p><strong>{{ doctor.name }}</strong></p>
        {% if doctor.specialty %}<p>{{ doctor.specialty }}</p>{% endif %}
    </div>
    <div class="date-area">
        <p>Düzenleme Tarihi: {{ "now"|date("d.m.Y") }}</p>
    </div>
</div>',

'body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #333; }
.header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 15px; }
.clinic-logo { max-height: 60px; margin-bottom: 10px; }
.clinic-info h1 { font-size: 18pt; margin: 0; color: #1e40af; }
.clinic-info p { margin: 2px 0; font-size: 9pt; color: #666; }
.document-title h2 { font-size: 14pt; margin: 15px 0 0 0; color: #1e40af; }
.patient-section { margin-bottom: 15px; }
.patient-section h3 { background: #e0e7ff; padding: 5px 10px; margin: 0 0 10px 0; font-size: 10pt; color: #3730a3; }
.info-table { width: 100%; border-collapse: collapse; }
.info-table td { padding: 4px 8px; border: 1px solid #ddd; font-size: 10pt; }
.info-table td:nth-child(odd) { background: #f8fafc; width: 15%; }
.section { margin-bottom: 12px; page-break-inside: avoid; }
.section h4 { background: #dbeafe; padding: 4px 10px; margin: 0 0 8px 0; font-size: 10pt; color: #1e40af; border-left: 3px solid #2563eb; }
.section p { margin: 0; padding: 0 10px; text-align: justify; }
.diagnosis-list { margin: 0; padding-left: 25px; }
.diagnosis-list li { margin-bottom: 3px; }
.lab-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
.lab-table th, .lab-table td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
.lab-table th { background: #e0e7ff; color: #1e40af; }
.lab-table tr.abnormal { background: #fef2f2; }
.lab-table tr.abnormal td { color: #dc2626; font-weight: bold; }
.footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; display: flex; justify-content: space-between; }
.signature-area { text-align: center; }
.signature-area p { margin: 3px 0; }
.date-area { text-align: right; font-size: 9pt; color: #666; }',
1, 1),

(NULL, 'Özet Epikriz', 'epicrisis',
'<div class="summary-epicrisis">
    <table class="summary-table">
        <tr>
            <td width="30%"><strong>Hasta:</strong> {{ patient.name }}</td>
            <td width="30%"><strong>TC:</strong> {{ patient.tc_no }}</td>
            <td width="40%"><strong>Tarih:</strong> {{ examination.date }}</td>
        </tr>
    </table>
    
    <div class="content-box">
        {% if examination.diagnosis %}
        <p><strong>Tanı:</strong> {{ examination.diagnosis }}</p>
        {% endif %}
        {% if examination.treatment %}
        <p><strong>Tedavi:</strong> {{ examination.treatment }}</p>
        {% endif %}
        {% if examination.result_note %}
        <p><strong>Sonuç:</strong> {{ examination.result_note }}</p>
        {% endif %}
    </div>
</div>',

'<div class="header-simple">
    <h2>{{ clinic.name }} - ÖZET EPİKRİZ</h2>
</div>',

'<div class="footer-simple">
    <p>Dr. {{ doctor.name }} | {{ "now"|date("d.m.Y H:i") }}</p>
</div>',

'.header-simple { text-align: center; border-bottom: 1px solid #333; margin-bottom: 15px; padding-bottom: 10px; }
.header-simple h2 { margin: 0; font-size: 14pt; }
.summary-table { width: 100%; margin-bottom: 15px; }
.summary-table td { padding: 5px; border: 1px solid #ddd; font-size: 10pt; }
.content-box { padding: 10px; border: 1px solid #ddd; background: #f9f9f9; }
.content-box p { margin: 5px 0; font-size: 10pt; }
.footer-simple { text-align: center; margin-top: 20px; font-size: 9pt; color: #666; }',
0, 1);
