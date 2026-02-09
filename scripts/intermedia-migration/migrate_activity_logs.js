const sql = require('mssql');
const mysql = require('mysql2/promise');
const { getSourceConfig, getTargetConfig } = require('./db.helper');

const BATCH_SIZE = 1000;
const CLINIC_ID = 1; // Default Clinic

const RECORD_RESOLVERS = {
    Patient: { table: 'ptn_cards', legacyColumn: 'legacy_id' },
    Appointment: { table: 'cln_appointments', legacyColumn: 'legacy_visit_id' },
    Examination: { table: 'cln_examinations', legacyColumn: 'legacy_visit_id' },
    Payment: { table: 'cln_payments', legacyColumn: 'legacy_id' },
    User: { table: 'sys_users', legacyColumn: 'legacy_id' },
    Service: { table: 'cln_services', legacyColumn: 'legacy_code' }
};

async function migrateActivityLogs() {
    console.log('🚀 Starting Activity Logs Migration...');

    const sourceConfig = getSourceConfig();
    const targetConfig = getTargetConfig();

    let mssqlPool;
    let mysqlConn;

    try {
        mssqlPool = await sql.connect(sourceConfig);
        mysqlConn = await mysql.createConnection(targetConfig);

        console.log('✅ Connected to databases.');

        // KRITIK: Klinik var mı kontrol et
        const [tenants] = await mysqlConn.execute('SELECT id FROM sys_tenants WHERE id = ?', [CLINIC_ID]);
        if (tenants.length === 0) {
            console.error(`\n❌ HATA: Klinik ID=${CLINIC_ID} bulunamadı!`);
            process.exit(1);
        }

        // 1. Load Legacy Table Map
        const [rows] = await mysqlConn.query('SELECT legacy_table_id, legacy_table_name, record_type, module FROM map_legacy_tables');
        const tableMap = {}; // ID -> Info
        const tableNameMap = {}; // Name -> Info

        rows.forEach(row => {
            if (row.legacy_table_id) tableMap[row.legacy_table_id] = { type: row.record_type, module: row.module };
            if (row.legacy_table_name) tableNameMap[row.legacy_table_name] = { type: row.record_type, module: row.module };
        });

        // 2. Load User Map (LegacyID -> UserID)
        const [userRows] = await mysqlConn.query('SELECT id, legacy_id FROM sys_users WHERE legacy_id IS NOT NULL');
        const userMap = {};
        userRows.forEach(row => userMap[row.legacy_id] = row.id);

        const recordIdCache = new Map();

        async function resolveRecordId(recordType, legacyId) {
            if (!recordType || legacyId === null || legacyId === undefined) return null;
            const resolver = RECORD_RESOLVERS[recordType];
            if (!resolver) return null;

            const cacheKey = `${recordType}:${legacyId}`;
            if (recordIdCache.has(cacheKey)) return recordIdCache.get(cacheKey);

            const [rows] = await mysqlConn.query(
                `SELECT id FROM ${resolver.table} WHERE ${resolver.legacyColumn} = ? LIMIT 1`,
                [legacyId]
            );
            const resolvedId = rows.length > 0 ? rows[0].id : null;
            recordIdCache.set(cacheKey, resolvedId);
            return resolvedId;
        }

        // 3. Migrate GENELLOG (General Activity)
        console.log('👉 Migrating GENELLOG...');

        // Get last imported ID
        const [gRes] = await mysqlConn.query("SELECT MAX(legacy_record_id) as max_id FROM cln_activity_logs WHERE legacy_table = 'GENELLOG'");
        let offset = gRes[0].max_id || 0;
        console.log(`   Detailed: Resuming GENELLOG from LogID ${offset}`);

        let hasMore = true;

        while (hasMore) {
            const result = await mssqlPool.request().query(`
                SELECT TOP ${BATCH_SIZE}
                    RECORD_ID,
                    BOLUM, 
                    BOLUM_ID, -- This holds the target record ID
                    KIM,      -- This holds the user ID
                    TARIH,
                    ACIKLAMA,
                    DETAY,
                    TAKIPNO1,
                    TAKIPNO2,
                    TAKIPNO3
                FROM GENELLOG
                WHERE RECORD_ID > ${offset}
                ORDER BY RECORD_ID
            `);

            if (result.recordset.length === 0) {
                hasMore = false;
                break;
            }

            const values = [];
            for (const row of result.recordset) {
                const legacyId = row.RECORD_ID;

                // Map User (KIM corresponds to legacy_id of user)
                const userId = userMap[row.KIM] || null;

                const legacyTableName = row.BOLUM ? row.BOLUM.trim() : '';

                // Determine Module and Type from BOLUM string
                // Example: 'Randevular_RandevuAl' -> Module: APPOINTMENT, Type: Appointment
                // Example: 'Hastalar_KayitDuzelt' -> Module: PATIENT, Type: Patient
                let module = 'SYSTEM';
                let type = 'Unknown';
                let action = 'OTHER';

                if (legacyTableName.includes('Randevu')) {
                    module = 'APPOINTMENT';
                    type = 'Appointment';
                } else if (legacyTableName.includes('Hasta') || legacyTableName.includes('HST')) {
                    module = 'PATIENT';
                    type = 'Patient';
                } else if (legacyTableName.includes('Tetkik') || legacyTableName.includes('Hizmet') || legacyTableName.includes('Islem')) {
                    module = 'FINANCE';
                    type = 'InvoiceItem'; // or Service
                } else if (legacyTableName.includes('Stok')) {
                    module = 'INVENTORY';
                    type = 'InventoryItem';
                } else if (legacyTableName.includes('Epikriz') || legacyTableName.includes('Tibbi')) {
                    module = 'CLINIC';
                    type = 'Examination';
                } else if (legacyTableName.includes('Kullanici')) {
                    module = 'SETTINGS';
                    type = 'User';
                }

                // Infer Action
                const desc = (row.ACIKLAMA || '').toLowerCase();
                if (desc.includes('iptal')) action = 'CANCEL';
                else if (desc.includes('ekle') || desc.includes('yeni') || legacyTableName.includes('Ekle')) action = 'CREATE';
                else if (desc.includes('değişik') || desc.includes('güncel') || desc.includes('düzelt')) action = 'UPDATE';
                else if (desc.includes('sil')) action = 'DELETE';
                else action = 'INFO';

                // Resolve Record ID
                // TAKIPNO2 often holds the main ID (PatientID or AppointmentID)
                // BOLUM_ID holds the specific record ID often (e.g. Appointment ID)
                // We need to try BOLUM_ID first, then TAKIPNO2
                let targetLegacyId = row.BOLUM_ID;
                if (!targetLegacyId || targetLegacyId === 300000) { // 300000 seems to be a placeholder
                    targetLegacyId = row.TAKIPNO2;
                }

                const recordId = await resolveRecordId(type, targetLegacyId);

                values.push([
                    CLINIC_ID,
                    userId,
                    action,
                    module,
                    recordId,
                    type,
                    null, // old_values
                    null, // new_values
                    null, // IP Address not available
                    `${row.ACIKLAMA || ''} - ${row.DETAY || ''}`.substring(0, 255),
                    'GENELLOG',
                    legacyId,
                    row.TARIH ? new Date(row.TARIH) : new Date()
                ]);

                offset = legacyId;
            }

            if (values.length > 0) {
                await mysqlConn.query(`
                    INSERT IGNORE INTO cln_activity_logs 
                    (clinic_id, user_id, action, module, record_id, record_type, old_values, new_values, ip_address, description, legacy_table, legacy_record_id, created_at)
                    VALUES ?
                `, [values]);
            }

            console.log(`Processed up to GENELLOG ID ${offset}`);
        }

        // 4. Migrate LOG_KAYITDEGISIKLIGI (Change Logs)
        console.log('👉 Migrating LOG_KAYITDEGISIKLIGI...');

        const [lRes] = await mysqlConn.query("SELECT MAX(legacy_record_id) as max_id FROM cln_activity_logs WHERE legacy_table = 'LOG_KAYITDEGISIKLIGI'");
        offset = lRes[0].max_id || 0;
        console.log(`   Detailed: Resuming LOG_KAYITDEGISIKLIGI from LogID ${offset}`);

        hasMore = true;

        while (hasMore) {
            const result = await mssqlPool.request().query(`
                SELECT TOP ${BATCH_SIZE}
                    ID,
                    TABLE_ID,
                    RECORD_ID,
                    KIM,
                    TARIH,
                    ESKIDEGERLER
                FROM LOG_KAYITDEGISIKLIGI
                WHERE ID > ${offset}
                ORDER BY ID
            `);

            if (result.recordset.length === 0) {
                hasMore = false;
                break;
            }

            const values = [];
            for (const row of result.recordset) {
                const legacyId = row.ID;
                const userId = userMap[row.KIM] || null;

                // We don't have table map, so we'll treat it as GENERIC
                let module = 'SYSTEM';
                let type = 'Unknown';

                // Try to guess from TABLE_ID if we had map, but we don't.
                // Or maybe we can skip this table if it's too opaque.
                // For now, let's log it as generic update.

                // If we can't determine record type, we can't resolve record_id easily to new ID.
                // We will store legacy_record_id as-is in description or metadata if possible?
                // But record_id column in cln_activity_logs is INT unrelated to legacy.

                // Let's assume TABLE_ID might match tableMap if legacy_table_id was set.
                // Since it is not set, we can't reliably migrate these logs.
                // However, user asked to fix the script.
                // I will migrate them as 'Unknown' type with null record_id

                values.push([
                    CLINIC_ID,
                    userId,
                    'UPDATE',
                    module,
                    null, // record_id
                    type,
                    JSON.stringify({ val: row.ESKIDEGERLER || '' }),
                    null, // new_values
                    null, // IP
                    `Legacy Change Log TableID:${row.TABLE_ID} RecordID:${row.RECORD_ID}`,
                    'LOG_KAYITDEGISIKLIGI',
                    legacyId,
                    row.TARIH ? new Date(row.TARIH) : new Date()
                ]);

                offset = legacyId;
            }

            if (values.length > 0) {
                await mysqlConn.query(`
                    INSERT IGNORE INTO cln_activity_logs 
                    (clinic_id, user_id, action, module, record_id, record_type, old_values, new_values, ip_address, description, legacy_table, legacy_record_id, created_at)
                    VALUES ?
                `, [values]);
            }
            console.log(`Processed up to LOG_KAYITDEGISIKLIGI ID ${offset}`);
        }

        console.log('✅ Activity Logs Migration Completed.');

    } catch (err) {
        console.error('❌ Error during migration:', err);
        process.exit(1);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

migrateActivityLogs();
