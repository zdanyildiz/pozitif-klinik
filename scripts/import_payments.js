/**
 * Pozitif Klinik - Ödeme Verileri İçe Aktarım Scripti (Import)
 * 
 * payments_data.json dosyasındaki verileri cln_payments tablosuna aktarır.
 * 
 * Kullanım:
 *   node scripts/import_payments.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pozitif_klinik'
};

const INPUT_FILE = '/home/zafer/htdocs/pozitif-klinik/docs/payments_data.json';

async function main() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Veri dosyası bulunamadı: ${INPUT_FILE}`);
        console.error('Önce "node scripts/migrate_payments.js" çalıştırın.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    const CLINIC_ID = data.clinic_id;

    const conn = await mysql.createConnection(dbConfig);
    console.log('MySQL veritabanına bağlanıldı.');

    try {
        console.log('Mevcut ödeme verileri temizleniyor...');
        await conn.query('DELETE FROM cln_payments WHERE clinic_id = ?', [CLINIC_ID]);

        console.log('Ödemeler aktarılıyor...');

        // Önce hasta ve randevu mapping'leri için lookup yapılması gerekebilir
        // Ancak legacy_id'leri cln_payments tablosunda tuttuğumuz için
        // doğrudan legacy_id üzerinden eşleştirme yapabiliriz veya
        // ptn_cards ve cln_appointments tablolarından yeni ID'leri çekebiliriz.

        // Basitlik adına, önce legacy map'leri çekelim
        console.log('Mapping verileri hazırlanıyor...');

        // Hastalar
        const [patients] = await conn.query('SELECT id, legacy_id FROM ptn_cards WHERE clinic_id = ?', [CLINIC_ID]);
        const patientMap = new Map();
        patients.forEach(p => patientMap.set(Number(p.legacy_id), p.id));

        // Randevular
        const [appointments] = await conn.query('SELECT id, legacy_visit_id FROM cln_appointments WHERE clinic_id = ?', [CLINIC_ID]);
        const appointmentMap = new Map();
        appointments.forEach(a => {
            if (a.legacy_visit_id) appointmentMap.set(Number(a.legacy_visit_id), a.id);
        });

        let insertedCount = 0;
        let skippedCount = 0;

        for (const p of data.payments) {
            const newPatientId = patientMap.get(Number(p.patient_legacy_id));

            if (!newPatientId) {
                console.warn(`Hasta bulunamadı (Legacy ID: ${p.patient_legacy_id}). Ödeme atlanıyor.`);
                skippedCount++;
                continue;
            }

            const newAppointmentId = p.appointment_legacy_id ? appointmentMap.get(Number(p.appointment_legacy_id)) : null;

            await conn.query(
                `INSERT INTO cln_payments (
                    clinic_id, patient_id, appointment_id, 
                    payment_type, amount, payment_date, 
                    notes, status, legacy_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    CLINIC_ID,
                    newPatientId,
                    newAppointmentId,
                    p.payment_type,
                    p.amount,
                    p.payment_date,
                    p.notes,
                    p.status,
                    p.legacy_id
                ]
            );
            insertedCount++;
        }

        console.log(`\nAktarım tamamlandı.`);
        console.log(`Eklenen: ${insertedCount}`);
        console.log(`Atlanan: ${skippedCount}`);

    } catch (err) {
        console.error('Hata:', err);
    } finally {
        await conn.end();
    }
}

main().catch(console.error);
