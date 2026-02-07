Demo verisinin, özellikle **multi-specialty** (çok branşlı) yapıyı, laboratuvar entegrasyonunu ve finans modülünü tam kapsamlı gösterebilmesi için "kronik takipli" (örneğin hem Diyabet hem Tansiyon hastası) bir profil seçtim. Bu sayede Dahiliye, Kardiyoloji, Göz ve Diyetisyen gibi farklı branşlar arasında gezinerek sistemin bütünlüğünü sergileyebiliriz.

İşte IDE'nizdeki AI ajanlarının SQL'e dönüştürmesi için hazırladığım detaylı senaryo metni:

---

### 1. Hasta Kimlik Kartı (`ptn_cards`) Verileri

Bu hasta, sistemin tüm alanlarını dolduracak niteliktedir.

* **Ad Soyad:** Mehmet Özdemir
* **TC Kimlik No:** 12345678901 (Demo için standart format)
* **Doğum Tarihi:** 15.04.1978 (48 Yaşında)
* **Cinsiyet:** Erkek (M)
* **Telefon:** 0532 555 99 88
* **E-posta:** mehmet.ozdemir@demo-mail.com
* **Kan Grubu:** A Rh+
* **Meslek:** Mali Müşavir (Sedanter yaşam tarzını vurgulamak için)
* **Adres:** Caddebostan Mah. Bağdat Cad. No:15 D:4, Kadıköy / İstanbul
* **İl/İlçe:** İstanbul / Kadıköy (Sistemdeki ID'lere göre eşleşmeli)
* **KVKK Durumu:** Onaylı (SMS ve E-posta izinli)

---

### 2. Kronolojik Muayene ve İşlem Geçmişi (Son 1 Yıl)

Aşağıda 10 adet işlem (Muayene, Kontrol, Lab, Görüntüleme) kronolojik sırayla verilmiştir. Her adımda ilgili finansal kayıt ve tıbbi veriler de belirtilmiştir.

#### **Ziyaret 1: İlk Başvuru (Dahiliye)**

* **Tarih:** 10.02.2025 - 09:30
* **Branş:** INTERNAL_MEDICINE (İç Hastalıkları)
* **Doktor:** Uzm. Dr. Ayşe Yılmaz
* **Şikayet (Complaint):** Son 3 aydır geçmeyen yorgunluk, ağız kuruluğu, sık idrara çıkma ve son zamanlarda bulanık görme.
* **Hikaye (Story):** Ailede diyabet öyküsü mevcut (Baba). Sigara kullanıyor (günde 1 paket). Alkol sosyal içici.
* **Yaşam Bulguları (Vitals):**
* Tansiyon: 150/95 mmHg (Yüksek)
* Nabız: 88 bpm
* Kilo: 98 kg (Boy: 178 cm - Obezite Sınırı)


* **Ön Tanı:** E11 - Tip 2 Diabetes Mellitus (Şüpheli), I10 - Esansiyel Hipertansiyon.
* **İstemler:** Geniş kapsamlı kan tahlili istendi.
* **Ödeme:** 2.500 TL (Nakit) - Muayene Ücreti.

#### **Ziyaret 2: Laboratuvar Sonuçları (Lab Modülü)**

* **Tarih:** 11.02.2025 - 08:00 (Örnek alımı) -> 14:00 (Sonuç)
* **İlgili Randevu:** Ziyaret 1 ile ilişkili.
* **Test Grubu:** Biyokimya & Hemogram
* **Sonuçlar (`cln_lab_result_items`):**
1. **Açlık Kan Şekeri:** 185 mg/dL (Ref: 70-100) -> **Yüksek**
2. **HbA1c:** %8.2 (Ref: 4-6) -> **Yüksek (Diyabet Tanısı)**
3. **Kolesterol (Total):** 240 mg/dL (Ref: <200) -> **Yüksek**
4. **Trigliserid:** 210 mg/dL (Ref: <150) -> **Yüksek**
5. **ALT:** 55 U/L (Ref: <40) -> **Hafif Yüksek**
6. **Kreatinin:** 1.1 mg/dL (Ref: 0.7-1.2) -> Normal


* **Ödeme:** 3.000 TL (Kredi Kartı) - Laboratuvar Hizmetleri.

#### **Ziyaret 3: Dahiliye (Sonuç Değerlendirme & Reçete)**

* **Tarih:** 12.02.2025 - 14:00
* **Statü:** Tamamlandı
* **Tanı (Diagnosis):** E11.9 - Tip 2 Diyabet (Komplikasyonsuz), I10 - Hipertansiyon.
* **Tedavi Planı:**
* Metformin 1000mg 2x1 başlandı.
* Tansiyon için ACE İnhibitörü eklendi.
* Diyetisyen ve Göz konsültasyonu önerildi.


* **Notlar:** Hasta diyabet eğitimi için hemşireye yönlendirildi. 1 ay sonra kontrol.
* **Ödeme:** Ücretsiz (Kontrol Süresi İçinde).

#### **Ziyaret 4: Göz Hastalıkları (Konsültasyon)**

* **Tarih:** 15.02.2025 - 10:00
* **Branş:** OPHTHALMOLOGY (Göz Hastalıkları)
* **Doktor:** Op. Dr. Kemal Gözde
* **Şikayet:** Yakını görmede zorluk, diyabet kaynaklı kontrol.
* **Özel Veri (Specialty Data - JSON):**
* Göz Tansiyonu (GİB): Sağ 16 mmHg, Sol 17 mmHg (Normal).
* Fundus Muayenesi: Retinada hafif vasküler değişiklikler, diyabetik retinopati başlangıcı yok.


* **Tanı:** H52.4 - Presbiyopi.
* **İşlem:** Gözlük reçetesi düzenlendi.
* **Ödeme:** 2.000 TL (Kredi Kartı).

#### **Ziyaret 5: Kardiyoloji (Hipertansiyon Kontrolü)**

* **Tarih:** 20.02.2025 - 11:30
* **Branş:** CARDIOLOGY (Kardiyoloji)
* **Doktor:** Prof. Dr. Canan Kalp
* **Şikayet:** Eforla gelen hafif nefes darlığı.
* **Vitals:** Tansiyon 135/85 (İlaçla düşüşte).
* **Yapılan İşlem:** EKG çekildi. EKO yapıldı.
* **Bulgular (Notlar):** Sinüs ritmi normal. EKO'da sol ventrikül hipertrofisi (hafif). EF %60.
* **Tanı:** I11 - Hipertansif Kalp Hastalığı.
* **Ödeme:** 4.500 TL (Kredi Kartı) - Muayene + EKO Paketi.

#### **Ziyaret 6: Acil Servis (Akut Durum)**

* **Tarih:** 10.04.2025 - 22:15
* **Branş:** EMERGENCY (Acil Tıp)
* **Şikayet:** Şiddetli karın ağrısı ve bulantı.
* **Hikaye:** Akşam yemeğinde baharatlı ve yağlı yemek yemiş.
* **Tanı:** K29.7 - Gastrit, tanımlanmamış.
* **Tedavi:** IV Serum, Proton Pompası İnhibitörü yapıldı. 2 saat müşahede sonrası taburcu.
* **Ödeme:** 1.500 TL (Nakit).

#### **Ziyaret 7: 3. Ay Kontrolü (Dahiliye)**

* **Tarih:** 15.05.2025 - 09:00
* **Vitals:** Kilo: 94 kg (4 kg verilmiş). Tansiyon: 125/80 (Regüle).
* **Lab İsteği:** HbA1c ve Açlık Şekeri.
* **Sonuç:** HbA1c: %7.0 (Düşüşte, tedaviye yanıt var).
* **Karar:** İlaç dozlarına aynen devam. Diyete uyum iyi.
* **Ödeme:** 2.500 TL (Kredi Kartı).

#### **Ziyaret 8: KBB (Mevsimsel)**

* **Tarih:** 20.09.2025 - 14:45
* **Branş:** ENT (Kulak Burun Boğaz)
* **Şikayet:** Boğaz ağrısı, yutkunma güçlüğü, ateş.
* **Tanı:** J03.9 - Akut Tonsillit.
* **Reçete:** Antibiyotik ve analjezik düzenlendi.
* **Ödeme:** 2.000 TL (Nakit).

#### **Ziyaret 9: Check-Up (Yıllık Kontrol)**

* **Tarih:** 15.01.2026 - 08:30
* **Branş:** INTERNAL_MEDICINE
* **Şikayet:** Yıllık genel kontrol.
* **Vitals:** Kilo 90 kg. Tansiyon 120/75.
* **Lab:** Tam Check-up paneli (D Vitamini, B12, Troid, Karaciğer, Böbrek).
* **Sonuçlar:**
* D Vitamini: 15 ng/mL (Düşük)
* HbA1c: %6.5 (Hedef değerde!)


* **Notlar:** Hasta yaşam tarzı değişikliklerini başarıyla uyguluyor. D vitamini takviyesi başlandı.
* **Ödeme:** 6.000 TL (Havale/EFT) - Check-up Paketi.

#### **Ziyaret 10: İptal Edilen Randevu (Diyetisyen)**

* **Tarih:** 20.01.2026 - 15:00
* **Branş:** DIETETICS (Sistemde tanımlı değilse Dahiliye altı not olabilir, biz ayrı randevu gibi düşünelim) veya Dahiliye.
* **Durum (Status):** `cancelled` (İptal Edildi)
* **Not:** Hasta şehir dışında olduğu için randevuyu iptal etti.
* **Ödeme:** Yok.

---

### Veri Seti Hakkında İpuçları (AI Ajanı İçin Notlar)

1. **Tablo İlişkileri:** `cln_examinations` (veya `cln_appointments`) tablosu `ptn_cards` ve `sys_users` (doktor) tablolarına ID ile bağlanmalıdır.
2. **Ödeme Eşleşmesi:** Her muayene (`cln_appointments` id'si) ile `cln_payments` tablosundaki `appointment_id` eşleştirilmelidir.
3. **JSON Veriler:** Göz muayenesindeki gibi özel verileri `sys_medical_specialties` içindeki şemaya uygun olmayan ancak `specialty_data` kolonuna yazılacak bir JSON formatında (key-value) oluşturun.
4. **Tarihler:** Tüm tarihler geçmişe dönük olmalı, bugünün tarihini geçmemelidir (Şubat 2026'ya kadar).
5. **Klinik ID:** Tüm kayıtlarda `clinic_id = 2` kullanılmalıdır.

Bu senaryo, uygulamanın hasta takip, laboratuvar sonuç görüntüleme, reçete geçmişi ve finansal raporlama ekranlarını dolu dolu gösterecektir.