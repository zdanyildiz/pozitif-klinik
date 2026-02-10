/**
 * Pozitif Klinik - Ödeme Verileri Aktarım Scripti
 * 
 * Eski MSSQL sisteminden ödeme (tahsilat) verilerini çeker ve MySQL'e yükler.
 * 
 * Kullanım:
 *   node migrate_payments.js --clinic=1
 */

const sql = require('mssql');
const mysql = require('mysql2/promise');
const path = require('path');

const { getSourceConfig, getTargetConfig } = require('./core/db.helper');
const { parseClinicId } = require('./core/cli.helper');

const mssqlConfig = { ...getSourceConfig(), requestTimeout: 120000 };
const mysqlConfig = { ...getTargetConfig(), connectTimeout: 60000 };
const CLINIC_ID = parseClinicId();

function mapPaymentType(typeCode) {
    switch (String(typeCode)) {
        case '1': return 'credit_card';
        case '2': return 'bank_transfer';
        default: return 'cash';
    }
}

async function main() {
    console.log('Veritabanlarına bağlanılıyor...');
    const mssqlPool = await sql.connect(mssqlConfig);
    const mysqlConn = await mysql.createConnection(mysqlConfig);
    console.log('Bağlantı başarılı.');

    try {
        // 1. Patient ve Appointment map'lerini yükle
        console.log('Eşleşmeler yükleniyor...');
        const [patientRows] = await mysqlConn.query(
            'SELECT id, legacy_id FROM ptn_cards WHERE clinic_id = ? AND legacy_id IS NOT NULL', [CLINIC_ID]
        );
        const patientMap = new Map(patientRows.map(r => [r.legacy_id, r.id]));

        const [apptRows] = await mysqlConn.query(
            'SELECT id, legacy_visit_id FROM cln_appointments WHERE clinic_id = ? AND legacy_visit_id IS NOT NULL', [CLINIC_ID]
        );
        const appointmentMap = new Map(apptRows.map(r => [r.legacy_visit_id, r.id]));
        console.log(`  ${patientMap.size} hasta, ${appointmentMap.size} randevu eşleşmesi yüklendi.`);

        // 2. Mevcut ödemeleri kontrol et (tekrar aktarımı engelle)
        const [existingPayments] = await mysqlConn.query(
            'SELECT legacy_id FROM cln_payments WHERE clinic_id = ? AND legacy_id IS NOT NULL', [CLINIC_ID]
        );
        const existingSet = new Set(existingPayments.map(r => r.legacy_id));
        console.log(`  ${existingSet.size} mevcut ödeme kaydı atlanacak.`);

        // 3. MSSQL'den ödemeleri çek
        console.log('\nMSSQL\'den ödemeler çekiliyor...');
        const result = await mssqlPool.request().query(`
            SELECT 
                o.ODEMENO,
                g.HASTANO,
                o.GELISNO,
                o.TARIH,
                o.MIKTAR,
                o.ODEMETURU,
                o.NOTLAR,
                o.IPTAL
            FROM HST_ODEMELER o
            LEFT JOIN HST_GELISLER g ON o.GELISNO = g.GELISNO
            ORDER BY o.TARIH
        `);
        console.log(`${result.recordset.length} ödeme kaydı bulundu.`);

        // 4. MySQL'e yükle
        let inserted = 0;
        let skippedNoPatient = 0;
        let skippedExisting = 0;
        const batchSize = 500;
        const values = [];

        for (const row of result.recordset) {
            // Zaten aktarılmış mı?
            if (existingSet.has(row.ODEMENO)) {
                skippedExisting++;
                continue;
            }

            // Hasta eşleşmesi var mı?
            const patientId = patientMap.get(row.HASTANO);
            if (!patientId) {
                skippedNoPatient++;
                continue;
            }

            const appointmentId = appointmentMap.get(row.GELISNO) || null;
            const paymentDate = row.TARIH
                ? new Date(row.TARIH).toISOString().slice(0, 19).replace('T', ' ')
                : '1970-01-01 00:00:00';

            values.push([
                CLINIC_ID,
                patientId,
                appointmentId,
                mapPaymentType(row.ODEMETURU),
                parseFloat(row.MIKTAR) || 0,
                'TRY',
                paymentDate,
                row.NOTLAR || null,
                row.IPTAL ? 'cancelled' : 'completed',
                row.ODEMENO
            ]);
        }

        // Batch insert
        for (let i = 0; i < values.length; i += batchSize) {
            const batch = values.slice(i, i + batchSize);
            await mysqlConn.query(
                `INSERT INTO cln_payments 
                (clinic_id, patient_id, appointment_id, payment_type, amount, currency, payment_date, notes, status, legacy_id) 
                VALUES ?`,
                [batch]
            );
            inserted += batch.length;
        }

        console.log(`\n--- Ödeme Aktarım Özeti ---`);
        console.log(`Toplam Kaynak: ${result.recordset.length}`);
        console.log(`Başarılı Insert: ${inserted}`);
        console.log(`Atlanan (Mevcut): ${skippedExisting}`);
        console.log(`Atlanan (Hasta Yok): ${skippedNoPatient}`);

    } catch (err) {
        console.error('\n❌ HATA:', err);
        throw err;
    } finally {
        await mssqlPool.close();
        await mysqlConn.end();
    }
}

main().catch(err => { console.error(err); process.exit(1); });
