const sql = require('mssql');
const mysql = require('mysql2/promise');

// Configurations
const { getSourceConfig, getTargetConfig } = require('./core/db.helper');
const { parseClinicId } = require('./core/cli.helper');
const CLINIC_ID = parseClinicId();
const BATCH_SIZE = 2000; // Increased for bulk operations

const mssqlConfig = getSourceConfig();
const mysqlConfig = getTargetConfig();

class LabMigrator {
    constructor() {
        this.mssqlPool = null;
        this.mysqlConn = null;
        this.mapping = new Map(); // legacy_visit_id -> { appt_id, patient_id, doctor_id }
        this.existingHeaders = new Map(); // legacy_visit_id -> result_id
        this.stats = { total: 0, imported: 0, errors: 0, headersCreated: 0 };
    }

    async connect() {
        console.log('Connecting to databases...');
        this.mssqlPool = await sql.connect(mssqlConfig);
        this.mysqlConn = await mysql.createConnection(mysqlConfig);
        console.log('Connected.');

        // KRITIK: Klinik var mı kontrol et
        const [tenants] = await this.mysqlConn.execute('SELECT id FROM sys_tenants WHERE id = ?', [CLINIC_ID]);
        if (tenants.length === 0) {
            console.error(`\n❌ HATA: Klinik ID=${CLINIC_ID} bulunamadı!`);
            process.exit(1);
        }
    }

    async loadMappings() {
        console.log('Loading appointment mappings...');
        const [rows] = await this.mysqlConn.execute(
            'SELECT id, patient_id, doctor_id, legacy_visit_id FROM cln_appointments WHERE legacy_visit_id IS NOT NULL AND clinic_id = ?',
            [CLINIC_ID]
        );

        for (const row of rows) {
            this.mapping.set(row.legacy_visit_id, {
                appt_id: row.id,
                patient_id: row.patient_id,
                doctor_id: row.doctor_id
            });
        }
        console.log(`Loaded ${this.mapping.size} mappings.`);
    }

    async loadExistingHeaders() {
        console.log('Loading existing lab result headers...');
        const [rows] = await this.mysqlConn.execute(
            'SELECT id, legacy_visit_id FROM cln_lab_results WHERE legacy_visit_id IS NOT NULL AND clinic_id = ?',
            [CLINIC_ID]
        );

        for (const row of rows) {
            this.existingHeaders.set(row.legacy_visit_id, row.id);
        }
        console.log(`Loaded ${this.existingHeaders.size} existing headers.`);
    }

    async migrate() {
        await this.connect();
        await this.loadMappings();
        await this.loadExistingHeaders();

        console.log('Starting HST_LAB_BIYOKIMYA migration with BULK INSERT...');

        let lastId = 0;

        while (true) {
            const request = this.mssqlPool.request();
            request.input('lastId', sql.Int, lastId);

            const result = await request.query(`
                SELECT TOP ${BATCH_SIZE}
                    b.RECORD_ID, b.GELISNO, b.TARIH, b.SonucTarihi, 
                    b.TESTNO, b.BULUNAN, b.NORMALDEGERLER, b.NORMAL_ALT, b.NORMAL_UST,
                    b.UYARISINIRINDA, b.SINIRDISINDA, b.BULUNAN_SAYISAL,
                    t.ACIKLAMA as TEST_ADI
                FROM HST_LAB_BIYOKIMYA b
                LEFT JOIN TETKIK t ON b.TESTNO = t.KOD
                WHERE b.RECORD_ID > @lastId
                ORDER BY b.RECORD_ID
             `);

            if (result.recordset.length === 0) break;

            await this.processBatch(result.recordset);
            lastId = result.recordset[result.recordset.length - 1].RECORD_ID;

            process.stdout.write(`\rProcessed ${this.stats.total} records (${this.stats.headersCreated} headers, ${this.stats.imported} details)...`);
        }

        console.log('\nDone.');
        console.log(`Summary: Total ${this.stats.total}, Headers Created ${this.stats.headersCreated}, Details Imported ${this.stats.imported}, Errors ${this.stats.errors}`);

        await this.close();
    }

