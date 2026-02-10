/**
 * Pozitif Klinik - Veri İçe Aktarım Scripti
 * 
 * migration_data.json dosyasındaki verileri MySQL veritabanına aktarır.
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Config
const { getTargetConfig, getAppKey } = require('../db.helper');
const dbConfig = {
    ...getTargetConfig(),
    connectTimeout: 60000,
    // Set max_allowed_packet equivalent for large bulk inserts
    maxPreparedStatements: 16000
};
const APP_KEY = getAppKey();
const BINARY_KEY = Buffer.from(APP_KEY, 'hex');

function readEnvKey(key) {
    if (process.env[key]) {
        return process.env[key];
    }
    const envPath = path.resolve(__dirname, '..', '..', '..', '.env');
    if (!fs.existsSync(envPath)) {
        return null;
    }
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        if (!line || line.trim().startsWith('#')) continue;
        const match = line.match(/^\s*([^=\s]+)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const name = match[1].trim();
        if (name !== key) continue;
        let value = match[2].trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        return value || null;
    }
    return null;
}

const BLIND_INDEX_KEY = readEnvKey('BLIND_INDEX_KEY');
if (!BLIND_INDEX_KEY) {
    console.error('BLIND_INDEX_KEY environment variable is not set. Search index cannot be generated.');
    process.exit(1);
}
const BINARY_BLIND_INDEX_KEY = Buffer.from(BLIND_INDEX_KEY, 'hex');

// Crypto functions (Matching PHP implementation)
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
    for (let i = 0; i < search.length; i++) {
        normalized = normalized.split(search[i]).join(replace[i]);
    }
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
    const tokens = normalized.split(/\s+/u).filter(t => t.length >= 2);
    return Array.from(new Set(tokens));
}

function buildPhoneTokens(phone) {
    if (!phone) return [];
    const tokens = new Set();

    // Tam hali (formatlı olabilir)
    tokens.add(phone);

    // Sadece rakamlar
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone && cleanPhone !== phone) {
        tokens.add(cleanPhone);
    }

    // Başındaki sıfır olmadan
    if (cleanPhone && cleanPhone.startsWith('0')) {
        const noZeroPhone = cleanPhone.replace(/^0+/, '');
        if (noZeroPhone) {
            tokens.add(noZeroPhone);
        }
    }

    // Boşluklu parçalar
    if (phone.includes(' ')) {
        for (const raw of phone.split(' ')) {
            const token = raw.replace(/^[\s()-]+|[\s()-]+$/g, '');
            if (token.length >= 3) {
                tokens.add(token);
            }
        }
    }

    return Array.from(tokens);
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

    if (patient.phone) {
        const phoneTokens = buildPhoneTokens(patient.phone);
        for (const token of phoneTokens) {
            const hash = blindIndex(token);
            if (hash) rows.push([tableName, recordId, 'phone', hash]);
        }
    }

    return rows;
}

async function main() {
    const dataPath = path.resolve(__dirname, '..', 'data', 'migration_data.json');
    if (!fs.existsSync(dataPath)) {
        console.error('Veri dosyası bulunamadı!');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const CLINIC_ID = data.clinic_id;

    const conn = await mysql.createConnection(dbConfig);
    console.log('Veritabanına bağlanıldı.');

    // İl ve İlçe lookup tablolarını yükle
    console.log('İl ve İlçe verileri yükleniyor...');
    const [provinces] = await conn.query('SELECT id, name FROM sys_provinces');
    const [districts] = await conn.query('SELECT id, province_id, name FROM sys_districts');

    // Akıllı eşleştirme için normalizasyon fonksiyonu
    const smartNormalize = (text) => {
        if (!text) return '';
        let normalized = text.trim().toLowerCase();
        // Türkçe karakter normalizasyonu
        const mapping = {
            'ç': 'c', 'ğ': 'g', 'ı': 'i', 'i': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
            'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'I': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
        };
        normalized = normalized.split('').map(char => mapping[char] || char).join('');
        // Gereksiz karakterleri temizle
        normalized = normalized.replace(/[^a-z0-9]/g, '');
        return normalized;
    };

    // Şehir özel eşleştirmeleri (Kısaltmalar)
    const provinceShorthands = {
        'ist': 'istanbul',
        'ank': 'ankara',
        'izmir': 'izmir',
        'antalya': 'antalya'
    };

    const findProvinceId = (name) => {
        if (!name) return null;
        let searchName = smartNormalize(name);

        // Kısaltma kontrolü
        if (provinceShorthands[searchName]) {
            searchName = provinceShorthands[searchName];
        }

        const p = provinces.find(p => smartNormalize(p.name) === searchName);
        return p ? p.id : null;
    };

    const findDistrictId = (provinceId, name) => {
        if (!provinceId || !name) return null;
        const searchName = smartNormalize(name);
        const d = districts.find(d =>
            d.province_id === provinceId &&
            smartNormalize(d.name) === searchName
        );
        return d ? d.id : null;
    };

    // Kritik Kontrol: Klinik (Tenant) var mı?
    console.log(`\nKontrol ediliyor: Clinic ID ${CLINIC_ID}...`);
    const [tenants] = await conn.query('SELECT id FROM sys_tenants WHERE id = ?', [CLINIC_ID]);
    if (tenants.length === 0) {
        console.error(`\n❌ HATA: sys_tenants tablosunda ID=${CLINIC_ID} olan bir klinik bulunamadı!`);
        console.error(`Lütfen önce migrate_tenants.js scriptini çalıştırın veya klinik oluşturun.`);
        await conn.end();
        process.exit(1);
    }
    console.log(`✅ Klinik bulundu: ID ${CLINIC_ID}`);

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
        await conn.query("DELETE FROM search_index WHERE table_name = 'ptn_cards'");
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');

        // 1. KULLANICILAR
        console.log('\nKullanıcılar aktarılıyor...');
        const userMap = new Map(); // legacy_id -> new_id
        for (const u of data.users) {
            // Şifre varsayılan olarak legacy_id (Daha sonra değiştirilmeli)
            const passwordHash = await bcrypt.hash(String(u.legacy_id), 10);
            const [res] = await conn.query(
                'INSERT INTO sys_users (clinic_id, username, name, password_hash, role, specialty, is_active, legacy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [CLINIC_ID, u.username, u.name, passwordHash, u.role, u.specialty, u.is_active, u.legacy_id]
            );
            userMap.set(u.legacy_id, res.insertId);
        }
        console.log(`${data.users.length} kullanıcı aktarıldı.`);

        // 2. HİZMETLER
        console.log('\nHizmetler aktarılıyor (Bulk Insert)...');
        const serviceMap = new Map(); // legacy_code -> new_id

        // Prepare bulk insert for Services
        if (data.services.length > 0) {
            const serviceValues = data.services.map(s => [
                CLINIC_ID,
                s.name,
                s.legacy_code,
                s.price,
                s.is_active
            ]);

            // Insert in chunks of 5000 to avoid packet size limits
            for (let i = 0; i < serviceValues.length; i += 5000) {
                const chunk = serviceValues.slice(i, i + 5000);
                await conn.query(
                    'INSERT INTO cln_services (clinic_id, name, legacy_code, price, is_active) VALUES ?',
                    [chunk]
                );
            }

            // Re-fetch to build map (faster than individual inserts)
            const [svcRows] = await conn.query('SELECT id, legacy_code FROM cln_services');
            svcRows.forEach(row => serviceMap.set(row.legacy_code, row.id));
        }
        console.log(`${data.services.length} hizmet aktarıldı.`);

        // 3. HASTALAR (BULK INSERT)
        console.log('\nHastalar aktarılıyor (Şifrelenerek ve İl/İlçe eşleştirilerek - BULK INSERT)...');
        const patientMap = new Map(); // legacy_id -> new_id
        const batchSize = 500; // Reduced for encrypted data to avoid packet limits
        const tableName = 'ptn_cards';

        for (let i = 0; i < data.patients.length; i += batchSize) {
            const batch = data.patients.slice(i, i + batchSize);

            // Prepare bulk insert values
            const patientValues = batch.map(p => {
                const provinceId = findProvinceId(p.city);
                const districtId = findDistrictId(provinceId, p.district);

                // Ham adres bilgisini notlara ekle
                let finalNotes = p.notes || '';
                if (p.city || p.district) {
                    const rawLocation = [p.district, p.city].filter(Boolean).join(' / ');
                    const prefix = `[Eski Kayıt Lokasyon: ${rawLocation}]`;
                    finalNotes = finalNotes ? `${prefix} | ${finalNotes}` : prefix;
                }

                return [
                    p.legacy_id, // FORCE ID = LEGACY_ID
                    CLINIC_ID,
                    encrypt(p.tc_no || '11111111111'),
                    encrypt(p.name),
                    encrypt(p.phone || '5111111111'),
                    encrypt(p.email), p.birth_date, p.gender, p.blood_type,
                    encrypt(p.address),
                    provinceId, districtId,
                    JSON.stringify(p.medical_info),
                    JSON.stringify(p.work_details),
                    JSON.stringify(p.identity_details),
                    JSON.stringify(p.insurance_info),
                    JSON.stringify(p.legacy_metadata),
                    JSON.stringify(p.legal_consents),
                    encrypt(finalNotes),
                    p.legacy_id, p.status
                ];
            });

            // Bulk insert patients
            await conn.query(
                `INSERT INTO ptn_cards (
                    id, clinic_id, tc_no, name, phone, 
                    email, birth_date, gender, blood_type, address, province_id, district_id,
                    medical_info, work_details, identity_details, insurance_info, legacy_metadata, legal_consents,
                    notes, legacy_id, status
                ) VALUES ?`,
                [patientValues]
            );

            // Map legacy IDs to new IDs (Birebir eşleşme)
            batch.forEach(p => {
                patientMap.set(p.legacy_id, p.legacy_id);
            });

            // Build search index rows for this batch
            const searchIndexRows = [];
            batch.forEach(p => {
                const recordId = patientMap.get(p.legacy_id);
                const rows = buildSearchIndexRows(tableName, recordId, p);
                if (rows.length) {
                    searchIndexRows.push(...rows);
                }
            });

            // Bulk insert search index
            if (searchIndexRows.length) {
                for (let j = 0; j < searchIndexRows.length; j += 5000) {
                    const chunk = searchIndexRows.slice(j, j + 5000);
                    await conn.query(
                        'INSERT INTO search_index (table_name, record_id, type, search_hash) VALUES ?',
                        [chunk]
                    );
                }
            }

            if (i % 2000 === 0) console.log(`${i} hasta aktarıldı...`);
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
            const today = new Date().toISOString().slice(0, 19).replace('T', ' ');

            // Filtreleme: Geçerli hastası olanları ayır
            const validBatch = batch.filter(a => patientMap.has(a.patient_legacy_id));

            if (validBatch.length > 0) {
                const values = validBatch.map(a => [
                    CLINIC_ID,
                    patientMap.get(a.patient_legacy_id),
                    userMap.get(a.doctor_legacy_id) || null,
                    DEFAULT_TYPE_ID,
                    a.appointment_date || today,
                    a.status,
                    a.protocol_no,
                    a.legacy_visit_id
                ]);

                const [res] = await conn.query(
                    'INSERT INTO cln_appointments (clinic_id, patient_id, doctor_id, type_id, appointment_date, status, protocol_no, legacy_visit_id) VALUES ?',
                    [values]
                );

                // Bulk insert sonrası ID'leri eşleştir (Auto-increment garantisiyle)
                let currentId = res.insertId;
                validBatch.forEach(a => {
                    appointmentMap.set(a.legacy_visit_id, currentId++);
                });
            }
            if (i % 10000 === 0) console.log(`${i} randevu aktarıldı...`);
        }
        console.log(`${data.appointments.length} randevu aktarıldı.`);

        // 5. İŞLEM KALEMLERİ
        console.log('\nİşlem kalemleri aktarılıyor...');
        for (let i = 0; i < data.appointment_items.length; i += batchSize) {
            const batch = data.appointment_items.slice(i, i + batchSize);
            const validBatch = batch.filter(item => appointmentMap.has(item.appointment_legacy_id));

            if (validBatch.length > 0) {
                const values = validBatch.map(item => [
                    CLINIC_ID,
                    appointmentMap.get(item.appointment_legacy_id),
                    serviceMap.get(item.service_legacy_code) || null,
                    item.item_name,
                    item.quantity,
                    item.unit_price,
                    item.total_price,
                    userMap.get(item.performer_legacy_id) || null
                ]);

                await conn.query(
                    'INSERT INTO cln_appointment_items (clinic_id, appointment_id, service_id, item_name, quantity, unit_price, total_price, performer_id) VALUES ?',
                    [values]
                );
            }
            if (i % 10000 === 0) console.log(`${i} işlem kalemi aktarıldı...`);
        }
        console.log(`${data.appointment_items.length} işlem kalemi aktarıldı.`);

        // 6. TIBBİ KAYITLAR
        console.log('\nTıbbi kayıtlar aktarılıyor...');
        for (let i = 0; i < data.examinations.length; i += batchSize) {
            const batch = data.examinations.slice(i, i + batchSize);
            const validBatch = [];

            for (const e of batch) {
                const appointmentId = appointmentMap.get(e.legacy_visit_id);
                if (!appointmentId) continue;

                // Not: bulk insert yaparken patient_id ve doctor_id'yi map'lerden alıyoruz
                // Bu adımda cln_appointments tablosuna tekrar gitmek performansı düşürür, map kullanıyoruz.
                // find patientId for this appointment
                const apptInfo = data.appointments.find(a => a.legacy_visit_id === e.legacy_visit_id);
                if (!apptInfo) continue;

                const patientId = patientMap.get(apptInfo.patient_legacy_id);
                const doctorId = userMap.get(apptInfo.doctor_legacy_id) || 1;

                if (patientId) {
                    validBatch.push([
                        CLINIC_ID, patientId, doctorId, appointmentId,
                        '', e.complaint, e.story, e.bulgular, e.diagnosis, e.treatment, e.result_note, e.legacy_visit_id, e.created_at
                    ]);
                }
            }

            if (validBatch.length > 0) {
                await conn.query(
                    `INSERT INTO cln_examinations (
                        clinic_id, patient_id, doctor_user_id, appointment_id, anamnez, complaint, story, bulgular, diagnosis, treatment, result_note, legacy_visit_id, created_at
                    ) VALUES ?`,
                    [validBatch]
                );
            }
            if (i % 10000 === 0) console.log(`${i} tıbbi kayıt aktarıldı...`);
        }
        console.log(`${data.examinations.length} tıbbi kayıt aktarıldı.`);

        console.log('\nAKTARIM TAMAMLANDI!');

    } catch (err) {
        console.error('\n❌ AKTARIM SIRASINDA KRİTİK HATA:');
        console.error(err);
        process.exit(1); // Orchestration scriptine durması gerektiğini bildirir
    } finally {
        await conn.end();
    }
}

main().catch(console.error);
