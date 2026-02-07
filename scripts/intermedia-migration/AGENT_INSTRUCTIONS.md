# Yardimci Ajan Arastirma Talimati (Intermedia)

## Amac
Intermedia kaynakli veri aktarimi icin dogru calistirma sirasini belirlemek. Ajan, mevcut dokumani ve scriptleri inceleyip rapor uretmelidir.

## Incelenecek Belgeler
- scripts/intermedia-migration/INTERMEDIA_MIGRATION.md
- scripts/intermedia-migration/README.md

## Incelenecek Script Dizini
- scripts/intermedia-migration/
- scripts/intermedia-migration/migration/

Not: non-migration altindaki kontroller ve arastirma araclari aktarim sirasi listesine dahil edilmeyecek.

## Ajanin Cikisi (Rapor Formati)
Ajan su formatta rapor cikarmali:

1) Onerilen aktarim sirasi (1..N)
- Her adim icin: script adi, kisa amac, bagimliliklar (once calismasi gerekenler), opsiyonel mi?

2) Gerekce ve bagimliliklar
- Neden bu sirada calistirilmasi gerekiyor?
- Hangi tablolar veya foreign key baglari etkileniyor?

3) Degerlendirme / Riskler
- Muhtemel eksik veri riskleri
- Tekrar calistirma durumunda idempotency/duplicate riskleri

4) Kontrol / Dogrulama onerileri
- Aktarim sonrasi hangi kontrol scriptleri (non-migration/checks) calistirilabilir?

## Dikkat Edilecek Ozel Notlar
- Intermedia tarafindan gelen LABORATUVAR/RADYOLOJI verileri birlesik olarak cln_examinations.lab_result_text alanina aktariliyor.
- merge_specialty_data.js bu birlestirme isini yapiyor.
- cln_examinations kaydi varsa COALESCE ile guncelleme yapiyor; yoksa yeni kayit aciyor.

## Beklenen Sonuc
- Ajanin raporu, dogru veri aktarimi icin calistirma sirasini netlestirmeli.
- Rapor net ve uygulanabilir olmali; adimlari dogrudan calistirabilir sekilde listelemeli.

