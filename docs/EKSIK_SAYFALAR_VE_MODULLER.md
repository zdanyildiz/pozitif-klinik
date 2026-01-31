# Eksik Sayfalar ve Modül Analizi

Büyük veri aktarımı sonrası, mevcut sistemdeki verilerin (özellikle tıbbi geçmiş ve detaylı işlemler) kullanıcıya sunulması ve yeni verilerin girilmesi için gereken eksik sayfalar/modüller aşağıda listelenmiştir.

## 1. Tıbbi Muayene ve Doktor Çalışma Alanı (Workspace) [TAMAMLANDI]
Mevcut randevu listesinde "Bekliyor", "İşlemde" gibi durumlar var ancak doktorun muayene notlarını gireceği kapsamlı bir ekran bulunmuyor.

*   **Sayfa Adı:** `Muayene Ekranı`
*   **İşlev:** Doktorun randevu listesinden seçtiği hasta için anamnez, bulgular, tanı (ICD-10 uyumlu), tedavi ve sonuç notlarını gireceği alan.
*   **İlişkili Tablolar:** `cln_examinations`, `sys_icd10`, `cln_diagnosis_favorites`
*   **Özellikler:**
    *   Hızlı tanı ekleme (Veritabanı bağlantılı ICD-10 arama).
    *   Klinik bazlı favori tanı yönetimi (Branş uyumlu).
    *   Önceki muayene notlarını aynı ekranda görme (History Sidebar).
    *   Mevcut muayene ile ilişkili veya hastanın geçmiş laboratuvar sonuçlarının görüntülenmesi.
    *   Randevu listesinden doğrudan erişim.

## 2. Detaylı Hasta Kayıt Defteri ve Zaman Tüneli [PLAN HAZIRLANDI]
`patients.twig` sayfası şu an sadece liste bazlı. Bir hastanın tüm tıbbi geçmişini tek ekranda görmek kritik önemde. Aktarılan ~75k randevu verisinin anlamlı kullanımı bu sayfaya bağlıdır.
*   **Detaylı Plan:** `docs/Patient_Detail_Implementation_Plan.md`
*   **Sayfa Adı:** `Hasta Detay / Timeline` (Örn: `/admin/patients/{id}`)
*   **İşlev:** 
    *   Hastanın tüm gelişlerinin (visit) kronolojik listesi.
    *   Her gelişte yapılan işlemler ve alınan notlar.
    *   Hastanın borç/alacak durumu.
    *   Tüm laboratuvar sonuçlarının (biyokimya, hemogram vb.) listelenmesi ve grafiksel takibi.
    *   Yüklenen dökümanlar/görüntüler.
*   **İlişkili Tablolar:** `ptn_cards`, `cln_appointments`, `cln_examinations`.

## 3. Finansal Yönetim ve Tahsilat Modülü
Randevu detayında "Hizmetler & Ücretler" sekmesi olsa da kliniğin genel finansal akışını yöneten bir ekran eksik.

*   **Sayfa Adı:** `Kasa / Tahsilat Yönetimi`
*   **İşlev:**
    *   Bekleyen ödemeler (Borçlu listesi).
    *   Yapılan tahsilatların girişi (Nakit, Kredi Kartı, Havale).
    *   Günlük/Aylık ciro raporları.
    *   Fatura/Makbuz kesme entegrasyonu.
*   **İlişkili Tablolar:** `cln_appointment_items`, `cln_payments` (Henüz oluşturulmadı, `HST_ODEMELER`'den beslenecek).

## 4. Laboratuvar Sonuçları Modülü
MSSQL'den aktarılan veya yeni girilecek olan laboratuvar verilerinin takibi.

*   **Sayfa Adı:** `Laboratuvar Sonuçları`
*   **İşlev:**
    *   Biyokimya, hemogram vb. sonuçların listelenmesi.
    *   Referans değerlerin dışındaki (yüksek/düşük) sonuçların işaretlenmesi.
    *   Sonuçların PDF olarak basılması.
*   **İlişkili Tablo:** `cln_lab_results` (Eski `HST_LAB_BIYOKIMYA`).

## 5. Raporlama ve İstatistik Ekranı
Yönetimsel kararlar için verilerin görselleştirilmesi.

*   **Sayfa Adı:** `İstatistik Dashboard`
*   **İşlev:**
    *   En çok yapılan işlemler.
    *   Doktor bazlı hasta sayıları ve performans.
    *   Klinik doluluk oranları.
    *   Demografik raporlar (Yaş/Cinsiyet/Bölge dağılımı).

---

## Öncelikli Öneri
Öncelikle **Muayene Ekranı** ve **Detaylı Hasta Timeline** sayfasının yapılması, aktarılan 82.000 tıbbi kaydın anlamlı hale gelmesini sağlayacaktır.
