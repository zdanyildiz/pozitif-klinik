/**
 * Pozitif Klinik - CLI Yardımcı Modülü
 * 
 * Tüm migration scriptleri için ortak CLI parametrelerini ayrıştırır.
 * 
 * Kullanım:
 *   const { CLINIC_ID } = require('./core/cli.helper');
 */

function parseClinicId() {
    const args = process.argv.slice(2);
    const clinicArg = args.find(a => a.startsWith('--clinic='));
    const clinicId = clinicArg ? parseInt(clinicArg.split('=')[1]) : null;

    if (!clinicId || isNaN(clinicId)) {
        const scriptName = require('path').basename(process.argv[1]);
        console.error(`\n❌ HATA: Klinik ID belirtilmedi veya geçersiz!`);
        console.error(`Kullanım: node ${scriptName} --clinic=ID`);
        console.error(`Örnek:    node ${scriptName} --clinic=1\n`);
        process.exit(1);
    }

    return clinicId;
}

function isDryRun() {
    return process.argv.slice(2).includes('--dry-run');
}

module.exports = {
    parseClinicId,
    isDryRun
};
