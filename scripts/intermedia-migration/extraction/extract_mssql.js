/**
 * Pozitif Klinik - Evrensel Veri Çıkarma Scripti (Extraction - Final v2)
 * 
 * GÜNCELLEME: Specialty tablolarından TAVSIYELER kolonu da eklendi.
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Config
const { getSourceConfig } = require('../core/db.helper');
const mssqlConfig = {
    ...getSourceConfig(),
    requestTimeout: 600000 
};

const args = process.argv.slice(2);
const clinicArg = args.find(a => a.startsWith('--clinic='));
const CLINIC_ID = clinicArg ? parseInt(clinicArg.split('=')[1]) : 1;

class DataMigrator {
    constructor() {
        this.mssqlPool = null;
        this.dataDir = path.resolve(__dirname, '..', 'data');
        if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir);
    }

    async connect() {
        this.mssqlPool = await sql.connect(mssqlConfig);
        console.log('MSSQL bağlantısı başarılı.');
    }

    async disconnect() {
        if (this.mssqlPool) await this.mssqlPool.close();
    }

    saveToFile(filename, data) {
        const filePath = path.resolve(this.dataDir, `clinic_${CLINIC_ID}_${filename}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`✅ KAYDEDİLDİ: ${path.basename(filePath)} (${data.length} kayıt)`);
    }

    async extract() {
        await this.connect();

        try {
            // 1. TÜM HASTALAR
            console.log(`\n--- [1/6] TÜM HASTALAR ---`);
            const patientResult = await this.mssqlPool.request().query(`
                SELECT P.* FROM HST_ANADOSYA P WHERE P.IPTAL = 0 OR P.IPTAL IS NULL
            `);
            this.saveToFile('patients', patientResult.recordset.map(row => ({
                legacy_id: row.HASTANO,
                name: `${row.AD || ''} ${row.SOYAD || ''}`.trim(),
                tc_no: row.KIMLIKNO || '',
                phone: row.EV_MOBIL || row.EV_TELEFON || '',
                email: row.EV_EMAIL || null,
                birth_date: row.DGMTRH ? new Date(row.DGMTRH).toISOString().split('T')[0] : null,
                gender: row.CINSIYET === 'E' ? 'M' : (row.CINSIYET === 'K' ? 'F' : 'U'),
                blood_type: row.KANGRUBU || null,
                address: [row.EV_ADRES1, row.EV_ADRES2, row.EV_ADRES_SEMT].filter(Boolean).join(', ') || null,
                city: row.EV_ADRES_IL || null, district: row.EV_ADRES_ILCE || null,
                notes: row.NOTLAR || null, status: 1
            })));

            // 2. RANDEVULAR
            console.log(`\n--- [2/6] RANDEVULAR ---`);
            const apptResult = await this.mssqlPool.request().input('subeid', sql.Int, CLINIC_ID).query(`
                SELECT * FROM HST_GELISLER WHERE SUBE_ID = @subeid
            `);
            this.saveToFile('appointments', apptResult.recordset.map(row => ({
                legacy_visit_id: row.GELISNO, protocol_no: row.PROTOKOLNO || null,
                patient_legacy_id: row.HASTANO, doctor_legacy_id: row.DOKTOR_ID,
                appointment_date: row.TARIH ? new Date(row.TARIH).toISOString().slice(0, 19).replace('T', ' ') : null,
                status: row.IPTAL ? 'cancelled' : 'completed'
            })));

            // 3. KULLANICILAR
            console.log(`\n--- [3/6] KULLANICILAR ---`);
            const userResult = await this.mssqlPool.request().query('SELECT * FROM KULLANICILAR');
            this.saveToFile('users', userResult.recordset.map(row => ({
                legacy_id: row.TAKIPNO, username: (row.GIRISKODU || `user_${row.TAKIPNO}`).toLowerCase(),
                name: row.ISIMSOYISIM || `Kullanıcı ${row.TAKIPNO}`,
                role: row.GOREVNO === 2 ? 'doctor' : (row.GOREVNO === 16 ? 'secretary' : 'admin'),
                is_active: row.IPTAL ? 0 : 1
            })));

            // 4. MUAYENE NOTLARI (DİNAMİK BRANŞ TARAMA)
            console.log(`\n--- [4/6] MUAYENE NOTLARI (TÜM BRANŞLAR) ---`);
            const examsMap = new Map();

            // a) Standart Epikrizler
            const stdExams = await this.mssqlPool.request().input('subeid', sql.Int, CLINIC_ID).query(`
                SELECT t.GELISNO, et.SIKAYETLER, et.HIKAYESI, et.BULGULAR, et.TESHIS, et.TEDAVI, et.SONUC, et.TARIH
                FROM HST_TIBBI_EPIKRIZ_TAKIP et
                INNER JOIN HST_TIBBI_EPIKRIZ e ON et.EPIKRIZ_ID = e.ID
                INNER JOIN HST_TIBBI t ON e.TIBBIDOSYA_ID = t.RECORD_ID
                INNER JOIN HST_GELISLER g ON t.GELISNO = g.GELISNO
                WHERE g.SUBE_ID = @subeid
            `);
            stdExams.recordset.forEach(row => {
                examsMap.set(row.GELISNO, {
                    legacy_visit_id: row.GELISNO, complaint: row.SIKAYETLER, story: row.HIKAYESI,
                    bulgular: row.BULGULAR, diagnosis: row.TESHIS, treatment: row.TEDAVI,
                    result_note: row.SONUC, created_at: row.TARIH
                });
            });

            // b) Tüm UZM_*_HST_ANAMNEZ Tablolarını tara
            const uzmTables = [
                'UZM_ICHASTALIKLARI_HST_ANAMNEZ', 'UZM_FIZIKTEDAVI_HST_ANAMNEZ', 
                'UZM_GOGUSHASTALIKLARI_HST_ANAMNEZ', 'UZM_JINEKO_HST_ANAMNEZ',
                'UZM_KALPDAMARCERRAH_HST_ANAMNEZ', 'UZM_KARDIYO_HST_ANAMNEZ',
                'UZM_KBB_HST_ANAMNEZ', 'UZM_MAPMEDYA_HST_ANAMNEZ',
                'UZM_NOROLOJI_HST_ANAMNEZ', 'UZM_PLASTIKCERRAH_HST_ANAMNEZ',
                'UZM_SPOR_HST_ANAMNEZ'
            ];

            for (const table of uzmTables) {
                console.log(`  > ${table} taranıyor...`);
                const rows = await this.mssqlPool.request().input('subeid', sql.Int, CLINIC_ID).query(`
                    SELECT u.* FROM ${table} u 
                    INNER JOIN HST_GELISLER g ON u.GELISNO = g.GELISNO 
                    WHERE g.SUBE_ID = @subeid
                `);

                rows.recordset.forEach(row => {
                    const existing = examsMap.get(row.GELISNO) || {};
                    
                    // Bulgular kısmına radyoloji, laboratuvar ve fizik muayeneyi ekle
                    const combinedBulgular = [existing.bulgular, row.FIZIKMUA, row.RADYOLOJI, row.LABORATUVAR]
                        .filter(v => v && String(v).trim() !== '').join('\n---\n');
                    
                    // Tedavi kısmına branş tedavisi ve tavsiyeleri ekle
                    const combinedTreatment = [existing.treatment, row.TEDAVI, row.TAVSIYELER]
                        .filter(v => v && String(v).trim() !== '').join('\n---\n');

                    examsMap.set(row.GELISNO, {
                        legacy_visit_id: row.GELISNO,
                        complaint: [existing.complaint, row.SIKAYETLER].filter(v => v && String(v).trim() !== '').join('\n---\n'),
                        story: [existing.story, row.HIKAYESI].filter(v => v && String(v).trim() !== '').join('\n---\n'),
                        bulgular: combinedBulgular || null,
                        diagnosis: [existing.diagnosis, row.TANI].filter(v => v && String(v).trim() !== '').join('\n---\n'),
                        treatment: combinedTreatment || null,
                        result_note: existing.result_note || null,
                        created_at: existing.created_at || null
                    });
                });
            }
            this.saveToFile('examinations', Array.from(examsMap.values()));

            // 5. HİZMETLER VE İŞLEMLER
            console.log(`\n--- [5/6] HİZMETLER VE İŞLEMLER ---`);
            const serviceResult = await this.mssqlPool.request().query('SELECT * FROM TETKIK WHERE IPTAL = 0');
            this.saveToFile('services', serviceResult.recordset.map(r => ({
                legacy_code: String(r.KOD), name: r.ACIKLAMA, price: r.FIYAT || 0, is_active: 1
            })));

            const itemResult = await this.mssqlPool.request().input('subeid', sql.Int, CLINIC_ID).query(`
                SELECT i.*, t.ACIKLAMA FROM HST_ISLEMLER i
                INNER JOIN HST_GELISLER g ON i.GELISNO = g.GELISNO
                LEFT JOIN TETKIK t ON i.ISLEMNO = t.KOD
                WHERE g.SUBE_ID = @subeid
            `);
            this.saveToFile('appointment_items', itemResult.recordset.map(r => ({
                appointment_legacy_id: r.GELISNO, service_legacy_code: String(r.ISLEMNO),
                item_name: r.ACIKLAMA || `İşlem ${r.ISLEMNO}`, quantity: r.ADET || 1,
                unit_price: r.FIYAT || 0, total_price: (r.FIYAT || 0) * (r.ADET || 1)
            })));

        } finally {
            await this.disconnect();
        }
    }
}

new DataMigrator().extract().catch(() => process.exit(1));
