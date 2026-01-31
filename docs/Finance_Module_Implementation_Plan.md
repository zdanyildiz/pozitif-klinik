# Finansal Yönetim ve Tahsilat Modülü Uygulama Planı

Bu döküman, Pozitif Klinik projesine eklenecek olan "Kasa / Tahsilat Yönetimi" modülünün teknik tasarım ve uygulama adımlarını içerir.

## 1. Amaç
Klinik finansal akışının merkezi bir noktadan yönetilmesi, bekleyen ödemelerin takibi, tahsilat girişleri ve temel ciro raporlarının sunulması.

## 2. Veritabanı Değişiklikleri

### 2.1. Yeni Tablo: `cln_payments`
Bu tablo, yapılan tüm tahsilatları ve iadeleri saklayacaktır.

```sql
CREATE TABLE `cln_payments` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `clinic_id` BIGINT UNSIGNED NOT NULL,
  `patient_id` BIGINT UNSIGNED NOT NULL,
  `appointment_id` BIGINT UNSIGNED DEFAULT NULL,
  `payment_type` ENUM('cash', 'credit_card', 'bank_transfer', 'other') NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `currency` VARCHAR(3) DEFAULT 'TRY',
  `payment_date` DATETIME NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `status` ENUM('completed', 'cancelled') DEFAULT 'completed',
  `created_by` BIGINT UNSIGNED DEFAULT NULL,
  `legacy_id` BIGINT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_clinic_payments` (`clinic_id`, `payment_date`),
  INDEX `idx_patient_payments` (`patient_id`),
  INDEX `idx_appointment_payments` (`appointment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 3. Backend Geliştirmeleri (PHP)

### 3.1. Repository Katmanı
*   **`PaymentRepository`**:
    *   `create(array $data)`: Yeni ödeme kaydı ekleme.
    *   `getPendingPayments(int $clinicId)`: Randevu ücreti tam ödenmemiş hastaların listesi (JOIN `cln_appointments`, `cln_appointment_items` ve `cln_payments`).
    *   `getDailySummary(int $clinicId, string $date)`: Günlük ödeme tiplerine göre toplam ciro.
    *   `getPatientBalance(int $patientId)`: Hastanın toplam borç/alacak durumu.

### 3.2. API Katmanı (`src/Domain/Finance/`)
*   **`PaymentController`**:
    *   `POST /api/payments`: Yeni tahsilat girişi.
    *   `GET /api/payments/report`: Tarih bazlı ciro raporu verileri.
    *   `DELETE /api/payments/{id}`: Ödeme iptali (soft delete veya status update).

### 3.3. Web Katmanı (`src/Web/Controllers/`)
*   **`FinanceController`**:
    *   `index()`: Kasa yönetimi ana dashboard (Özet verilerle).
    *   `pending()`: Borçlu listesi sayfası.
    *   `transactions()`: Son yapılan işlemler listesi.

## 4. Frontend Geliştirmeleri (Twig + JS)

### 4.1. Yeni Sayfalar (`src/Views/finance/`)
*   **`dashboard.twig`**: Günlük ciro özeti, ödeme tipi dağılımı (grafik), bekleyen toplam miktar.
*   **`pending_payments.twig`**: Borçlu hastalar tablosu, hızlı tahsilat butonu.
*   **`transactions.twig`**: Filtrelenebilir işlem geçmişi.

### 4.2. UI Bileşenleri
*   **Tahsilat Modalı**: Randevu detayından veya borçlu listesinden açılacak, tutar ve ödeme tipi seçimi sunacak.
*   **Yazdırılabilir Makbuz**: Tahsilat sonrası basit bir HTML makbuz çıktısı.

## 5. Uygulama Adımları

1.  **Veritabanı**: Migrasyon dosyasının hazırlanması ve `cln_payments` tablosunun oluşturulması.
2.  **Migration Script**: Eski MSSQL `HST_ODEMELER` tablosundaki verilerin `cln_payments`'e aktarılması için `scripts/migrate_payments.js` yazılması.
3.  **Core Logic**: `PaymentRepository` ve gerekli servislerin yazılması.
4.  **API**: Tahsilat ve raporlama endpointlerinin oluşturulması.
5.  **Dashboard**: Kasa yönetimi web arayüzünün (SSR) hazırlanması.
6.  **Entegrasyon**: Randevu detay sayfasındaki "Hizmetler & Ücretler" sekmesinin yeni ödeme sistemiyle entegre edilmesi (Bakiye gösterimi).

## 6. Mimari Kurallara Uyum
*   Tüm veriler Controller seviyesinde hazırlanıp Twig'e gönderilecek.
*   Tahsilat işlemleri CSRF korumalı API üzerinden yapılacak.
*   Kullanıcı yetkilendirmesi (Role check) eklenecek (Örn: Finansal verilere sadece Admin/Sekreter erişebilir).
