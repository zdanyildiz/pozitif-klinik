/**
 * Pozitif Klinik - Birleşik Migration Orkestratörü (Final Optimized)
 * 
 * GÜNCELLEME: merge_specialty_data adımı kaldırıldı. 
 * Veriler artık extraction aşamasında birleştirilip loading aşamasında şifreli yazılıyor.
 */

const { execSync } = require('child_process');
const path = require('path');

// CLI'dan klinik ID al: node run.js --clinic=1
const args = process.argv.slice(2);
const clinicArg = args.find(a => a.startsWith('--clinic='));
const CLINIC_ID = clinicArg ? parseInt(clinicArg.split('=')[1]) : 1;

const steps = [
    {
        name: 'Şube Migrasyonu',
        desc: 'MSSQL SUBE verilerini sys_tenants tablosuna aktarır.',
        command: `node migrate_tenants.js`
    },
    {
        name: 'MSSQL Veri Çıkarma (Extraction)',
        desc: 'MSSQL verilerini okur, tüm branşları birleştirir ve JSON dosyasına kaydeder.',
        command: `node extraction/extract_mssql.js --clinic=${CLINIC_ID}`
    },
    {
        name: 'MySQL Veri Yükleme (Loading)',
        desc: 'JSON verilerini şifreli (AES-256) ve indeksli şekilde MySQL\'e aktarır.',
        command: `node loading/load_mysql.js --clinic=${CLINIC_ID}`
    },
    {
        name: 'Uzmanlık Kategorizasyonu',
        desc: 'Muayene kayıtlarını branş kodlarına göre işaretler.',
        command: `node categorize_specialty.js --clinic=${CLINIC_ID}`
    },
    {
        name: 'Laboratuvar Metadata',
        desc: 'Lab test tanımlarını ve referans aralıklarını aktarır.',
        command: `node migrate_lab_metadata.js --clinic=${CLINIC_ID}`
    },
    {
        name: 'Laboratuvar Sonuçları',
        desc: 'Detaylı laboratuvar sonuçlarını aktarır.',
        command: `node migrate_lab_data.js --clinic=${CLINIC_ID}`
    },
    {
        name: 'Ödeme Migrasyonu',
        desc: 'Finansal kayıtları ve ödemeleri aktarır.',
        command: `node migrate_payments.js --clinic=${CLINIC_ID}`
    },
    {
        name: 'Activity Logs Migrasyonu',
        desc: 'Sistem loglarını aktarır.',
        command: `node migrate_activity_logs.js --clinic=${CLINIC_ID}`
    }
];

console.log('══════════════════════════════════════════════════');
console.log('  INTERMEDIA → POZİTİF KLİNİK GÜVENLİ MİGRASYON');
console.log('══════════════════════════════════════════════════');
console.log(`  📍 Klinik ID:    ${CLINIC_ID}`);
console.log(`  📊 Toplam Adım:  ${steps.length}`);
console.log(`  🕑 Başlangıç:    ${new Date().toLocaleString('tr-TR')}`);
console.log('══════════════════════════════════════════════════\n');

const startTime = Date.now();

steps.forEach((step, index) => {
    console.log(`──────────────────────────────────────────────────`);
    console.log(`  [${index + 1}/${steps.length}] ${step.name}`);
    console.log(`  ${step.desc}`);
    console.log(`  $ ${step.command}`);
    console.log(`  ⏱  ${new Date().toLocaleTimeString('tr-TR')}`);
    console.log(`──────────────────────────────────────────────────`);

    try {
        const startStep = Date.now();
        execSync(step.command, { stdio: 'inherit', cwd: __dirname });
        const elapsed = ((Date.now() - startStep) / 1000).toFixed(1);
        console.log(`\n  ✅ BAŞARILI (${elapsed}s)\n`);
    } catch (err) {
        console.error(`\n  ❌ HATA: Step "${step.name}" başarısız oldu.`);
        process.exit(1);
    }
});

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log('══════════════════════════════════════════════════');
console.log('  MİGRASYON TAMAMLANDI');
console.log('══════════════════════════════════════════════════');
console.log(`  Toplam Süre: ${totalElapsed}s`);
console.log(`  Bitiş: ${new Date().toLocaleString('tr-TR')}`);
console.log('══════════════════════════════════════════════════');
