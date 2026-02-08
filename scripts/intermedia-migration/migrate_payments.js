/**
 * Pozitif Klinik - Ödeme Verileri Aktarım Scripti (Extract)
 * 
 * Eski MSSQL sisteminden ödeme (tahsilat) verilerini çeker ve JSON olarak kaydeder.
 * 
 * Kullanım:
 *   node scripts/migrate_payments.js
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// MSSQL Config (Eski Sistem)
const { getSourceConfig } = require('./db.helper');
const mssqlConfig = getSourceConfig();

const CLINIC_ID = 1;
const OUTPUT_FILE = path.resolve(__dirname, '../../docs/payments_data.json');

class PaymentMigrator {
    constructor() {
        this.mssqlPool = null;
    }

    async connect() {
        console.log('MSSQL bağlantısı kuruluyor...');
        this.mssqlPool = await sql.connect(mssqlConfig);
        console.log('MSSQL bağlantısı başarılı.');
    }

    async disconnect() {
        if (this.mssqlPool) {
            await this.mssqlPool.close();
            console.log('MSSQL bağlantısı kapatıldı.');
        }
    }

    async extractPayments() {
        console.log('\n--- ÖDEMELER (TAHSİLATLAR) ---');

        // NOT: Kolon isimleri tahmini olarak yazılmıştır.
        // Gerçek veritabanında HST_ODEMELER tablosunun şemasına göre düzenlenmelidir.
        // Olası kolonlar: ID, HASTANO, TARIH, TUTAR, ODEMETIPI, ACIKLAMA, ...
        const query = `
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
            ORDER BY o.TARIH DESC
        `;

        try {
            const result = await this.mssqlPool.request().query(query);

            const payments = result.recordset.map(row => ({
                legacy_id: row.ODEMENO,
                patient_legacy_id: row.HASTANO,
                appointment_legacy_id: row.GELISNO || null,
                amount: parseFloat(row.MIKTAR) || 0,
                payment_date: row.TARIH ? new Date(row.TARIH).toISOString().slice(0, 19).replace('T', ' ') : null,
                payment_type: this.mapPaymentType(row.ODEMETURU),
                notes: row.NOTLAR || null,
                status: row.IPTAL ? 'cancelled' : 'completed'
            }));

            console.log(`${payments.length} ödeme kaydı bulundu.`);
            return payments;
        } catch (err) {
            console.warn('HST_ODEMELER tablosu okunamadı veya bulunamadı:', err.message);
            return [];
        }
    }

    mapPaymentType(typeCode) {
        // Eski sistem kodlarına göre mapping (Tahmini)
        switch (String(typeCode)) {
            case '1': return 'credit_card';
            case '2': return 'bank_transfer';
            default: return 'cash';
        }
    }

    async run() {
        await this.connect();
        try {
            const payments = await this.extractPayments();

            const data = {
                clinic_id: CLINIC_ID,
                extracted_at: new Date().toISOString(),
                payments: payments
            };

            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
            console.log(`Veriler kaydedildi: ${OUTPUT_FILE}`);
        } finally {
            await this.disconnect();
        }
    }
}

const migrator = new PaymentMigrator();
migrator.run().catch(console.error);
