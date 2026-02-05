# ICD-10 Kütüphanesi Entegrasyon ve Migrasyon Planı

Bu doküman, Pozitif Klinik sistemine Uluslararası Hastalık Sınıflandırması (ICD-10) kodlarının nasıl entegre edileceğini, arama algoritmalarını ve eski verilerin iyileştirilmesi stratejilerini açıklar.

## 1. Veri Kaynağı ve Hedef Yapı

### Kaynak (Legacy MSSQL)
*   **Tablo:** `LST_ICDKODLARI`
*   **Kayıt Sayısı:** ~19.111
*   **Kritik Sütunlar:**
    *   `ICD_KODU`: Resmi kod (Örn: J03.9)
    *   `ACIKLAMA`: Tanı adı (Örn: Akut Tonsilit, Tanımlanmamış)
    *   `ANA_KOD`: Grup kodu (Opsiyonel, hiyerarşi için)

### Hedef (MySQL - Pozitif Klinik)
*   **Tablo:** `sys_icd10`
*   **Kayıt Sayısı:** ~19.111
*   **Schema:**
    ```sql
    CREATE TABLE `sys_icd10` (
      `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
      `code` varchar(10) NOT NULL,
      `name` varchar(255) NOT NULL,
      `is_common` tinyint(1) DEFAULT 0, -- Sık kullanılan tanılar için işaret
      PRIMARY KEY (`id`),
      UNIQUE KEY `code` (`code`),
      KEY `idx_icd_name` (`name`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ```
*   **Not:** `is_common` alanı, Türkiye'de en sık konulan 100 tanıyı (Örn: Gripler, Tansiyon, Diyabet) işaretlemek için kullanılacaktır.

## 2. Kullanıcı Deneyimi (UX) ve Arama Stratejisi

19.000+ kayıt arasında kaybolmadan doğru tanıyı bulmak için "Hibrit Arama" stratejisi uygulanacaktır.

### A. Branş Bazlı Boost (Akıllı Sıralama)
Doktorun uzmanlık alanına göre arama sonuçları ağırlıklandırılacaktır.

*   **Logic:** Arama motoru, eşleşen sonuçları döndürürken ICD kodunun baş harfine (Kategori) bakar.
*   **Örnek Senaryo:** "Enfeksiyon" araması yapıldığında:
    *   **Göz Doktoru (H Grubu):** Göz enfeksiyonları (H kodları) en üstte çıkar.
    *   **Dahiliye (J, E, A Grubu):** Solunum veya sistemik enfeksiyonlar en üstte çıkar.

| Harf | Kategori | İlgili Branşlar |
| --- | --- | --- |
| **A-B** | Enfeksiyon | Dahiliye, Çocuk, Enfeksiyon |
| **C-D** | Tümörler | Onkoloji, Cerrahi |
| **E** | Endokrin | Dahiliye, Endokrinoloji |
| **F** | Psikiyatri | Psikiyatri, Psikoloji |
| **G** | Nöroloji | Nöroloji, Beyin Cerrahisi |
| **H** | Göz / KBB | Göz, KBB |
| **I** | Dolaşım | Kardiyoloji, KVC |
| **J** | Solunum | Göğüs, KBB, Dahiliye |
| **K** | Sindirim | Gastro, Genel Cerrahi |
| **L** | Cilt | Dermatoloji |
| **M** | Kas-İskelet | Ortopedi, FTR |
| **N** | Ürogenital | Üroloji, Kadın Doğum, Nefroloji |

### B. Favoriler (Sık Kullanılanlar)
Her kliniğin veya doktorun kendine özel bir favori listesi olacaktır.
*   **Tablo:** `cln_diagnosis_favorites`
*   **Davranış:** Arama kutusu boşken veya odaklanıldığında (focus), önce bu favoriler listelenir.

## 3. Veri Zenginleştirme (Data Enrichment)

Eski sistemden aktarılan hasta geçmişindeki serbest metin (free-text) tanıların, resmi ICD kodlarına dönüştürülmesi projesidir.

### Hedef
Eski veri: `TANI: "seker hastaligi tip 2"`
Yeni veri: `ICD: E11 (Tip 2 Diabetes Mellitus) + Orijinal Metin`

### Yöntem (Mapping Script)
1.  **Normalization:** Metin temizlenir (Küçük harf, Türkçe karakter, "1-", "Tanı:" gibi önekler atılır).
2.  **Lookup:** Temizlenmiş metin `sys_icd10` tablosunda `LIKE` veya `FULLTEXT` ile aranır.
3.  **Threshold:** %90+ benzerlik gösteren eşleşmeler otomatik, %70-90 arası "Öneri" olarak işaretlenir.
4.  **Update:** `cln_examinations` tablosundaki ilgili kaydın `diagnosis_code` alanı güncellenir.

## 4. Uygulama Adımları

1.  **[TAMAMLANDI]** Hedef tablo (`sys_icd10`) oluşturulması.
2.  **[BEKLEMEDE]** MSSQL `LST_ICDKODLARI` -> MySQL `sys_icd10` aktarımı.
3.  **[PLANLANIYOR]** Backend `DiagnosisController` içinde "Branş Bazlı Boost" algoritmasının kodlanması.
4.  **[PLANLANIYOR]** Frontend "ICD Seçici" komponentinin (Select2/Autocomplete) geliştirilmesi.
