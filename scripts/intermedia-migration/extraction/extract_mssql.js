/**
 * Pozitif Klinik - Klinik Bazlı Veri Çıkarma Scripti (Extraction)
 * 
 * Verileri parça parça çekip AYRI JSON dosyalarına yazar.
 * Amaç: Bellek (RAM) kullanımını minimize etmek ve büyük verileri yönetmek.
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Config
const { getSourceConfig } = require('../core/db.helper');
const mssqlConfig = {
    ...getSourceConfig(),
    requestTimeout: 300000 // 5 dakika
};

// CLI'dan klinik ID al: node extract_mssql.js --clinic=1
const args = process.argv.slice(2);
const clinicArg = args.find(a => a.startsWith('--clinic='));
const CLINIC_ID = clinicArg ? parseInt(clinicArg.split('=')[1]) : 1;

if (isNaN(CLINIC_ID)) {
    console.error('HATA: Geçerli bir --clinic=ID parametresi belirtilmelidir.');
    process.exit(1);
}

class DataMigrator {
    constructor() {
        this.mssqlPool = null;
        this.dataDir = path.resolve(__dirname, '..', 'data');
        if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir);

        // Shared ID lists for filtering subsequent queries
        this.context = {
            patientIds: [],
            doctorIds: [],
            visitIds: []
        };
    }

    async connect() {
        console.log(`\nMSSQL bağlantısı kuruluyor (${mssqlConfig.server})...`);
        this.mssqlPool = await sql.connect(mssqlConfig);
        console.log('MSSQL bağlantısı başarılı.');
    }

    async disconnect() {
        if (this.mssqlPool) {
            await this.mssqlPool.close();
            console.log('\nMSSQL bağlantısı kapatıldı.');
        }
    }

    saveToFile(filename, data) {
        const filePath = path.resolve(this.dataDir, `clinic_${CLINIC_ID}_${filename}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`✅ KAYDEDİLDİ: ${path.basename(filePath)} (${data.length} kayıt)`);

        // Force GC hint (not guaranteed but helps)
        data = null;
    }

    async extract() {
        await this.connect();

        try {
            // 1. Randevular (Ana filtre burada: SUBE_ID)
            console.log(`\n--- [1/6] RANDEVULAR (SUBE_ID: ${CLINIC_ID}) ---`);
            const apptResult = await this.mssqlPool.request()
                .input('subeid', sql.Int, CLINIC_ID)
                .query(`
                    SELECT GELISNO, PROTOKOLNO, HASTANO, DOKTOR_ID, TARIH, IPTAL 
                    FROM HST_GELISLER 
                    WHERE SUBE_ID = @subeid
                `);

            const appointments = apptResult.recordset.map(row => ({
                legacy_visit_id: row.GELISNO,
                protocol_no: row.PROTOKOLNO || null,
                patient_legacy_id: row.HASTANO,
                doctor_legacy_id: row.DOKTOR_ID,
                appointment_date: row.TARIH ? new Date(row.TARIH).toISOString().slice(0, 19).replace('T', ' ') : null,
                status: row.IPTAL ? 'cancelled' : 'completed'
            }));

            if (appointments.length === 0) {
                console.warn('⚠️ Bu kliniğe ait randevu bulunamadı. İşlem durduruluyor.');
                return;
            }

            // Context'i doldur (diğer sorgular için gerekli ID'ler)
            this.context.patientIds = Array.from(new Set(appointments.map(a => a.patient_legacy_id)));
            this.context.doctorIds = Array.from(new Set(appointments.map(a => a.doctor_legacy_id).filter(Boolean)));
            this.context.visitIds = appointments.map(a => a.legacy_visit_id);

            this.saveToFile('appointments', appointments);


            // 2. Kullanıcılar (TÜMÜ)
            console.log(`\n--- [2/6] KULLANICILAR (TÜMÜ) ---`);
            const userResult = await this.mssqlPool.request().query(`
                SELECT TAKIPNO, GIRISKODU, ISIMSOYISIM, GOREVNO, UZMANLIK, IPTAL 
                FROM KULLANICILAR
            `);
            const specialtyMap = await this.getSpecialtyMap();

            const users = userResult.recordset.map(row => ({
                legacy_id: row.TAKIPNO,
                username: (row.GIRISKODU || `user_${row.TAKIPNO}`).toLowerCase().substring(0, 50),
                name: row.ISIMSOYISIM || `Kullanıcı ${row.TAKIPNO}`,
                role: this.mapUserRole(row.GOREVNO),
                specialty: this.mapSpecialty(row.UZMANLIK, specialtyMap),
                is_active: row.IPTAL ? 0 : 1
            }));

            this.saveToFile('users', users);


            // 3. Hastalar (Sadece bu klinikte randevusu olanlar)
            console.log(`\n--- [3/6] HASTALAR ---`);
            // Batching patient lookup
            const patientBatchSize = 2000;
            const patients = [];

            for (let i = 0; i < this.context.patientIds.length; i += patientBatchSize) {
                const batchIds = this.context.patientIds.slice(i, i + patientBatchSize);
                const patientResult = await this.mssqlPool.request().query(`
                    SELECT 
                        P.HASTANO, P.AD, P.SOYAD, P.KIMLIKNO, EV_MOBIL, EV_TELEFON, EV_EMAIL,
                        DGMTRH, DOGUMYERI, CINSIYET, KANGRUBU, EV_ADRES1, EV_ADRES2, EV_ADRES_SEMT, 
                        EV_ADRES_ILCE, EV_ADRES_IL, NOTLAR, IPTAL
                    FROM HST_ANADOSYA P
                    WHERE P.HASTANO IN (${batchIds.join(',')})
                `);

                patients.push(...patientResult.recordset.map(row => ({
                    legacy_id: row.HASTANO,
                    name: `${row.AD || ''} ${row.SOYAD || ''}`.trim(),
                    tc_no: row.KIMLIKNO || '',
                    phone: row.EV_MOBIL || row.EV_TELEFON || '',
                    email: row.EV_EMAIL || null,
                    birth_date: row.DGMTRH ? new Date(row.DGMTRH).toISOString().split('T')[0] : null,
                    gender: row.CINSIYET === 'E' ? 'M' : (row.CINSIYET === 'K' ? 'F' : 'U'),
                    blood_type: row.KANGRUBU || null,
                    address: [row.EV_ADRES1, row.EV_ADRES2, row.EV_ADRES_SEMT].filter(Boolean).join(', ') || null,
                    city: row.EV_ADRES_IL || null,
                    district: row.EV_ADRES_ILCE || null,
                    notes: row.NOTLAR || null,
                    status: row.IPTAL ? 0 : 1
                })));
            }

            this.saveToFile('patients', patients);


            // 4. Hizmetler (Tümü)
            console.log(`\n--- [4/6] HİZMETLER ---`);
            const serviceResult = await this.mssqlPool.request().query(`
                SELECT KOD, ACIKLAMA, FIYAT, IPTAL FROM TETKIK WHERE IPTAL = 0
            `);
            const services = serviceResult.recordset.map(row => ({
                legacy_code: String(row.KOD),
                name: row.ACIKLAMA,
                price: row.FIYAT || 0,
                is_active: 1
            }));

            this.saveToFile('services', services);


            // 5. İşlem Kalemleri
            console.log(`\n--- [5/6] İŞLEM KALEMLERİ ---`);
            const itemResult = await this.mssqlPool.request()
                .input('subeid', sql.Int, CLINIC_ID)
                .query(`
                    SELECT i.GELISNO, i.ISLEMNO, i.FIYAT, i.ADET, i.YAPAN, t.ACIKLAMA
                    FROM HST_ISLEMLER i
                    INNER JOIN HST_GELISLER g ON i.GELISNO = g.GELISNO
                    LEFT JOIN TETKIK t ON i.ISLEMNO = t.KOD
                    WHERE g.SUBE_ID = @subeid
                `);

            const items = itemResult.recordset.map(row => ({
                appointment_legacy_id: row.GELISNO,
                service_legacy_code: String(row.ISLEMNO),
                item_name: row.ACIKLAMA || `İşlem ${row.ISLEMNO}`,
                quantity: row.ADET || 1,
                unit_price: row.FIYAT || 0,
                total_price: (row.FIYAT || 0) * (row.ADET || 1),
                performer_legacy_id: row.YAPAN
            }));

            this.saveToFile('appointment_items', items);


            // 6. Muayene Notları (GERİ GELDİ - Pagination ile)
            console.log(`\n--- [6/6] MUAYENE NOTLARI ---`);
            // Notları da parça parça çekip tek dosyaya yazmak yerine,
            // hepsini çekip tek dosyaya yazmak riskli. Bu yüzden `load_mysql.js`
            // artık bu dosyayı STREAM veya PARÇALI okumalı.
            // Şimdilik yine tek seferde çekiyoruz ama SADECE gerekli kolonları.

            const examResult = await this.mssqlPool.request()
                .input('subeid', sql.Int, CLINIC_ID)
                .query(`
                    SELECT t.GELISNO, et.SIKAYETLER, et.HIKAYESI, et.BULGULAR, et.TESHIS, et.TEDAVI, et.SONUC, et.TARIH
                    FROM HST_TIBBI_EPIKRIZ_TAKIP et
                    INNER JOIN HST_TIBBI_EPIKRIZ e ON et.EPIKRIZ_ID = e.ID
                    INNER JOIN HST_TIBBI t ON e.TIBBIDOSYA_ID = t.RECORD_ID
                    INNER JOIN HST_GELISLER g ON t.GELISNO = g.GELISNO
                    WHERE g.SUBE_ID = @subeid
                `);

            const examinations = examResult.recordset.map(row => ({
                legacy_visit_id: row.GELISNO,
                complaint: row.SIKAYETLER || null,
                story: row.HIKAYESI || null,
                bulgular: row.BULGULAR || null,
                diagnosis: row.TESHIS || null,
                treatment: row.TEDAVI || null,
                result_note: row.SONUC || null,
                created_at: row.TARIH ? new Date(row.TARIH).toISOString() : null
            }));

            this.saveToFile('examinations', examinations);

        } catch (err) {
            console.error('\n❌ Extraction Hatası:', err);
            throw err;
        } finally {
            await this.disconnect();
        }
    }

    // Helpers
    async getSpecialtyMap() {
        const res = await this.mssqlPool.request().query('SELECT TAKIPNO, UZMANLIK FROM LST_UZMANLIKDALLARI');
        const map = {};
        res.recordset.forEach(r => map[r.TAKIPNO] = r.UZMANLIK);
        return map;
    }

    mapUserRole(gorevno) {
        if (gorevno === 2) return 'doctor';
        if (gorevno === 16 || gorevno === 11) return 'secretary';
        return 'admin';
    }

    mapSpecialty(id, map) {
        const name = (map[id] || '').toLowerCase();
        if (name.includes('dahiliye')) return 'INTERNAL_MEDICINE';
        if (name.includes('kardiyoloji')) return 'CARDIOLOGY';
        if (name.includes('kadın')) return 'GYNECOLOGY';
        if (name.includes('çocuk')) return 'PEDIATRICS';
        return null;
    }
}

new DataMigrator().extract().catch(() => process.exit(1));
