# Log Migrasyonu ve Süreç Kurgusu Dokümanı

## 1. Giriş
Bu doküman, Intermedia (MSSQL) sisteminden Pozitif Klinik (MySQL) sistemine aktarılacak zorunlu logların (Audit Trail) yapısını, aktarım stratejisini ve yeni sistemdeki backend işleyişini tanımlar.

## 2. Mevcut Yapı Analizi
Pozitif Klinik veritabanında loglar tek bir tabloya zorunlu değildir. Audit trail için `cln_activity_logs` ana tablo olarak kalır; erişim ve onam gibi farklı ihtiyaçlar için ayrı log tabloları kullanılır.

### cln_activity_logs Tablosu (Audit Trail)
| Sütun | Tip | Açıklama |
| :--- | :--- | :--- |
| `id` | BIGINT | Birincil anahtar |
| `clinic_id` | BIGINT | Kliniğe özel ayrım (Multi-tenant) |
| `user_id` | BIGINT | İşlemi yapan personel (Mapped from legacy KIM) |
| `action` | VARCHAR | İşlem kodu (Örn: `PATIENT_UPDATE`, `PAYMENT_DELETE`) |
| `module` | VARCHAR | İşlem modülü (Örn: `PATIENT`, `FINANCE`, `SECURITY`) |
| `record_id` | BIGINT | Etkilenen kaydın yeni sistemdeki ID'si |
| `record_type` | VARCHAR | Etkilenen tablo/model adı (Örn: `Patient`, `Payment`) |
| `old_values` | JSON | Değişiklik öncesi veri seti |
| `new_values` | JSON | Değişiklik sonrası veri seti |
| `ip_address` | VARCHAR | İşlemi yapan cihazın IP adresi |
| `description` | TEXT | İnsan tarafından okunabilir özet |
| `created_at` | TIMESTAMP | İşlem tarihi |
| `legacy_table` | VARCHAR | Legacy tablo adı/kodu |
| `legacy_record_id` | BIGINT | Legacy kayıt id |

### cln_data_access_logs Tablosu (KVKK Erişim İzleri)
Hasta verisine erişim kayıtları ayrı tutulur. KVKK denetimi için doğrudan raporlanır.

### ptn_consent_logs Tablosu (KVKK/ETK/IYS Onam Geçmişi)
Onam geçmişi `ptn_kvkk_consents` OTP tablosuna değil, ayrı bir geçmiş tablosuna aktarılır.

## 3. Kaynak (Intermedia) Mappings

Aktarımı zorunlu tutulan tabloların yeni yapıya eşlenmesi:

### A. Genel İşlem Logları (`GENELLOG`)
- **Amaç:** Veri güncellemeleri ve kritik kullanıcı hareketleri.
- **Eşleşme:**
    - `KIM` -> `user_id` (Mapped id)
    - `BOLUM` -> `module`
    - `ACIKLAMA` -> `description`
    - `DETAY` -> `old_values` (String parse edilerek JSON yapılacak)
    - `TARIH` -> `created_at`

