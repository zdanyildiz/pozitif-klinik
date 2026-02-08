const sql = require('mssql');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path'); // Standard path module
const { fileTypeFromBuffer } = require('file-type');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// --- Configuration ---
const CLINIC_ID = 1;
const UPLOAD_ROOT = path.resolve(__dirname, '../../storage/app/uploads'); // Relative path

// Database Config
const { getSourceConfig, getTargetConfig } = require('./db.helper');
const mssqlConfig = getSourceConfig();
const mysqlConfig = getTargetConfig();

class FileMigrator {
    constructor() {
        this.mssqlPool = null;
        this.mysqlConn = null;
        this.stats = {
            total: 0,
            success: 0,
            skipped: 0,
            errors: 0
        };
        this.mapping = new Map(); // legacy_visit_id -> new_appointment_id
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
            'SELECT id, legacy_visit_id FROM cln_appointments WHERE legacy_visit_id IS NOT NULL AND clinic_id = ?',
            [CLINIC_ID]
        );

        for (const row of rows) {
            this.mapping.set(row.legacy_visit_id, row.id);
        }
        console.log(`Loaded ${this.mapping.size} appointment mappings.`);
    }

    async ensureDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    getStoragePath(dateObj) {
        const year = dateObj.getFullYear().toString();
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        return {
            relative: `${year}/${month}`,
            absolute: path.join(UPLOAD_ROOT, String(CLINIC_ID), year, month)
        };
    }

    async migrate() {
        await this.connect();
        await this.loadMappings();

        console.log('Starting migration of HST_LAB_RAPOR...');

        // Count total records for progress
        const countResult = await this.mssqlPool.request().query('SELECT COUNT(*) as count FROM HST_LAB_RAPOR');
        const totalRecords = countResult.recordset[0].count;
        console.log(`Total legacy files to check: ${totalRecords}`);

        // Process in batches
        const BATCH_SIZE = 10;
        let offset = 0;

        while (true) {
            const result = await this.mssqlPool.request().query(`
                SELECT ID, GELISNO, TARIH, RAPOR 
                FROM HST_LAB_RAPOR 
                ORDER BY ID 
                OFFSET ${offset} ROWS FETCH NEXT ${BATCH_SIZE} ROWS ONLY
            `);

            if (result.recordset.length === 0) break;

            for (const row of result.recordset) {
                await this.processRecord(row);
            }

            offset += result.recordset.length;
            console.log(`Processed ${offset}/${totalRecords} records...`);
        }

        this.printStats();
        await this.close();
    }

    async processRecord(row) {
        this.stats.total++;
        const legacyVisitId = row.GELISNO;

        // 1. Check if appointment exists in new system
        const newAppointmentId = this.mapping.get(legacyVisitId);
        if (!newAppointmentId) {
            // console.warn(`Skipping file ID ${row.ID}: No matching appointment for GELISNO ${legacyVisitId}`);
            this.stats.skipped++;
            return;
        }

        try {
            const buffer = row.RAPOR;
            if (!buffer) {
                this.stats.skipped++; // Empty content
                return;
            }

            // 2. Detect File Type
            let fileType = await fileTypeFromBuffer(buffer);
            let ext = 'dat';
            let mime = 'application/octet-stream';

            if (fileType) {
                ext = fileType.ext;
                mime = fileType.mime;
            } else {
                // Fallback detection for RTF or loose text
                const sample = buffer.toString('utf8', 0, 20);
                if (sample.includes('{\\rtf')) {
                    ext = 'rtf';
                    mime = 'application/rtf';
                }
            }

            // 3. Prepare Storage
            const date = row.TARIH ? new Date(row.TARIH) : new Date();
            const storageInfo = this.getStoragePath(date);
            await this.ensureDirectory(storageInfo.absolute);

            const fileUuid = uuidv4();
            const fileName = `${fileUuid}.${ext}`;
            const fullPath = path.join(storageInfo.absolute, fileName);
            const dbPath = `${storageInfo.relative}/${fileName}`; // Store relative path in DB

            // 4. Write to disk
            fs.writeFileSync(fullPath, buffer);

            // 5. Calculate Hash & Size
            const sizeKb = Math.round(buffer.length / 1024);
            const hash = crypto.createHash('sha256').update(buffer).digest('hex');

            // 6. Insert into MySQL keys:
            // id, clinic_id, module, related_id, original_name, storage_path, mime_type, size_kb, uuid, created_at, created_by
            const insertQuery = `
                INSERT INTO sys_files 
                (clinic_id, module, related_id, original_name, storage_path, file_hash, mime_type, size_kb, uuid, created_at, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const originalName = `Lab Result ${row.ID}.${ext}`;

            await this.mysqlConn.execute(insertQuery, [
                CLINIC_ID,
                'examination',
                newAppointmentId,
                originalName,
                dbPath,
                hash,
                mime,
                sizeKb,
                fileUuid,
                date,
                0 // System/Migration User
            ]);

            this.stats.success++;

        } catch (err) {
            console.error(`Error processing file ID ${row.ID}:`, err.message);
            this.stats.errors++;
        }
    }

    printStats() {
        console.log('\n--- Migration Summary ---');
        console.log(`Total Processed: ${this.stats.total}`);
        console.log(`Successfully Migrated: ${this.stats.success}`);
        console.log(`Skipped (No Appt/Empty): ${this.stats.skipped}`);
        console.log(`Errors: ${this.stats.errors}`);
    }

    async close() {
        if (this.mssqlPool) await this.mssqlPool.close();
        if (this.mysqlConn) await this.mysqlConn.end();
    }
}

// Run
const migrator = new FileMigrator();
migrator.migrate().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
