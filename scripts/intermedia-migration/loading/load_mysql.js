/**
 * Pozitif Klinik - Multi-Tenant Veri Yükleme Scripti (Loading)
 * 
 * Verilen klinik ID'sine ait AYRI JSON dosyalarını (users, patients, appointments...)
 * sırayla okuyup MySQL'e aktarır.
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
    connectTimeout: 60000,
    maxPreparedStatements: 16000
};
const APP_KEY = getAppKey();
const BINARY_KEY = Buffer.from(APP_KEY, 'hex');

// CLI Arguments
const args = process.argv.slice(2);
const clinicArg = args.find(a => a.startsWith('--clinic='));
const CLINIC_ID = clinicArg ? parseInt(clinicArg.split('=')[1]) : 1;

if (isNaN(CLINIC_ID)) {
    console.error('HATA: Geçerli bir --clinic=ID parametresi belirtilmelidir.');
    process.exit(1);
}

function readEnvKey(key) {
    if (process.env[key]) return process.env[key];
    const envPath = path.resolve(__dirname, '../../..', '.env');
    if (!fs.existsSync(envPath)) return null;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        if (!line || line.trim().startsWith('#')) continue;
        const match = line.match(/^\s*([^=\s]+)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const name = match[1].trim();
        if (name !== key) continue;
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        return value || null;
    }
    return null;
}

const BLIND_INDEX_KEY = readEnvKey('BLIND_INDEX_KEY');
if (!BLIND_INDEX_KEY) {
    console.error('BLIND_INDEX_KEY environment variable is not set.');
    process.exit(1);
}
const BINARY_BLIND_INDEX_KEY = Buffer.from(BLIND_INDEX_KEY, 'hex');

// Helpers
function encrypt(data) {
    if (!data) return null;
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
    if (!data) return null;
    const normalized = normalize(String(data));
    if (!normalized) return null;
    return crypto.createHmac('sha256', BINARY_BLIND_INDEX_KEY).update(normalized).digest('hex');
}

function tokenizeName(name) {
    if (!name) return [];
    const normalized = normalize(name);
    if (!normalized) return [];
    return Array.from(new Set(normalized.split(/\s+/u).filter(t => t.length >= 2)));
}

function buildSearchIndexRows(tableName, recordId, patient) {
    const rows = [];
    const nameTokens = tokenizeName(patient.name);
    for (const token of nameTokens) {
        const hash = blindIndex(token);
        if (hash) rows.push([tableName, recordId, 'name', hash]);
    }
    if (patient.tc_no) {
        const hash = blindIndex(patient.tc_no);
        if (hash) rows.push([tableName, recordId, 'tc_no', hash]);
    }
    return rows;
}

// Global Maps used across steps
const userMap = new Map();
const patientMap = new Map();
const appointmentMap = new Map();

async function loadData(filename) {
    const filePath = path.resolve(__dirname, '../data', `clinic_${CLINIC_ID}_${filename}.json`);
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Dosya bulunamadı: ${filename} (Atlanıyor)`);
        return [];
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
    const conn = await mysql.createConnection(dbConfig);
    console.log(`\nMySQL Bağlantısı Başarılı: ${dbConfig.database} (Clinic ID: ${CLINIC_ID})`);

    try {
        console.log('>>> Aktarım Başlıyor (Append Mode)...');

        // 1. KULLANICILAR
        const users = await loadData('users');
        if (users.length > 0) {
            console.log(`\n- Kullanıcılar (${users.length})...`);
            for (const u of users) {
                const [exists] = await conn.query('SELECT id FROM sys_users WHERE clinic_id = ? AND username = ?', [CLINIC_ID, u.username]);
                if (exists.length > 0) {
                    userMap.set(u.legacy_id, exists[0].id);
                    continue;
                }
                const passwordHash = await bcrypt.hash(String(u.legacy_id), 10);
                const [res] = await conn.query(
                    'INSERT INTO sys_users (clinic_id, username, name, password_hash, role, specialty, is_active, legacy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [CLINIC_ID, u.username, u.name, passwordHash, u.role, u.specialty, u.is_active, u.legacy_id]
                );
                userMap.set(u.legacy_id, res.insertId);
            }
        }

        // 2. HİZMETLER
        const services = await loadData('services');
        if (services.length > 0) {
            console.log(`- Hizmetler (${services.length})...`);
            for (const s of services) {
                const [exists] = await conn.query('SELECT id FROM cln_services WHERE clinic_id = ? AND legacy_code = ?', [CLINIC_ID, s.legacy_code]);
                if (exists.length > 0) continue;

                await conn.query(
                    'INSERT INTO cln_services (clinic_id, name, legacy_code, price, is_active) VALUES (?, ?, ?, ?, ?)',
                    [CLINIC_ID, s.name, s.legacy_code, s.price, s.is_active]
                );
            }
        }

        // 3. HASTALAR
        const patients = await loadData('patients');
        if (patients.length > 0) {
            console.log(`- Hastalar (${patients.length})...`);
            const batchSize = 250;

            for (let i = 0; i < patients.length; i += batchSize) {
                const batch = patients.slice(i, i + batchSize);
                const batchLegacyIds = batch.map(p => p.legacy_id);

                const [existingRows] = await conn.query(
                    'SELECT id, legacy_id FROM ptn_cards WHERE clinic_id = ? AND legacy_id IN (?)',
                    [CLINIC_ID, batchLegacyIds]
                );
                const existingSet = new Map(existingRows.map(r => [r.legacy_id, r.id]));

                const values = [];
                const meta = [];

                for (const p of batch) {
                    if (existingSet.has(p.legacy_id)) {
                        patientMap.set(p.legacy_id, existingSet.get(p.legacy_id));
                        continue;
                    }
                    values.push([
                        CLINIC_ID,
                        encrypt(p.tc_no || '11111111111'),
                        encrypt(p.name),
                        encrypt(p.phone || '5011234567'),
                        encrypt(p.email),
                        p.birth_date,
                        p.gender,
                        p.blood_type,
                        encrypt(p.address),
                        p.notes,
                        p.legacy_id,
                        p.status
                    ]);
                    meta.push(p);
                }

                if (values.length > 0) {
                    const [res] = await conn.query(
                        `INSERT INTO ptn_cards (clinic_id, tc_no, name, phone, email, birth_date, gender, blood_type, address, notes, legacy_id, status) VALUES ?`,
                        [values]
                    );
                    let currentId = res.insertId;
                    const searchIndexBatch = [];
                    for (const p of meta) {
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

        // 4. RANDEVULAR
        const appointments = await loadData('appointments');
        if (appointments.length > 0) {
            console.log(`- Randevular (${appointments.length})...`);
            // Pre-load patients map if starting fresh
            if (patientMap.size === 0) {
                const [pts] = await conn.query('SELECT id, legacy_id FROM ptn_cards WHERE clinic_id = ? AND legacy_id IS NOT NULL', [CLINIC_ID]);
                pts.forEach(p => patientMap.set(p.legacy_id, p.id));
            }
            // Pre-load users map
            if (userMap.size === 0) {
                const [usrs] = await conn.query('SELECT id, legacy_id FROM sys_users WHERE clinic_id = ? AND legacy_id IS NOT NULL', [CLINIC_ID]);
                usrs.forEach(u => userMap.set(u.legacy_id, u.id));
            }

            let [types] = await conn.query('SELECT id FROM cln_appointment_types WHERE clinic_id = ? LIMIT 1', [CLINIC_ID]);
            let typeId = types.length > 0 ? types[0].id : (await conn.query('INSERT INTO cln_appointment_types (clinic_id, name) VALUES (?, ?)', [CLINIC_ID, 'Genel Muayene']))[0].insertId;

            for (let i = 0; i < appointments.length; i += 500) {
                const batch = appointments.slice(i, i + 500);
                const batchVisitIds = batch.map(a => a.legacy_visit_id);

                const [existingAppts] = await conn.query(
                    'SELECT id, legacy_visit_id FROM cln_appointments WHERE clinic_id = ? AND legacy_visit_id IN (?)',
                    [CLINIC_ID, batchVisitIds]
                );
                const existingApptSet = new Map(existingAppts.map(r => [r.legacy_visit_id, r.id]));

                const values = [];
                const meta = [];

                for (const a of batch) {
                    if (existingApptSet.has(a.legacy_visit_id)) {
                        appointmentMap.set(a.legacy_visit_id, existingApptSet.get(a.legacy_visit_id));
                        continue;
                    }
                    if (!patientMap.has(a.patient_legacy_id)) continue;
                    values.push([
                        CLINIC_ID, patientMap.get(a.patient_legacy_id), userMap.get(a.doctor_legacy_id) || null,
                        typeId, a.appointment_date || '1970-01-01 00:00:00', a.status, a.protocol_no, a.legacy_visit_id
                    ]);
                    meta.push(a);
                }

                if (values.length > 0) {
                    const [res] = await conn.query(
                        'INSERT INTO cln_appointments (clinic_id, patient_id, doctor_id, type_id, appointment_date, status, protocol_no, legacy_visit_id) VALUES ?',
                        [values]
                    );
                    let currentId = res.insertId;
                    for (const a of meta) appointmentMap.set(a.legacy_visit_id, currentId++);
                }
            }
        }

        // 5. MUAYENELER (veya İŞLEM KALEMLERİ vs)
        // NOT: Muayene notları (complaint, diagnosis vb.) çok büyük olduğu için 
        // ayrı bir script olan `merge_specialty_data.js` tarafından işleniyor.
        // Hakeza examinations.json dosyasını da burada yükleyebiliriz ama
        // yukarıdaki stratejimiz gereği `merge_specialty_data.js` kullanacağız.

        // Eğer examinations.json varsa ve yüklemek istiyorsak:
        /*
        const examinations = await loadData('examinations');
        if (examinations.length > 0) {
            console.log(`- Muayene Notları (${examinations.length})...`);
            // Pre-load appointments map
            if (appointmentMap.size === 0) {
                const [appts] = await conn.query('SELECT id, legacy_visit_id FROM cln_appointments WHERE clinic_id = ? AND legacy_visit_id IS NOT NULL', [CLINIC_ID]);
                appts.forEach(a => appointmentMap.set(a.legacy_visit_id, a.id));
            }
            
            // ... insert logic similar to merge_specialty_data.js
        }
        */

        console.log('\n✅ AKTARIM TAMAMLANDI.');

    } catch (err) {
        console.error('\n❌ HATA:', err);
        throw err;
    } finally {
        await conn.end();
    }
}

main().catch(err => { console.error(err); process.exit(1); });
