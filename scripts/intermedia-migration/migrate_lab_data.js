const sql = require('mssql');
const mysql = require('mysql2/promise');

// Configurations
const CLINIC_ID = 1;

const { getSourceConfig, getTargetConfig } = require('./db.helper');
const mssqlConfig = getSourceConfig();
const mysqlConfig = getTargetConfig();

class LabMigrator {
    constructor() {
        this.mssqlPool = null;
        this.mysqlConn = null;
        this.mapping = new Map(); // legacy_visit_id -> { appt_id, patient_id, doctor_id }
        this.stats = { total: 0, imported: 0, errors: 0 };
    }

    async connect() {
        console.log('Connecting to databases...');
        this.mssqlPool = await sql.connect(mssqlConfig);
        this.mysqlConn = await mysql.createConnection(mysqlConfig);
        console.log('Connected.');
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

    async migrate() {
        await this.connect();
        await this.loadMappings();

        console.log('Starting HST_LAB_BIYOKIMYA migration...');

        // Fetch data grouped by GELISNO (Visit ID) to create Headers first
        // We use a stream or paging to handle 1.6M rows efficiently
        const BATCH_SIZE = 500;
        let lastId = 0;

        while (true) {
            const request = this.mssqlPool.request();
            request.input('lastId', sql.Int, lastId);

            // Fetch unique GELISNOs first to create Headers
            // Note: This is a simplified logic. In a real scenario with 1.6M rows, 
            // we should likely migrate row-by-row but group them in memory or use a cursor.
            // Given the constraints, let's process raw items and insert headers on the fly or utilize ON DUPLICATE KEY UPDATE logic?
            // Better approach: Select distinct GELISNO from HST_LAB_BIYOKIMYA where RECORD_ID > lastId

            // Let's grab raw data and process
            // Removed BIRIM as it does not exist in TETKIK
            // Fixed SonucTarihi case
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

            for (const row of result.recordset) {
                await this.processRow(row);
                lastId = row.RECORD_ID;
            }

            process.stdout.write(`\rProcessed ${this.stats.total} records...`);
        }

        console.log('\nDone.');
        console.log(`Summary: Total ${this.stats.total}, Imported ${this.stats.imported}, Errors ${this.stats.errors}`);

        await this.close();
    }

    async processRow(row) {
        this.stats.total++;
        const map = this.mapping.get(row.GELISNO);
        if (!map) return; // Skip if no appointment found

        try {
            // 1. Ensure Header (cln_lab_results) exists
            // Since we process line by line, checking DB every time is slow.
            // Ideally we cache created result_ids.

            // For now, let's assume we create one result header per appointment if not exists
            const [existing] = await this.mysqlConn.execute(
                'SELECT id FROM cln_lab_results WHERE legacy_visit_id = ? LIMIT 1',
                [row.GELISNO]
            );

            let resultId;
            if (existing.length > 0) {
                resultId = existing[0].id;
            } else {
                const [ins] = await this.mysqlConn.execute(
                    `INSERT INTO cln_lab_results 
                    (clinic_id, appointment_id, patient_id, doctor_id, request_date, result_date, legacy_visit_id, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')`,
                    [
                        CLINIC_ID,
                        map.appt_id,
                        map.patient_id,
                        map.doctor_id,
                        row.TARIH || new Date(),
                        row.SONUCTARIHI || row.TARIH || new Date(),
                        row.GELISNO
                    ]
                );
                resultId = ins.insertId;
            }

            // 2. Insert Detail
            const isAbnormal = row.SINIRDISINDA || row.UYARISINIRINDA ? 1 : 0;
            const refRange = (row.NORMAL_ALT && row.NORMAL_UST)
                ? `${row.NORMAL_ALT} - ${row.NORMAL_UST}`
                : (row.NORMALDEGERLER || '');

            await this.mysqlConn.execute(
                `INSERT INTO cln_lab_result_items
                (result_id, test_name, result_value, unit, reference_range, is_abnormal, legacy_test_code)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    resultId,
                    row.TEST_ADI || `Test ${row.TESTNO}`,
                    row.BULUNAN || row.BULUNAN_SAYISAL || '',
                    '', // Unit not found in source
                    refRange,
                    isAbnormal,
                    String(row.TESTNO)
                ]
            );

            this.stats.imported++;

        } catch (err) {
            console.error(`Error on row ${row.RECORD_ID}:`, err.message);
            this.stats.errors++;
        }
    }

    async close() {
        if (this.mssqlPool) await this.mssqlPool.close();
        if (this.mysqlConn) await this.mysqlConn.end();
    }
}

const migrator = new LabMigrator();
migrator.migrate().catch(console.error);
