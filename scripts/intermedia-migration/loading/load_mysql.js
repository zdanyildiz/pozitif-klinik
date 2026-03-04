/**
 * Pozitif Klinik - Multi-Tenant Veri Yükleme Scripti (Loading - Full v7)
 * 
 * GÜNCELLEME: İsim, TC ve Telefon için OTOMATİK Blind Index kaydı eklendi.
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Config
const { getTargetConfig, getAppKey } = require('../core/db.helper');
const dbConfig = {
    ...getTargetConfig(),
    connectTimeout: 60000
};
const APP_KEY = getAppKey();
const BINARY_KEY = Buffer.from(APP_KEY, 'hex');

// CLI Arguments
const args = process.argv.slice(2);
const clinicArg = args.find(a => a.startsWith('--clinic='));
const CLINIC_ID = clinicArg ? parseInt(clinicArg.split('=')[1]) : 1;

// Blind Index Key read from .env
function readEnvKey(key) {
    const envPath = path.resolve(__dirname, '../../..', '.env');
    if (!fs.existsSync(envPath)) return null;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const match = line.match(/^\s*([^=\s]+)\s*=\s*(.*)\s*$/);
        if (!match || match[1].trim() !== key) continue;
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
        return val;
    }
    return null;
}

const BLIND_INDEX_KEY = readEnvKey('BLIND_INDEX_KEY');
const BINARY_BLIND_INDEX_KEY = BLIND_INDEX_KEY ? Buffer.from(BLIND_INDEX_KEY, 'hex') : null;

// Helpers
function encrypt(data) {
    if (data === null || data === undefined) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', BINARY_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function normalize(text) {
    if (!text) return '';
    const search = ['KI', 'kI', 'İ', 'I', 'Ğ', 'Ü', 'Ş', 'Ö', 'Ç'];
    const replace = ['ki', 'ki', 'i', 'ı', 'ğ', 'ü', 'ş', 'ö', 'ç'];
    let normalized = text;
    for (let i = 0; i < search.length; i++) normalized = normalized.split(search[i]).join(replace[i]);
    return normalized.trim().toLocaleLowerCase('tr-TR');
}

function blindIndex(data) {
    if (!data || !BINARY_BLIND_INDEX_KEY) return null;
    const normalized = normalize(String(data));
    if (!normalized) return null;
    return crypto.createHmac('sha256', BINARY_BLIND_INDEX_KEY).update(normalized).digest('hex');
}

function tokenizeName(name) {
    if (!name) return [];
    const normalized = normalize(name);
    return Array.from(new Set(normalized.split(/\s+/u).filter(t => t.length >= 2)));
}

function buildSearchIndexRows(tableName, recordId, patient) {
    const rows = [];
    // 1. İsim Parçaları (Ad, Orta Ad, Soyad)
    const nameTokens = tokenizeName(patient.name);
    for (const token of nameTokens) {
        const hash = blindIndex(token);
        if (hash) rows.push([tableName, recordId, 'name', hash]);
    }
    // 2. TC Kimlik No
    if (patient.tc_no) {
        const tcHash = blindIndex(patient.tc_no);
        if (tcHash) rows.push([tableName, recordId, 'tc_no', tcHash]);
    }
    // 3. Telefon No (Sadece rakamları normalize et)
    if (patient.phone) {
        const purePhone = String(patient.phone).replace(/\D/g, '');
        if (purePhone.length >= 10) {
            const phoneHash = blindIndex(purePhone);
            if (phoneHash) rows.push([tableName, recordId, 'phone', phoneHash]);
        }
    }
    return rows;
}

function toSqlDate(isoString) {
    if (!isoString) return null;
    try {
        const d = new Date(isoString);
        return d.toISOString().slice(0, 19).replace('T', ' ');
    } catch (e) { return null; }
}

// Global Maps
const patientMap = new Map();
const userMap = new Map();
const appointmentDetailsMap = new Map();

async function loadData(filename) {
    const filePath = path.resolve(__dirname, '..', 'data', `clinic_${CLINIC_ID}_${filename}.json`);
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
    const conn = await mysql.createConnection(dbConfig);
    console.log(`\nMySQL Bağlantısı Başarılı (Clinic ID: ${CLINIC_ID})`);

    try {
        // 1. KULLANICILAR
        const users = await loadData('users');
        if (users.length > 0) {
            console.log(`- Kullanıcılar (${users.length})...`);
            for (const u of users) {
                const [exists] = await conn.query('SELECT id FROM sys_users WHERE clinic_id = ? AND username = ?', [CLINIC_ID, u.username]);
                if (exists.length > 0) { userMap.set(u.legacy_id, exists[0].id); continue; }
                const passwordHash = await bcrypt.hash(String(u.legacy_id), 10);
                const [res] = await conn.query('INSERT INTO sys_users (clinic_id, username, name, password_hash, role, is_active, legacy_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [CLINIC_ID, u.username, u.name, passwordHash, u.role, u.is_active, u.legacy_id]);
                userMap.set(u.legacy_id, res.insertId);
            }
        }

        // 2. HASTALAR (OTOMATİK İNDEKSLEME)
        const patients = await loadData('patients');
        if (patients.length > 0) {
            console.log(`- Hastalar (${patients.length})...`);
            for (let i = 0; i < patients.length; i += 250) {
                const batch = patients.slice(i, i + 250);
                const batchLegacyIds = batch.map(p => p.legacy_id);
                const [existingRows] = await conn.query('SELECT id, legacy_id FROM ptn_cards WHERE clinic_id = ? AND legacy_id IN (?)', [CLINIC_ID, batchLegacyIds]);
                const existingSet = new Map(existingRows.map(r => [r.legacy_id, r.id]));

                const values = [];
                const newMeta = [];
                for (const p of batch) {
                    if (existingSet.has(p.legacy_id)) { patientMap.set(p.legacy_id, existingSet.get(p.legacy_id)); continue; }
                    values.push([CLINIC_ID, encrypt(p.tc_no || ''), encrypt(p.name || ''), encrypt(p.phone || ''), encrypt(p.email || ''), p.birth_date, p.gender, p.blood_type, encrypt(p.address || ''), p.notes, p.legacy_id, p.status, p.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')]);
                    newMeta.push(p);
                }

                if (values.length > 0) {
                    const [res] = await conn.query(`INSERT INTO ptn_cards (clinic_id, tc_no, name, phone, email, birth_date, gender, blood_type, address, notes, legacy_id, status, created_at) VALUES ?`, [values]);
                    let currentId = res.insertId;
                    const searchIndexBatch = [];
                    for (const p of newMeta) {
                        patientMap.set(p.legacy_id, currentId);
                        const si = buildSearchIndexRows('ptn_cards', currentId, p);
                        if (si.length > 0) searchIndexBatch.push(...si);
                        currentId++;
                    }
                    if (searchIndexBatch.length > 0) {
                        await conn.query('INSERT IGNORE INTO search_index (table_name, record_id, type, search_hash) VALUES ?', [searchIndexBatch]);
                    }
                }
            }
        }

        // 3. RANDEVULAR
        const appointments = await loadData('appointments');
        if (appointments.length > 0) {
            console.log(`- Randevular (${appointments.length})...`);
            let [types] = await conn.query('SELECT id FROM cln_appointment_types WHERE clinic_id = ? LIMIT 1', [CLINIC_ID]);
            let typeId = types.length > 0 ? types[0].id : (await conn.query('INSERT INTO cln_appointment_types (clinic_id, name) VALUES (?, ?)', [CLINIC_ID, 'Genel Muayene']))[0].insertId;

            for (let i = 0; i < appointments.length; i += 500) {
                const batch = appointments.slice(i, i + 500);
                const [existingAppts] = await conn.query('SELECT id, patient_id, doctor_id, legacy_visit_id FROM cln_appointments WHERE clinic_id = ? AND legacy_visit_id IN (?)', [CLINIC_ID, batch.map(a => a.legacy_visit_id)]);
                const existingApptSet = new Map(existingAppts.map(r => [r.legacy_visit_id, { id: r.id, patient_id: r.patient_id, doctor_id: r.doctor_id }]));

                const values = [];
                const newMeta = [];
                for (const a of batch) {
                    if (existingApptSet.has(a.legacy_visit_id)) { appointmentDetailsMap.set(a.legacy_visit_id, existingApptSet.get(a.legacy_visit_id)); continue; }
                    if (!patientMap.has(a.patient_legacy_id)) continue;
                    const pId = patientMap.get(a.patient_legacy_id);
                    const dId = userMap.get(a.doctor_legacy_id) || null;
                    values.push([CLINIC_ID, pId, dId, typeId, a.appointment_date || null, a.status, a.protocol_no, a.legacy_visit_id]);
                    newMeta.push({ ...a, mysql_patient_id: pId, mysql_doctor_id: dId });
                }
                if (values.length > 0) {
                    const [res] = await conn.query('INSERT INTO cln_appointments (clinic_id, patient_id, doctor_id, type_id, appointment_date, status, protocol_no, legacy_visit_id) VALUES ?', [values]);
                    let currentId = res.insertId;
                    for (const a of newMeta) appointmentDetailsMap.set(a.legacy_visit_id, { id: currentId++, patient_id: a.mysql_patient_id, doctor_id: a.mysql_doctor_id });
                }
            }
        }

        // 4. MUAYENE NOTLARI
        const examinations = await loadData('examinations');
        if (examinations.length > 0) {
            console.log(`- Muayene Notları (${examinations.length})...`);
            if (appointmentDetailsMap.size === 0) {
                const [rows] = await conn.query('SELECT id, patient_id, doctor_id, legacy_visit_id FROM cln_appointments WHERE clinic_id = ? AND legacy_visit_id IS NOT NULL', [CLINIC_ID]);
                rows.forEach(r => appointmentDetailsMap.set(r.legacy_visit_id, { id: r.id, patient_id: r.patient_id, doctor_id: r.doctor_id }));
            }
            for (let i = 0; i < examinations.length; i += 500) {
                const batch = examinations.slice(i, i + 500);
                const values = [];
                for (const e of batch) {
                    const detail = appointmentDetailsMap.get(e.legacy_visit_id);
                    if (!detail) continue;
                    const [exists] = await conn.query('SELECT id FROM cln_examinations WHERE appointment_id = ?', [detail.id]);
                    if (exists.length > 0) continue;
                    const examinationDoctorId = userMap.get(e.doctor_legacy_id) || detail.doctor_id || 1;
                    values.push([CLINIC_ID, detail.patient_id, examinationDoctorId, detail.id, encrypt(e.complaint), encrypt(e.story), encrypt(e.bulgular), encrypt(e.diagnosis), encrypt(e.treatment), encrypt(e.result_note), e.legacy_visit_id, toSqlDate(e.created_at)]);
                }
                if (values.length > 0) await conn.query('INSERT INTO cln_examinations (clinic_id, patient_id, doctor_user_id, appointment_id, complaint, story, bulgular, diagnosis, treatment, result_note, legacy_visit_id, created_at) VALUES ?', [values]);
            }
        }

        // 5. HİZMETLER VE İŞLEMLER
        const services = await loadData('services');
        for (const s of services) {
            const [exists] = await conn.query('SELECT id FROM cln_services WHERE clinic_id = ? AND legacy_code = ?', [CLINIC_ID, s.legacy_code]);
            if (exists.length === 0) await conn.query('INSERT INTO cln_services (clinic_id, name, legacy_code, price, is_active) VALUES (?, ?, ?, ?, ?)', [CLINIC_ID, s.name, s.legacy_code, s.price, s.is_active]);
        }
        const items = await loadData('appointment_items');
        if (items.length > 0) {
            console.log(`- İşlem Kalemleri (${items.length})...`);
            const [svcList] = await conn.query('SELECT id, legacy_code FROM cln_services WHERE clinic_id = ?', [CLINIC_ID]);
            const svcMap = new Map(svcList.map(s => [s.legacy_code, s.id]));
            for (let i = 0; i < items.length; i += 500) {
                const batch = items.slice(i, i + 500);
                const values = [];
                for (const itm of batch) {
                    const appt = appointmentDetailsMap.get(itm.appointment_legacy_id);
                    if (appt) values.push([CLINIC_ID, appt.id, svcMap.get(itm.service_legacy_code) || null, itm.item_name, itm.quantity, itm.unit_price, itm.total_price]);
                }
                if (values.length > 0) await conn.query('INSERT INTO cln_appointment_items (clinic_id, appointment_id, service_id, item_name, quantity, unit_price, total_price) VALUES ?', [values]);
            }
        }

        console.log('\n✅ AKTARIM VE OTOMATİK İNDEKSLEME TAMAMLANDI.');
    } catch (err) { console.error('\n❌ HATA:', err); throw err; } finally { await conn.end(); }
}

main().catch(err => { console.error(err); process.exit(1); });
