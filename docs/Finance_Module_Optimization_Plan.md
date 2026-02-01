# Finans Modülü İyileştirme ve Optimizasyon Planı

Bu döküman, mevcut finans modülünün kullanıcı deneyimini (UX) artırmak, veri tutarlılığını sağlamak ve raporlama özelliklerini derinleştirmek için yapılacak geliştirmeleri kapsar.

## 1. Veri Gruplama ve Görünüm (UX) İyileştirmeleri
*   **Akıllı İşlem Gruplama:** Dashboard ve İşlem Geçmişi listelerinde, **aynı hasta** tarafından **aynı randevu/gün** içinde yapılan parçalı ödemeler (örn: 2240 TL + 10 TL) tek bir satırda toplam tutar olarak gösterilecek.
*   **Sıralama Mantığı:** İşlemler en güncelden eskiye doğru sıralanacak, ancak gruplanmış kayıtlar tıklandığında alt kırılımları (farklı ödeme tipleri vb.) görülebilecek.

## 2. İşlem Detay Modalı (Hizmet & Ücret Dökümü)
Ödeme satırına tıklandığında açılacak detay modülü şu bilgileri içerecektir:
*   **Hizmet Kalemleri:** Randevu kapsamında alınan tüm hizmetlerin (örn: Botox, Dolgu, Muayene) listesi ve birim fiyatları.
*   **Finansal Özet:**
    *   Toplam Hizmet Bedeli (Borç)
    *   Yapılan Toplam Tahsilat
    *   Kalan Bakiye
*   **Tahsilat Geçmişi:** İlgili randevu için hangi tarihte, hangi ödeme tipiyle ne kadar ödeme yapıldığına dair döküm.

## 3. "Tümü" Sayfası (Gelişmiş Filtreleme ve Arama)
*   **Sunucu Taraflı Sayfalama (SSR Pagination):** Çok sayıda finansal verinin hızlı yüklenmesi için sayfalama yapısı kurulacak.
*   **Dinamik Arama:** Hasta adı, TC No, ödeme tipi veya tarih aralığına göre hızlı filtreleme.
*   **Bağlamsal Geçiş:** İşlem geçmişinden doğrudan ilgili randevuya veya hasta detayına linkleme.

## 4. Dashboard İstatistikleri ve Görselleştirme
*   **Haftalık Hedef Takibi:** `-- %` olarak görünen placeholder yerine, mevcut haftanın cirosunun bir önceki hafta ile kıyaslanması (Artış/Azalış trendi).
*   **Boş Veri (Fallback) Yönetimi:** Bugün hiç işlem yapılmadıysa grafikte "Veri Yok" yerine son 7 günün genel dağılımı veya bilgilendirme kartı gösterilecek.
*   **Randevu Senkronizasyonu:** Ödeme sayfalarındaki verilerin, randevu durumu `Tamamlandı` olan kayıtlarla ve hizmet bedelleriyle tam uyumlu çalışması sağlanacak.

## 5. Uygulama Adımları (Teknik Görevler)

### Faz 1: Repository ve Veri Katmanı
1.  `PaymentRepository::getDetailedTransactions()`: Gruplanmış ve detaylı işlem listesini çeken metodun yazılması.
2.  `PaymentRepository::getTransactionDetailWithServices()`: Bir ödemeye bağlı hizmet bedellerini getiren sorgunun eklenmesi.

### Faz 2: Backend ve API
1.  `FinanceWebController`: Search ve Pagination parametrelerini karşılayacak şekilde güncellenmesi.
2.  `PaymentController`: Detay modülü için gerekli JSON endpoint'inin hazırlanması.

### Faz 3: Frontend (Twig & JS)
1.  `dashboard.twig`: Grafik ve istatistik kartlarının fallback mantığının güncellenmesi.
2.  `transactions.twig`: Filtreleme formu ve paginator eklenmesi.
3.  `payment_detail_modal.twig`: Hizmet dökümünü gösteren yeni bir modal bileşeni.

---
**Durum:** Tamamlandı (Gruplandırma ve Detay Görünümü Stabilize Edildi)
**Bakiye:** Faz 2'ye aktarılanlar: API Tabanlı Dinamik Arama.

---

## 4. Gelecek Geliştirmeler (Faz 2)

### 4.1. API Tabanlı Dinamik Arama (UX)
Şu anki "Live Search" SSR (Sayfa yenileme) ile çalışmaktadır. Daha akışkan bir deneyim için:
- JavaScript `api` instance'ı kullanılarak arka planda veri çekilmelidir.
- Tablo içeriği JavaScript ile (DOM Manipulation veya Template Literal) güncellenmelidir.
- Mevcut `?q=...` içeren URL parametre yapısı korunarak (History API) adres çubuğu güncel tutulmalıdır.

### 4.2. Gelişmiş Raporlama
- Gelir kalemlerinin grafiksel dökümü.
- Doktor bazlı hakediş/ciro raporları.

