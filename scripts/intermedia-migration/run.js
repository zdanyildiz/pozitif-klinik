/**
 * Pozitif Klinik - Birleşik Migration Orkestratörü
 * 
 * Tüm migrasyon adımlarını belirtilen klinik için sırasıyla çalıştırır.
 * Bu script, hangi klasörden çalıştırılırsa çalıştırılsın
 * her zaman kendi bulunduğu dizine göre yolları çözer.
 * 
 * Kullanım:
 *   node scripts/intermedia-migration/run.js --clinic=1
 *   node scripts/intermedia-migration/run.js --clinic=1 --from=5        (5. adımdan başla)
 *   node scripts/intermedia-migration/run.js --clinic=1 --only=3        (sadece 3. adımı çalıştır)
 *   node scripts/intermedia-migration/run.js --clinic=1 --list          (adımları listele)
 * 
 * Referans: MIGRATION_REFACTOR_ANALYSIS.md
 */

const { execSync } = require('child_process');
const path = require('path');

// ─── CLI Arguments ─────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(name) {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    return arg ? arg.split('=')[1] : null;
}

const CLINIC_ID = parseInt(getArg('clinic'));
const FROM_STEP = parseInt(getArg('from')) || 1;
const ONLY_STEP = parseInt(getArg('only')) || null;
const LIST_MODE = args.includes('--list');

if (!CLINIC_ID || isNaN(CLINIC_ID)) {
    console.log('\n❌ HATA: Klinik ID belirtilmedi!');
    console.log('Kullanım: node scripts/intermedia-migration/run.js --clinic=ID');
    console.log('');
    console.log('Seçenekler:');
    console.log('  --clinic=N    Zorunlu. Eski sistemdeki SUBE_ID');
    console.log('  --from=N      N. adımdan başla (devam etmek için)');
    console.log('  --only=N      Sadece N. adımı çalıştır');
    console.log('  --list        Adımları listele, çalıştırma');
    console.log('');
    console.log('Örnek: node scripts/intermedia-migration/run.js --clinic=1');
    process.exit(1);
}

// ─── Step Definitions ──────────────────────────────────────────
// --clinic parametresi her alt scripte iletilir
const C = `--clinic=${CLINIC_ID}`;

const steps = [
    {
        name: 'Şube Migrasyonu',
        command: 'node migrate_tenants.js',
        description: 'MSSQL SUBE verilerini sys_tenants tablosuna aktarır.',
        needsClinic: false // Tüm şubeleri aktarır
    },
    {
        name: 'MSSQL Veri Çıkarma (Extraction)',
        command: `node extraction/extract_mssql.js ${C}`,
        description: 'MSSQL verilerini okur ve JSON dosyasına kaydeder.'
    },
    {
        name: 'MySQL Veri Yükleme (Loading)',
        command: `node loading/load_mysql.js ${C}`,
        description: 'JSON dosyasındaki hastaları, randevuları, muayeneleri MySQL\'e aktarır.'
    },
    {
        name: 'Branş Verileri Birleştirme',
        command: `node merge_specialty_data.js ${C}`,
        description: 'Laboratuvar/Radyoloji metinlerini birleştirir, muayene notlarını aktarır.'
    },
    {
        name: 'Uzmanlık Kategorizasyonu',
        command: `node categorize_specialty.js ${C}`,
        description: 'Muayene kayıtlarını branş kodlarına göre işaretler.'
    },
    {
        name: 'Laboratuvar Metadata',
        command: `node migrate_lab_metadata.js ${C}`,
        description: 'Lab test tanımlarını, referans aralıklarını ve panelleri aktarır.'
    },
    {
        name: 'Laboratuvar Sonuçları',
        command: `node migrate_lab_data.js ${C}`,
        description: 'Detaylı laboratuvar sonuçlarını aktarır.'
    },
    {
        name: 'Dosya Migrasyonu',
        command: `node migrate_files.js ${C}`,
        description: 'Hasta dosyalarını ve radyoloji raporlarını aktarır.'
    },
    {
        name: 'Ödeme Migrasyonu',
        command: `node migrate_payments.js ${C}`,
        description: 'Finansal kayıtları ve ödemeleri aktarır.'
    },
    {
        name: 'ICD-10 Kütüphanesi',
        command: 'node migrate_icd_library.js',
        description: 'ICD-10 tanı kodlarını sys_icd10 tablosuna aktarır.',
        needsClinic: false // Global veri
    },
    {
        name: 'Activity Logs Migrasyonu',
        command: `node migrate_activity_logs.js ${C}`,
        description: 'GENELLOG ve LOG_KAYITDEGISIKLIGI kayıtlarını aktarır.'
    },
    {
        name: 'Data Access Logs Migrasyonu',
        command: `node migrate_data_access_logs.js ${C}`,
        description: 'Kullanici_Log_KayitErisim kayıtlarını aktarır.'
    },
    {
        name: 'Consent Logs Migrasyonu',
        command: `node migrate_consent_logs.js ${C}`,
        description: 'Gizlilik onam loglarını ptn_consent_logs tablosuna aktarır.'
    }
];

