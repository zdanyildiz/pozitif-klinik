/**
 * Pozitif Klinik - Veri İçe Aktarım Scripti
 * 
 * extracted_data.json dosyasındaki verileri MySQL veritabanına aktarır.
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Config
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pozitif_klinik'
};

const APP_KEY = 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef';
const BINARY_KEY = Buffer.from(APP_KEY, 'hex');

// Crypto functions (Matching PHP implementation)
function encrypt(data) {
    if (!data) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', BINARY_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function blindIndex(data) {
    if (!data) return null;
    return crypto.createHmac('sha256', BINARY_KEY).update(data).digest('hex');
}

async function main() {
    const dataPath = '/home/zafer/htdocs/pozitif-klinik/docs/migration_data.json';
    if (!fs.existsSync(dataPath)) {
        console.error('Veri dosyası bulunamadı!');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const CLINIC_ID = data.clinic_id;

    const conn = await mysql.createConnection(dbConfig);
    console.log('Veritabanına bağlanıldı.');

    try {
        console.log('Eski veriler siliniyor (Fresh start)...');
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        await conn.query('TRUNCATE sys_users');
        await conn.query('TRUNCATE cln_services');
        await conn.query('TRUNCATE ptn_cards');
        await conn.query('TRUNCATE cln_appointment_types');
        await conn.query('TRUNCATE cln_appointments');
        await conn.query('TRUNCATE cln_appointment_items');
        await conn.query('TRUNCATE cln_examinations');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        // 1. KULLANICILAR
        console.log('\nKullanıcılar aktarılıyor...');
        const userMap = new Map(); // legacy_id -> new_id
        for (const u of data.users) {
            // Şifre varsayılan olarak legacy_id (Daha sonra değiştirilmeli)
            const passwordHash = await bcrypt.hash(String(u.legacy_id), 10);
            const [res] = await conn.query(
                'INSERT INTO sys_users (clinic_id, username, name, password_hash, role, is_active, legacy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [CLINIC_ID, u.username, u.name, passwordHash, u.role, u.is_active, u.legacy_id]
            );
            userMap.set(u.legacy_id, res.insertId);
        }
        console.log(`${data.users.length} kullanıcı aktarıldı.`);

        // 2. HİZMETLER
        console.log('\nHizmetler aktarılıyor...');
        const serviceMap = new Map(); // legacy_code -> new_id
        for (const s of data.services) {
            const [res] = await conn.query(
                'INSERT INTO cln_services (clinic_id, name, legacy_code, price, is_active) VALUES (?, ?, ?, ?, ?)',
                [CLINIC_ID, s.name, s.legacy_code, s.price, s.is_active]
            );
            serviceMap.set(s.legacy_code, res.insertId);
        }
        console.log(`${data.services.length} hizmet aktarıldı.`);

        // 3. HASTALAR
        console.log('\nHastalar aktarılıyor (Şifrelenerek)...');
        const patientMap = new Map(); // legacy_id -> new_id
        const patientBatches = [];
        const batchSize = 100;

        for (let i = 0; i < data.patients.length; i += batchSize) {
            const batch = data.patients.slice(i, i + batchSize);
            const promises = batch.map(async (p) => {
                const [res] = await conn.query(
                    `INSERT INTO ptn_cards (
                        clinic_id, tc_no, tc_no_hash, name, name_hash, phone, phone_hash, 
                        email, birth_date, gender, blood_type, address, 
                        father_name, mother_name, birth_place, nationality, profession, notes, legacy_id, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        CLINIC_ID,
                        encrypt(p.tc_no), blindIndex(p.tc_no),
                        encrypt(p.name), blindIndex(p.name),
                        encrypt(p.phone), blindIndex(p.phone),
                        encrypt(p.email), p.birth_date, p.gender, p.blood_type,
                        encrypt(p.address),
                        p.father_name, p.mother_name, p.birth_place, p.nationality, p.profession,
                        encrypt(p.notes),
                        p.legacy_id, p.status
                    ]
                );
                patientMap.set(p.legacy_id, res.insertId);
            });
            await Promise.all(promises);
            if (i % 1000 === 0) console.log(`${i} hasta aktarıldı...`);
        }
        console.log(`${data.patients.length} hasta aktarıldı.`);

        // 4. RANDEVULAR
        console.log('\nRandevular aktarılıyor...');
        const appointmentMap = new Map(); // legacy_visit_id -> new_id

        // Önce bir Randevu Türü oluşturmalıyım (Default)
        const [apptTypeRes] = await conn.query(
            'INSERT INTO cln_appointment_types (clinic_id, name, color_code) VALUES (?, ?, ?)',
            [CLINIC_ID, 'Genel Muayene', '#3788d8']
        );
        const DEFAULT_TYPE_ID = apptTypeRes.insertId;

        for (let i = 0; i < data.appointments.length; i += batchSize) {
            const batch = data.appointments.slice(i, i + batchSize);
            const promises = batch.map(async (a) => {
                const patientId = patientMap.get(a.patient_legacy_id);
                const doctorId = userMap.get(a.doctor_legacy_id) || null;

                if (!patientId) return; // Geçersiz hasta ise atla

                const [res] = await conn.query(
                    'INSERT INTO cln_appointments (clinic_id, patient_id, doctor_id, type_id, appointment_date, status, protocol_no, legacy_visit_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [CLINIC_ID, patientId, doctorId, DEFAULT_TYPE_ID, a.appointment_date, a.status, a.protocol_no, a.legacy_visit_id]
                );
                appointmentMap.set(a.legacy_visit_id, res.insertId);
            });
            await Promise.all(promises);
            if (i % 5000 === 0) console.log(`${i} randevu aktarıldı...`);
        }
        console.log(`${data.appointments.length} randevu aktarıldı.`);

        // 5. İŞLEM KALEMLERİ
        console.log('\nİşlem kalemleri aktarılıyor...');
        for (let i = 0; i < data.appointment_items.length; i += batchSize) {
            const batch = data.appointment_items.slice(i, i + batchSize);
            const promises = batch.map(async (item) => {
                const appointmentId = appointmentMap.get(item.appointment_legacy_id);
                const serviceId = serviceMap.get(item.service_legacy_code) || null;
                const performerId = userMap.get(item.performer_legacy_id) || null;

                if (!appointmentId) return;

                await conn.query(
                    'INSERT INTO cln_appointment_items (clinic_id, appointment_id, service_id, item_name, quantity, unit_price, total_price, performer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [CLINIC_ID, appointmentId, serviceId, item.item_name, item.quantity, item.unit_price, item.total_price, performerId]
                );
            });
            await Promise.all(promises);
            if (i % 5000 === 0) console.log(`${i} işlem kalemi aktarıldı...`);
        }
        console.log(`${data.appointment_items.length} işlem kalemi aktarıldı.`);

        // 6. TIBBİ KAYITLAR
        console.log('\nTıbbi kayıtlar aktarılıyor...');
        for (let i = 0; i < data.examinations.length; i += batchSize) {
            const batch = data.examinations.slice(i, i + batchSize);
            const promises = batch.map(async (e) => {
                const appointmentId = appointmentMap.get(e.legacy_visit_id);
                if (!appointmentId) return;

                // Appointment'tan patient_id ve doctor_id almalıyız
                const [appt] = await conn.query('SELECT patient_id, doctor_id FROM cln_appointments WHERE id = ?', [appointmentId]);
                if (appt.length === 0) return;

                await conn.query(
                    `INSERT INTO cln_examinations (
                        clinic_id, patient_id, doctor_user_id, anamnez, complaint, story, bulgular, diagnosis, treatment, result_note, created_at, legacy_visit_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        CLINIC_ID, appt[0].patient_id, appt[0].doctor_id || 1,
                        '', e.complaint, e.story, e.bulgular, e.diagnosis, e.treatment, e.result_note, e.created_at, e.legacy_visit_id
                    ]
                );
            });
            await Promise.all(promises);
            if (i % 5000 === 0) console.log(`${i} tıbbi kayıt aktarıldı...`);
        }
        console.log(`${data.examinations.length} tıbbi kayıt aktarıldı.`);

        console.log('\nAKTARIM TAMAMLANDI!');

    } catch (err) {
        console.error('Aktarım sırasında hata:', err);
    } finally {
        await conn.end();
    }
}

main().catch(console.error);
