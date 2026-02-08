/*
 * INTERMEDIA MIGRATION ORCHESTRATION SCRIPT
 * 
 * Bu script, Intermedia migrasyon sürecindeki tüm adımları tanımlı sıraya göre çalıştırır.
 * Referans: scripts/intermedia-migration/INTERMEDIA_MIGRATION_REPORT.md
 * 
 * Kullanım:
 * node scripts/intermedia-migration/run_migration_orchestration.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Scriptlerin bulunduğu kök dizin
const MIGRATION_ROOT = __dirname;

const steps = [
    /*
        // 1. Şube Migrasyonu
        {
            name: '1. Şube Migrasyonu (migrate_tenants.js)',
            command: 'node migrate_tenants.js',
            description: 'MSSQL SUBE verilerini sys_tenants tablosuna aktarır.'
        },
        // 2. Şema Hazırlığı
        {
            name: '2. MySQL Şema Hazırlığı (prepare_mysql_schema.js)',
            command: 'node migration/prepare_mysql_schema.js',
            description: 'Legacy sütunları (legacy_id, legacy_visit_id) hazırlar.'
        },
        // 3. Veri Çıkarma
        {
            name: '3. MSSQL Veri Çıkarma (extract_mssql.js)',
            command: 'node migration/extract_mssql.js',
            description: 'MSSQL verilerini okur ve json dosyasına kaydeder.'
        },
    */
    // 4. Veri Yükleme
    {
        name: '4. MySQL Veri Yükleme (load_mysql.js)',
        command: 'node migration/load_mysql.js',
        description: 'JSON verilerini MySQL veritabanına yükler.'
    },
    // 5. Branş Verileri
    {
        name: '5. Branş Verileri Birleştirme (merge_specialty_data.js)',
        command: 'node merge_specialty_data.js',
        description: 'Laboratuvar ve Radyoloji metinlerini birleştirir, muayene notlarını aktarır.'
    },
    // 6. Uzmanlık Kategorizasyonu
    {
        name: '6. Uzmanlık Kategorizasyonu (categorize_specialty.js)',
        command: 'node categorize_specialty.js',
        description: 'Muayene kayıtlarını branş kodlarına göre işaretler.'
    },
    // 7. Laboratuvar Tanımları
    {
        name: '7. Laboratuvar Metadata (migrate_lab_metadata.js)',
        command: 'node migrate_lab_metadata.js',
        description: 'Laboratuvar test tanımlarını ve referans aralıklarını aktarır.'
    },
    // 8. Laboratuvar Sonuçları
    {
        name: '8. Laboratuvar Sonuçları (migrate_lab_data.js)',
        command: 'node migrate_lab_data.js',
        description: 'Detaylı laboratuvar sonuçlarını aktarır.'
    },
    // 9. Dosyalar
    {
        name: '9. Dosya Migrasyonu (migrate_files.js)',
        command: 'node migrate_files.js',
        description: 'Hasta dosyalarını ve radyoloji raporlarını aktarır.'
    },
    // 10. Ödeme Migrasyonu
    {
        name: '10. Ödeme Migrasyonu (migrate_payments.js)',
        command: 'node migrate_payments.js',
        description: 'Finansal kayıtları ve ödemeleri aktarır. (batch: 500)'
    },
    // 11. Blind Index (Arama Endeksi)
    {
        name: '11. Blind Index Migrasyonu (migrate_blind_index.php)',
        command: 'DB_HOST=127.0.0.1 DB_NAME=test_klinik /opt/lampp/bin/php migrate_blind_index.php',
        description: 'Şifreli hasta verileri için arama endekslerini oluşturur.'
    },
    // 12. Legacy Table Map
    {
        name: '12. Legacy Table Mapping (seed_legacy_table_map.js)',
        command: 'node migration/seed_legacy_table_map.js',
        description: 'Legacy tablo eşleşmelerini (map_legacy_tables) oluşturur.'
    },
    // 13. Activity Logs
    {
        name: '13. Activity Logs Migrasyonu (migrate_activity_logs.js)',
        command: 'node migrate_activity_logs.js',
        description: 'GENELLOG ve LOG_KAYITDEGISIKLIGI kayıtlarını cln_activity_logs tablosuna aktarır.'
    },
    // 14. Data Access Logs
    {
        name: '14. Data Access Logs Migrasyonu (migrate_data_access_logs.js)',
        command: 'node migrate_data_access_logs.js',
        description: 'Kullanici_Log_KayitErisim kayıtlarını cln_data_access_logs tablosuna aktarır.'
    },
    // 15. Consent Logs
    {
        name: '15. Consent Logs Migrasyonu (migrate_consent_logs.js)',
        command: 'node migrate_consent_logs.js',
        description: 'Gizlilik onam loglarını ptn_consent_logs tablosuna aktarır.'
    },
    // 16. SMS/Email Logs
    {
        name: '16. Message Logs Migrasyonu (migrate_message_logs.js)',
        command: 'node migrate_message_logs.js',
        description: 'SMS ve Email loglarını sys_sms_logs ve sys_email_logs tablolarına aktarır.'
    }
];

console.log('==================================================');
console.log('INTERMEDIA MIGRATION ORCHESTRATION');
console.log('Referans: INTERMEDIA_MIGRATION_REPORT.md');
console.log('==================================================');
console.log(`Toplam Adım Sayısı: ${steps.length}`);

for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n--------------------------------------------------`);
    console.log(`[ADIM ${i + 1}/${steps.length}] ${step.name}`);
    console.log(`Açıklama: ${step.description}`);
    console.log(`Komut: ${step.command}`);
    console.log(`Başlangıç: ${new Date().toLocaleTimeString()}`);
    console.log(`--------------------------------------------------\n`);

    try {
        // child_process.execSync ile komutu çalıştırıyoruz.
        // cwd: MIGRATION_ROOT, scriptlerin doğru dizinde çalışmasını sağlar.
        const output = execSync(step.command, {
            stdio: 'inherit',
            cwd: MIGRATION_ROOT,
            timeout: 600000 // 10 dakika maksimum çalışma süresi
        });

        console.log(`\n>>> BAŞARILI: ${step.name} tamamlandı.`);
        console.log(`    Bitiş: ${new Date().toLocaleTimeString()}`);
    } catch (error) {
        console.error(`\n!!! HATA !!!`);
        console.error(`"${step.name}" adımı başarısız oldu.`);
        console.error(`Hata Kodu: ${error.status || 'bilinmiyor'}`);
        if (error.signal) {
            console.error(`Sinyal: ${error.signal}`);
        }
        if (error.stderr) {
            console.error(`Hata Detayı: ${error.stderr.toString()}`);
        }
        console.error(`\nMigration süreci durduruldu. Lütfen hatayı düzeltip tekrar çalıştırın.`);
        console.error(`Önceki başarılı adımlar tekrar çalıştırılabilir (idempotent scriptler için).`);
        process.exit(1);
    }
}

console.log('\n==================================================');
console.log(`TÜM MİGRASYON İŞLEMLERİ BAŞARIYLA TAMAMLANDI.`);
console.log(`Bitiş: ${new Date().toLocaleString()}`);
console.log('==================================================');
