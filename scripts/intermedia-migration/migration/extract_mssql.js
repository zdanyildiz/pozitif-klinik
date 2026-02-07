/**
 * Pozitif Klinik - Veri Aktarım Scripti
 * 
 * Eski MSSQL sisteminden yeni MySQL sistemine veri aktarımı yapar.
 * 
 * Kullanım:
 *   node scripts/migrate_data.js
 * 
 * Önkoşullar:
 *   - MSSQL bağlantısı (eski sistem)
 *   - MySQL bağlantısı (yeni sistem)
 *   - Yeni sistemde tablolar oluşturulmuş olmalı
 */

const sql = require('mssql');

// MSSQL Config (Eski Sistem)
const mssqlConfig = {
    user: 'sa',
    password: '#Global2025*',
    server: 'localhost',
    database: 'ErhanOzel',
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Migration hedef klinik ID (yeni sistemde)
const CLINIC_ID = 1;

// Veri aktarım fonksiyonları
class DataMigrator {
    constructor() {
        this.mssqlPool = null;
        this.stats = {
            users: 0,
            services: 0,
            patients: 0,
            appointments: 0,
            items: 0,
            examinations: 0
        };
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

    // 1. Kullanıcıları Aktarma
    async extractUsers() {
        console.log('\n--- KULLANICILAR ---');
        const result = await this.mssqlPool.request().query(`
            SELECT 
                TAKIPNO,
                GIRISKODU,
                ISIMSOYISIM,
                GOREVNO,
                IPTAL
            FROM KULLANICILAR
            WHERE TAKIPNO > 0
            ORDER BY TAKIPNO
        `);

        const users = result.recordset.map(row => ({
            legacy_id: row.TAKIPNO,
            username: (row.GIRISKODU || `user_${row.TAKIPNO}`).toLowerCase().substring(0, 50),
            name: row.ISIMSOYISIM || `Kullanıcı ${row.TAKIPNO}`,
            role: this.mapUserRole(row.GOREVNO),
            is_active: row.IPTAL ? 0 : 1
        }));

        this.stats.users = users.length;
        console.log(`${users.length} kullanıcı bulundu.`);
        return users;
    }

    mapUserRole(gorevno) {
        // Eski sistemdeki görev numaralarına göre rol eşleştirmesi
        // 2: Doktor, 11: Laboratuvar, 16: Sekreter, 5: Yazılım
        switch (gorevno) {
            case 2: return 'doctor';
            case 16:
            case 11: return 'secretary';
            default: return 'admin';
        }
    }

    // 2. Hizmetleri Aktarma
    async extractServices() {
        console.log('\n--- HİZMETLER ---');
        const result = await this.mssqlPool.request().query(`
            SELECT 
                KOD,
                ACIKLAMA,
                FIYAT,
                BUTFIYATI,
                IPTAL
            FROM TETKIK
            WHERE ACIKLAMA IS NOT NULL AND ACIKLAMA != ''
            ORDER BY KOD
        `);

        const services = result.recordset.map(row => ({
            legacy_code: String(row.KOD),
            name: row.ACIKLAMA,
            price: row.FIYAT || row.BUTFIYATI || 0,
            is_active: row.IPTAL ? 0 : 1
        }));

        this.stats.services = services.length;
        console.log(`${services.length} hizmet bulundu.`);
        return services;
    }

    // 3. Hastaları Aktarma
    async extractPatients() {
        console.log('\n--- HASTALAR ---');
        const result = await this.mssqlPool.request().query(`
            SELECT 
                HASTANO,
                AD,
                SOYAD,
                KIMLIKNO,
                EV_TELEFON,
                EV_MOBIL,
                EV_EMAIL,
                DGMTRH,
                DOGUMYERI,
                CINSIYET,
                KANGRUBU,
                EV_ADRES1,
                EV_ADRES2,
                BABAADI,
                ANNEADI,
                MESLEK,
                NK_UYRUGU,
                NOTLAR,
                IPTAL
            FROM HST_ANADOSYA
            ORDER BY HASTANO
        `);

        const patients = result.recordset.map(row => ({
            legacy_id: row.HASTANO,
            name: `${row.AD || ''} ${row.SOYAD || ''}`.trim() || `Hasta ${row.HASTANO}`,
            tc_no: row.KIMLIKNO || '',
            phone: row.EV_MOBIL || row.EV_TELEFON || '',
            email: row.EV_EMAIL || null,
            birth_date: row.DGMTRH ? new Date(row.DGMTRH).toISOString().split('T')[0] : null,
            birth_place: row.DOGUMYERI || null,
            gender: row.CINSIYET === 'E' ? 'M' : (row.CINSIYET === 'K' ? 'F' : 'U'),
            blood_type: row.KANGRUBU || null,
            address: [row.EV_ADRES1, row.EV_ADRES2].filter(Boolean).join(' ') || null,
            father_name: row.BABAADI || null,
            mother_name: row.ANNEADI || null,
            profession: row.MESLEK || null,
            nationality: row.NK_UYRUGU || 'TR',
            notes: row.NOTLAR || null,
            status: row.IPTAL ? 0 : 1
        }));

        this.stats.patients = patients.length;
        console.log(`${patients.length} hasta bulundu.`);
        return patients;
    }

    // 4. Gelişleri/Randevuları Aktarma
    async extractAppointments() {
        console.log('\n--- GELİŞLER / RANDEVULAR ---');
        const result = await this.mssqlPool.request().query(`
            SELECT 
                GELISNO,
                PROTOKOLNO,
                HASTANO,
                DOKTOR_ID,
                TARIH,
                IPTAL
            FROM HST_GELISLER
            ORDER BY GELISNO
        `);

        const appointments = result.recordset.map(row => ({
            legacy_visit_id: row.GELISNO,
            protocol_no: row.PROTOKOLNO || null,
            patient_legacy_id: row.HASTANO,
            doctor_legacy_id: row.DOKTOR_ID,
            appointment_date: row.TARIH ? new Date(row.TARIH).toISOString().slice(0, 19).replace('T', ' ') : null,
            status: row.IPTAL ? 'cancelled' : 'completed'
        }));

        this.stats.appointments = appointments.length;
        console.log(`${appointments.length} geliş kaydı bulundu.`);
        return appointments;
    }

    // 5. İşlemleri Aktarma
    async extractAppointmentItems() {
        console.log('\n--- YAPILAN İŞLEMLER ---');
        const result = await this.mssqlPool.request().query(`
            SELECT 
                i.RECORD_ID,
                i.GELISNO,
                i.ISLEMNO,
                i.FIYAT,
                i.ADET,
                i.YAPAN,
                t.ACIKLAMA as ISLEM_ADI
            FROM HST_ISLEMLER i
            LEFT JOIN TETKIK t ON i.ISLEMNO = t.KOD
            ORDER BY i.GELISNO, i.RECORD_ID
        `);

        const items = result.recordset.map(row => ({
            appointment_legacy_id: row.GELISNO,
            service_legacy_code: String(row.ISLEMNO),
            item_name: row.ISLEM_ADI || `İşlem ${row.ISLEMNO}`,
            quantity: row.ADET || 1,
            unit_price: parseFloat(row.FIYAT) || 0,
            total_price: (parseFloat(row.FIYAT) || 0) * (row.ADET || 1),
            performer_legacy_id: row.YAPAN
        }));

        this.stats.items = items.length;
        console.log(`${items.length} işlem kaydı bulundu.`);
        return items;
    }

    // 6. Tıbbi Kayıtları Aktarma
    async extractExaminations() {
        console.log('\n--- TIBBİ NOTLAR ---');
        // Link: TAKIP.EPIKRIZ_ID -> EPIKRIZ.ID, EPIKRIZ.TIBBIDOSYA_ID -> TIBBI.RECORD_ID, TIBBI.GELISNO
        const result = await this.mssqlPool.request().query(`
            SELECT 
                t.GELISNO,
                et.SIKAYETLER,
                et.HIKAYESI,
                et.BULGULAR,
                et.TESHIS,
                et.TEDAVI,
                et.SONUC,
                et.TARIH
            FROM HST_TIBBI_EPIKRIZ_TAKIP et
            INNER JOIN HST_TIBBI_EPIKRIZ e ON et.EPIKRIZ_ID = e.ID
            INNER JOIN HST_TIBBI t ON e.TIBBIDOSYA_ID = t.RECORD_ID
            ORDER BY et.EPIKRIZ_ID
        `);

        const examinations = result.recordset.map(row => ({
            legacy_visit_id: row.GELISNO,
            complaint: row.SIKAYETLER || null,
            story: row.HIKAYESI || null,
            bulgular: row.BULGULAR || null,
            diagnosis: row.TESHIS || null,
            treatment: row.TEDAVI || null,
            result_note: row.SONUC || null,
            created_at: row.TARIH ? new Date(row.TARIH).toISOString().slice(0, 19).replace('T', ' ') : null
        }));

        this.stats.examinations = examinations.length;
        console.log(`${examinations.length} tıbbi kayıt bulundu.`);
        return examinations;
    }

    // Tüm verileri çıkar ve JSON olarak kaydet
    async extractAll() {
        await this.connect();

        try {
            const data = {
                clinic_id: CLINIC_ID,
                extracted_at: new Date().toISOString(),
                users: await this.extractUsers(),
                services: await this.extractServices(),
                patients: await this.extractPatients(),
                appointments: await this.extractAppointments(),
                appointment_items: await this.extractAppointmentItems(),
                examinations: await this.extractExaminations()
            };

            // JSON olarak kaydet
            const fs = require('fs');
const path = require('path');
            const outputPath = path.resolve(__dirname, '..', 'data', 'migration_data.json');
            fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

            console.log('\n========================================');
            console.log('VERİ AKTARIM ÖZETİ');
            console.log('========================================');
            console.log(`Kullanıcılar: ${this.stats.users}`);
            console.log(`Hizmetler: ${this.stats.services}`);
            console.log(`Hastalar: ${this.stats.patients}`);
            console.log(`Randevular: ${this.stats.appointments}`);
            console.log(`İşlem Kalemleri: ${this.stats.items}`);
            console.log(`Tıbbi Kayıtlar: ${this.stats.examinations}`);
            console.log('----------------------------------------');
            console.log(`Veri dosyası: ${outputPath}`);
            console.log('========================================');

            return data;
        } finally {
            await this.disconnect();
        }
    }
}

// Ana çalıştırma
const migrator = new DataMigrator();
migrator.extractAll().catch(err => {
    console.error('Hata:', err);
    process.exit(1);
});
