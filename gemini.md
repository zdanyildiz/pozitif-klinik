# YZ AJANI KIRMIZI ÇİZGİLERİ VE TALİMATLARI

Bu dosya, bu oturumda yapılan hatalardan ders çıkarılarak oluşturulmuştur. Bir YZ ajanı bu kurallara kayıtsız şartsız uymalıdır.

## BUNLAR ASLA YAPILMAMALIDIR (KRİTİK HATALAR)

1. **İZİNSİZ DB DEĞİŞİKLİĞİ**: Kullanıcıdan açık onay almadan asla `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE` veya `ADD COLUMN` gibi veritabanı şemasını değiştiren komutlar çalıştırılmamalıdır.
2. **İZİNSİZ MASTER SQL GÜNCELLEMESİ**: `migration/` altındaki master SQL dosyaları, kullanıcı onayı olmadan kodun içine gömülü değişiklikleri yansıtacak şekilde güncellenmemelidir.
3. **VARSAYIMDA BULUNMAK**: Sistemin multi-tenant yapısı veya iş akışları hakkında varsayımlarda bulunup "en doğrusu budur" diyerek iş yapılmamalıdır. Her radikal değişiklikte (Örn: Tanı listesinin global mi yoksa klinik bazlı mı olacağı) kullanıcıya danışılmalıdır.
4. **GİZLİ İŞLEM YAPMAK**: Arka planda terminalden veritabanı manipülasyonu yapıp bunu kullanıcıya ancak soru sorulduğunda açıklamak kabul edilemez.
5. **SAHTE VERİ EKLEME**: Sisteme mock (sahte) veri girişi yapmadan önce kullanıcı uyarılmalı ve veri kaynağı (Örn: ICD-10 listesi) hakkında bilgi verilmelidir.

## GÖREVE BAŞLAMADAN ÖNCE İNCELENMESİ GEREKENLER

Bir YZ ajanı projeye başladığında sırasıyla şunları incelemelidir:

1. **`.env` Dosyası**: Veritabanı bağlantısı, API anahtarları ve global çalışma ortamı.
2. **`docs/` Dizini**: 
   - `EKSIK_TABLOLAR.md`: Mevcut olmayan ama planlanan yapılar.
   - `EKSIK_SAYFALAR_VE_MODULLER.md`: Projenin yol haritası.
   - `VERI_ANALIZ_RAPORU.md`: Veri yapısı ve ilişkileri.
3. **`migration/database/`**: Veritabanı şeması ve modüllerin (sys_, ptn_, cln_) nasıl ayrıldığı.
4. **Mevcut Kod Standartları**:
   - `src/Core/BaseController.php`: API yanıt standartları.
   - `src/Middleware/`: Güvenlik ve Tenant yönetimi mantığı.
   - `src/Domain/`: Mevcut repository ve controller desenleri.

## YAZILIM KURALLARI VE STANDARTLAR

1. **Multi-Tenancy İzolasyonu**: Her türlü veri işlemi `clinic_id` (tenant_id) üzerinden filtrelenmelidir. Global tablolar (`sys_`) okunabilir ancak klinik verileri (`cln_`) asla birbirine karışmamalıdır.
2. **PSR Uyumluluğu**: Kod yazımı PSR standartlarına (adlandırma, namespace yapısı) uygun olmalıdır.
3. **Güvenlik**: Hassas verilere erişen tüm endpointler `TenantMiddleware` veya ilgili auth katmanı ile korunmalıdır.
4. **Loglama**: Yapılan her kritik işlem `LoggerService` üzerinden, özellikle klinik özelinde loglanmalıdır.
5. **Geri Dönülebilirlik**: Herhangi bir şema değişikliği teklif edildiğinde, bunun `rollback` planı hazır olmalıdır.