### B. Kayıt Değişiklik İzi (`LOG_KAYITDEGISIKLIGI`)
- **Amaç:** Hasta kartı, muayene vb. kayıtlardaki alan bazlı değişiklikler.
- **Eşleşme:**
    - `TABLE_ID` -> `record_type` (SQL Table map tablosu oluşturulacak)
    - `RECORD_ID` -> `record_id` (Yeni sistem ID'sine karşılık gelen `legacy_id` üzerinden)
    - `ESKIDEGERLER` -> `old_values` (JSON formatına dönüştürülecek)

### C. Veriye Erişim ve Hasta Onay Logları (`Kullanici_Log_KayitErisim`, `Hst_Anadosya_GizlilikOnamFormu_Log`)
- **Amaç:** KVKK kapsamında "Hassas veriye kim erişti?" ve "Hasta onay verdi mi?" sorularının yanıtı.
- **Eşleşme:**
    - `Kullanici_Log_KayitErisim` -> `cln_data_access_logs`
    - `Action` -> `DATA_ACCESS`
    - `HastaNo` -> `patient_id` (Mapped id)
    - `KayitTuruTanimID` -> `description` (Örn: "Muayene kartı görüntülendi")
    - `Hst_Anadosya_GizlilikOnamFormu_Log` -> `ptn_consent_logs`
    - `Action` -> `CONSENT_GIVEN` / `CONSENT_REVOKED`
    - `HastaNo` -> `patient_id` (Mapped id)

### D. İletişim Logları (`ILET_SMS_LOG`, `ILET_EMAIL_LOG`)
- **Amaç:** Geçmiş SMS ve Email bildirimlerinin takibi.
- **Eşleşme:**
    - `ILET_SMS_LOG` -> `sys_sms_logs` tablosuna aktarılacak.
    - `TEL`/`TELEFON` -> `phone`
    - `MESAJ` -> `message`
    - `TARIH` -> `sent_at`
    - `TURU` -> `status` (Mapped: 1=sent, 2=failed vb.)
    - `ILET_EMAIL_LOG` -> `sys_email_logs`
    - `MAIL` -> `to_email`
    - `BASLIK` -> `subject`
    - `ICERIK` -> `body_preview`
    - `TARIH` -> `sent_at`
    - `TURU` -> `status` (Mapped: 1=sent, 2=failed vb.)

### E. Güvenlik Logları (`LOGIN_LOGOUT`)
- **Amaç:** Sisteme giriş-çıkış takibi.
- **Eşleşme:**
    - `Action` -> `AUTH_LOGIN` / `AUTH_LOGOUT`
    - `IP` -> `ip_address`
    - `TERMINAL` -> `description` (Cihaz adı)

## 4. Backend Entegrasyonu ve Backend Yansıması

Aktarılan ve yeni oluşacak logların uygulama tarafında kullanımı:

### A. Tarihçe (History) Modülü
Backend tarafında her ana entity (Hasta, Ödeme, Randevu) için bir `ActivityService` oluşturulacak. Bu servis:
- Bir kayıt görüntülendiğinde (GET) `cln_activity_logs` tablosunu sorgulayarak o kayda ait geçmişi listeleyebilecek.
- Örn: `GET /api/patients/{id}/history` endpoint'i üzerinden hastanın tüm geçmiş logları timeline olarak sunulacak.

### B. KVKK Denetim Raporu
Platform yönetimi için "Kullanıcı Erişim Raporu" oluşturulacak. Bu rapor:
- Belirli bir tarih aralığında, hangi personel hangi hastanın verisini görüntüledi (Eski Intermedia verileri dahil) listeleyecek.

### C. Yazılım Tasarımı (Event-Driven Logging)
Yeni backend geliştirilirken Manuel loglama yerine **Observer / Event** deseni kullanılacak:
- `PatientUpdated` event'i ateşlendiğinde, bir `ActivityLogger` listener'ı otomatik olarak `old_values` ve `new_values` arasındaki farkı (diff) hesaplayıp JSON olarak kaydedecek.

## 5. Migrasyon Stratejisi

1. **Önce User Mapping:** Intermedia'daki `KIM` (PersonelID) değerleri `sys_users` tablosundaki `legacy_id` ile eşleştirilecek.
2. **Tablo Mapping:** Eski `TABLE_ID` değerleri için yeni sistemdeki Table adlarını içeren bir lookup tablosu (`map_legacy_tables`) hazırlanacak.
3. **Data Transform:** Intermedia'nın string formatında tuttuğu log detayları (Örn: `AD="Ali" SOYAD="Veli"`) regex ile JSON formatına (`{"AD": "Ali", "SOYAD": "Veli"}`) dönüştürülerek aktarılacak.
4. **Idempotency:** `cln_activity_logs` tablosunda `legacy_table` + `legacy_record_id` kombinasyonu ile mükerrer aktarım önlenecek.

### D. Data Transform Örneği (Technical Detail)
Intermedia'dan gelen `ESKIDEGERLER` sütunu şu formattadır:
`AD="Ali" SOYAD="Veli" CINSIYET="E"`

Bu veriyi MySQL'e aktarırken kullanılacak regex mantığı:
```javascript
function parseLegacyLog(str) {
    const regex = /([A-Z0-9_]+)="([^"]*)"/g;
    let m;
    const result = {};
    while ((m = regex.exec(str)) !== null) {
        result[m[1]] = m[2];
    }
    return JSON.stringify(result);
}
```
**Hedef:** `{"AD": "Ali", "SOYAD": "Veli", "CINSIYET": "E"}`

## 6. Aktarılacak Zorunlu Tablo Listesi (Final Checklist)
1. `GENELLOG` (Genel işlemler)
2. `LOG_KAYITDEGISIKLIGI` (Veri değişim izi)
3. `Kullanici_Log_KayitErisim` (KVKK Erişim logu)
4. `LOGIN_LOGOUT` (Sistem giriş-çıkış)
5. `Kullanici_Log_HastaSorgulama` (Arama/Sorgulama logu)
6. `Hst_Anadosya_GizlilikOnamFormu_Log` (Hasta onay geçmişi)
7. `ILET_SMS_LOG` (SMS gönderim geçmişi)
8. `ILET_EMAIL_LOG` (Email gönderim geçmişi)

## 7. Sonuç
Bu kurgu ile hem yasal saklama yükümlülükleri yerine getirilmiş olacak, hem de yeni sistemde hastaların tüm tarihsel gelişimi tek bir arayüzden takip edilebilecektir. Teknik hata logları (`Log_HataMesaji` vb.) bu kapsama alınmayarak veritabanı temiz tutulacaktır.