    async processBatch(rows) {
        // Step 1: Identify which headers need to be created
        const headersToCreate = new Map(); // legacy_visit_id -> row data (first occurrence)
        const detailRows = [];

        for (const row of rows) {
            this.stats.total++;
            const map = this.mapping.get(row.GELISNO);
            if (!map) continue; // Skip if no appointment found

            // Collect header info if not exists (use first row's dates)
            if (!this.existingHeaders.has(row.GELISNO) && !headersToCreate.has(row.GELISNO)) {
                headersToCreate.set(row.GELISNO, {
                    map,
                    tarih: row.TARIH,
                    sonucTarihi: row.SONUCTARIHI
                });
            }

            // Collect detail row
            detailRows.push(row);
        }

        // Step 2: Bulk insert headers
        if (headersToCreate.size > 0) {
            const headerValues = [];
            for (const [legacyVisitId, data] of headersToCreate) {
                headerValues.push([
                    CLINIC_ID,
                    data.map.appt_id,
                    data.map.patient_id,
                    data.map.doctor_id,
                    data.tarih || new Date(),
                    data.sonucTarihi || data.tarih || new Date(),
                    legacyVisitId,
                    'completed'
                ]);
            }

            try {
                await this.mysqlConn.query(
                    `INSERT IGNORE INTO cln_lab_results 
                    (clinic_id, appointment_id, patient_id, doctor_id, request_date, result_date, legacy_visit_id, status)
                    VALUES ?`,
                    [headerValues]
                );
                this.stats.headersCreated += headersToCreate.size;

                // Re-fetch newly created headers to get their IDs
                const legacyIds = Array.from(headersToCreate.keys());
                const placeholders = legacyIds.map(() => '?').join(',');
                const [newHeaders] = await this.mysqlConn.query(
                    `SELECT id, legacy_visit_id FROM cln_lab_results WHERE legacy_visit_id IN (${placeholders})`,
                    legacyIds
                );
                for (const h of newHeaders) {
                    this.existingHeaders.set(h.legacy_visit_id, h.id);
                }
            } catch (err) {
                console.error('\nError inserting headers:', err.message);
                this.stats.errors += headersToCreate.size;
            }
        }

        // Step 3: Bulk insert details
        const detailValues = [];
        for (const row of detailRows) {
            const resultId = this.existingHeaders.get(row.GELISNO);
            if (!resultId) continue;

            const isAbnormal = row.SINIRDISINDA || row.UYARISINIRINDA ? 1 : 0;
            const refRange = (row.NORMAL_ALT && row.NORMAL_UST)
                ? `${row.NORMAL_ALT} - ${row.NORMAL_UST}`
                : (row.NORMALDEGERLER || '');

            detailValues.push([
                resultId,
                row.TEST_ADI || `Test ${row.TESTNO}`,
                row.BULUNAN || row.BULUNAN_SAYISAL || '',
                '', // Unit not found in source
                refRange,
                isAbnormal,
                String(row.TESTNO)
            ]);
        }

        if (detailValues.length > 0) {
            try {
                // Insert in chunks to avoid packet size limits
                for (let i = 0; i < detailValues.length; i += 5000) {
                    const chunk = detailValues.slice(i, i + 5000);
                    await this.mysqlConn.query(
                        `INSERT INTO cln_lab_result_items
                        (result_id, test_name, result_value, unit, reference_range, is_abnormal, legacy_test_code)
                        VALUES ?`,
                        [chunk]
                    );
                }
                this.stats.imported += detailValues.length;
            } catch (err) {
                console.error('\nError inserting details:', err.message);
                this.stats.errors += detailValues.length;
            }
        }
    }

    async close() {
        if (this.mssqlPool) await this.mssqlPool.close();
        if (this.mysqlConn) await this.mysqlConn.end();
    }
}

const migrator = new LabMigrator();
migrator.migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