// ─── List Mode ─────────────────────────────────────────────────
if (LIST_MODE) {
    console.log(`\n📋 Migrasyon Adımları (Klinik ID: ${CLINIC_ID}):\n`);
    steps.forEach((step, i) => {
        const num = String(i + 1).padStart(2, ' ');
        const clinic = step.needsClinic === false ? '(global)' : `(clinic=${CLINIC_ID})`;
        console.log(`  ${num}. ${step.name} ${clinic}`);
        console.log(`      ${step.description}`);
        console.log(`      $ ${step.command}`);
        console.log('');
    });
    console.log(`Toplam: ${steps.length} adım`);
    process.exit(0);
}

// ─── Execution ─────────────────────────────────────────────────
const MIGRATION_ROOT = __dirname;
const startTime = Date.now();

console.log('');
console.log('══════════════════════════════════════════════════');
console.log('  INTERMEDIA → POZİTİF KLİNİK MİGRASYON');
console.log('══════════════════════════════════════════════════');
console.log(`  📍 Klinik ID:    ${CLINIC_ID}`);
console.log(`  📁 Çalışma Dir:  ${MIGRATION_ROOT}`);
console.log(`  📊 Toplam Adım:  ${steps.length}`);
if (ONLY_STEP) {
    console.log(`  🎯 Sadece Adım:  ${ONLY_STEP}`);
} else if (FROM_STEP > 1) {
    console.log(`  ⏩ Başlangıç:    Adım ${FROM_STEP}`);
}
console.log(`  🕑 Başlangıç:    ${new Date().toLocaleString('tr-TR')}`);
console.log('══════════════════════════════════════════════════');

const results = [];

for (let i = 0; i < steps.length; i++) {
    const stepNum = i + 1;
    const step = steps[i];

    // Skip logic
    if (ONLY_STEP && stepNum !== ONLY_STEP) continue;
    if (!ONLY_STEP && stepNum < FROM_STEP) {
        console.log(`\n⏭  [${stepNum}/${steps.length}] ${step.name} — Atlandı`);
        results.push({ step: stepNum, name: step.name, status: 'skipped' });
        continue;
    }

    console.log(`\n──────────────────────────────────────────────────`);
    console.log(`  [${stepNum}/${steps.length}] ${step.name}`);
    console.log(`  ${step.description}`);
    console.log(`  $ ${step.command}`);
    console.log(`  ⏱  ${new Date().toLocaleTimeString('tr-TR')}`);
    console.log(`──────────────────────────────────────────────────`);

    const stepStart = Date.now();

    try {
        execSync(step.command, {
            stdio: 'inherit',
            cwd: MIGRATION_ROOT,
            timeout: 3600000 // 1 saat max
        });

        const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
        console.log(`\n  ✅ BAŞARILI (${elapsed}s)`);
        results.push({ step: stepNum, name: step.name, status: 'success', elapsed });
    } catch (error) {
        const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
        console.error(`\n  ❌ BAŞARISIZ (${elapsed}s)`);
        console.error(`     Hata Kodu: ${error.status || 'bilinmiyor'}`);
        if (error.signal) console.error(`     Sinyal: ${error.signal}`);

        results.push({ step: stepNum, name: step.name, status: 'failed', elapsed });

        if (ONLY_STEP) {
            process.exit(1);
        }

        console.error(`\n  🛑 Migrasyon durduruldu. Devam etmek için:`);
        console.error(`     node scripts/intermedia-migration/run.js --clinic=${CLINIC_ID} --from=${stepNum}`);
        process.exit(1);
    }
}

// ─── Summary ───────────────────────────────────────────────────
const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('');
console.log('══════════════════════════════════════════════════');
console.log('  MİGRASYON ÖZETİ');
console.log('══════════════════════════════════════════════════');

for (const r of results) {
    const icon = r.status === 'success' ? '✅' : r.status === 'skipped' ? '⏭ ' : '❌';
    const time = r.elapsed ? ` (${r.elapsed}s)` : '';
    console.log(`  ${icon} ${String(r.step).padStart(2)}. ${r.name}${time}`);
}

console.log('──────────────────────────────────────────────────');
console.log(`  Toplam Süre: ${totalElapsed}s`);
console.log(`  Bitiş: ${new Date().toLocaleString('tr-TR')}`);
console.log('══════════════════════════════════════════════════');
