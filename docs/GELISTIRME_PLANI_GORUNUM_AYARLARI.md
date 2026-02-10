# Geliştirme Planı: Klinik Görünüm ve Yetki Ayarları

## 1. Genel Amaç
Klinik ayarları sayfasına (`/admin/settings`) yeni bir **"Görünüm ve Erişim Ayarları"** sekmesi eklenecektir. Bu sekme üzerinden, uygulama içindeki modüllerin ve hassas verilerin hangi kullanıcı rolleri (Doktor, Sekreter, vb.) tarafından görüntülenebileceği dinamik olarak yönetilecektir.

Amaç, kod değiştirmeden her klinik için farklı modül ve veri gizliliği senaryolarını hayata geçirmektir.

## 2. Kapsam ve Gereksinimler

Kullanıcı talepleri ve iletilen notlar (WhatsApp ekran görüntüleri) doğrultusunda aşağıdaki alanların yönetilebilir olması gerekmektedir:

### A. Sol Menü Modülleri (Menu Visibility)
Aşağıdaki ana menü öğelerinin kimler tarafında görüleceği ayarlanabilmelidir:
1.  **Ameliyat Takibi:** (Örn: Sadece Doktorlar görsün)
2.  **Kasa & Finans:** (Örn: Sadece Yöneticiler görsün)
3.  **Personel Yönetimi:** (Örn: Tamamen gizlensin veya sadece Admin görsün)

### B. Hasta Detay Sayfası (Patient Detail Privacy)
Hasta kartı içerisindeki hassas verilerin görünürlüğü:
1.  **Finansal Veriler:** Hastanın borç/alacak durumu, ödeme geçmişi. (Sekreter görsün, Doktor görmesin gibi)
2.  **Yaşam Bulguları (Vitals):** Tansiyon, boy, kilo geçmişi. (Gerekirse gizlenebilsin)

### C. Özel Bildirimler ve Uyarılar
1.  **Epikriz Uyarısı:** "Epikriz onayı bekliyor" gibi uyarıların sadece belirli kişilere (Örn: Yetkili Hemşire/Yönetici/Türkan Hanım gibi) gösterilmesi.
    *   *Çözüm Önerisi:* Bu ayar için "Epikriz Sorumlusu" gibi sanal bir yetki/ayar eklenebilir veya kullanıcı bazlı seçim yapılabilir.

## 3. Teknik Tasarım

### Veritabanı (Database)
Her kliniğin (`sys_tenants`) kendine özel ayarlarının tutulduğu JSON tabanlı bir yapı kullanılacaktır. Mevcut yapıda varsa `settings` sütunu, yoksa `cln_settings` tablosu kullanılacaktır.

**Örnek JSON Yapısı (`display_config`):**
```json
{
  "modules": {
    "surgery": { "doctor": true, "secretary": false, "nurse": true },
    "finance": { "doctor": false, "secretary": true },
    "personnel": { "doctor": false, "secretary": false }
  },
  "patient_detail": {
    "show_finance": { "doctor": false, "secretary": true },
    "show_vitals": { "doctor": true, "secretary": false }
  },
  "notifications": {
    "epicrisis_approver_roles": ["admin", "head_nurse"]
  }
}
```

### Arayüz (UI/UX)
*   **Konum:** `/admin/settings` -> **Görünüm Ayarları** Tabı.
*   **Yapı:** Matris şeklinde (Satırlar: Özellikler, Sütunlar: Roller) checkbox yapısı.
    *   Örn: "Ameliyat Takibi" satırında "Doktor", "Sekreter" kutucukları.

## 4. Uygulama Adımları (Eylem Planı)

1.  **Backend:**
    *   `TenantSettingsController` ve `TenantRepository` güncellenerek bu ayarların kaydedilmesi ve okunması sağlanacak.
    *   **Logic in Backend:** `TenantMiddleware` veya yeni bir `UISettingsMiddleware` içinde, giriş yapan kullanıcının rolü ile kliniğin `display_config` ayarları karşılaştırılacak.
    *   `Twig` global değişkenlerine doğrudan `can_view_finance`, `can_view_surgery` gibi **boolean** değerler (flattened permissions) enjekte edilecek. Böylece Twig içinde logic kurulmayacak.

2.  **Frontend (Settings Page):**
    *   Klinik ayarları sayfasına yeni tab eklenecek.
    *   Ayarları JSON olarak sunucuya gönderen form yapısı kurulacak.

3.  **Frontend (Layout & Views):**
    *   **Sidebar (layout.twig):** Menü öğeleri `{% if permissions.can_view_surgery %}` gibi basit koşullarla sarmalanacak.
    *   **Hasta Detay (patient_detail.twig):** Finans tab'ı ve widget'ları ilgili ayara göre gizlenecek/gösterilelcek.
    *   **Dashboard:** Epikriz uyarıları role/ayara göre filtrelenecek.

## 5. İletilen Özel Notlar (Referans)
*   *WhatsApp Notu 1:* "Ameliyat takibi ve kasa görünecek. Personeller kalkacak." -> Bu yapı varsayılan ayar olarak yapılandırılabilir ancak sistem dinamik olacak.
*   *WhatsApp Notu 2:* "Finans verileri görünmeyecek. Yaşam bulguları görünmeyecek." -> Hasta detayındaki bu bölümler kapatılabilir olacak.
*   *WhatsApp Notu 3:* "Epikriz uyarısı sadece Türkan Hanım" -> Bu, "Epikriz Uyarılarını Gör" yetkisinin sadece ilgili kullanıcıya/role verilmesi ile çözülecek.

---
**Tarih:** 2026-02-10
**Durum:** ✅ Uygulandı (Backend & UI Entegrasyonu Tamamlandı)

*Not: Ayarların kaydedileceği arayüz (`/admin/settings` -> Görünüm Ayarları tabı) bir sonraki aşamada eklenecektir. Şu an sistem varsayılan değerler ve veritabanındaki manuel tanımlamalarla tam olarak çalışmaktadır.*
