# Demo Veri Oluşturma Scriptleri

Bu klasör, Pozitif Klinik projesi için test ve demo verileri oluşturan araçları içerir.

## `create_demo_data.php`

Bu script, `docs/hasta.md` dosyasında belirtilen detaylı hasta senaryosunu (Kronik Takipli Hasta: Mehmet Özdemir) veritabanına işler.

### Özellikler
* **Doktorlar:** Gerekli branşlardaki (Dahiliye, Göz, Kardiyoloji vb.) doktor hesaplarını oluşturur.
* **Hasta Kartı:** KVKK uyumlu, şifreli hasta kartı oluşturur veya günceller.
* **Ziyaret Geçmişi:** 1 yıl geriye dönük 10 adet farklı senaryoyu (Muayene, Lab, Reçete, Konsültasyon, Acil, İptal) işler.
* **Finans:** Her işlem için ilgili ödeme kaydını (Nakit/Kredi Kartı) oluşturur.
* **Laboratuvar:** Detaylı kan tahlili sonuçlarını (Anormal değerler dahil) sisteme girer.

### Kullanım

Proje kök dizininde aşağıdaki komutu çalıştırın:

```bash
# XAMPP kullanıyorsanız (Önerilen)
/opt/lampp/bin/php scripts/demo/create_demo_data.php

# Veya sistem PHP'si (Eğer driverlar yüklü ise)
php scripts/demo/create_demo_data.php
```

### Uyarılar
* Script her çalıştırıldığında aynı hastayı (TC No üzerinden) bulup günceller. 
* Randevular mükerrer eklenebilir (Script şu an için önceki randevuları silmez, sadece üzerine ekler). Temiz bir başlangıç için veritabanını sıfırlamak veya `cln_appointments` tablosunu temizlemek isteyebilirsiniz.
