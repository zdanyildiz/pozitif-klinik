const sql = require('mssql');
const mysql = require('mysql2/promise');

const CLINIC_ID = 1;

const { getSourceConfig, getTargetConfig } = require('./db.helper');
const mssqlConfig = getSourceConfig();
const mysqlConfig = getTargetConfig();

async function migrateMetadata() {
    let mssqlPool, mysqlConn;
    try {
        console.log('Connecting...');
        mssqlPool = await sql.connect(mssqlConfig);
        mysqlConn = await mysql.createConnection(mysqlConfig);
        console.log('Connected.');

        // KRITIK: Klinik var mı kontrol et
        const [tenants] = await mysqlConn.execute('SELECT id FROM sys_tenants WHERE id = ?', [CLINIC_ID]);
        if (tenants.length === 0) {
            console.error(`\n❌ HATA: Klinik ID=${CLINIC_ID} bulunamadı!`);
            process.exit(1);
        }

        // 1. Migrate Definitions (sys_lab_test_definitions)
        console.log('Migrating definitions...');
        const testResult = await mssqlPool.request().query(`
            SELECT DISTINCT 
                T.KOD, 
                T.ACIKLAMA, 
                T.LoincKodu,
                LT.DEGERTURU
            FROM TETKIK T
            INNER JOIN LAB_TESTLER LT ON T.KOD = LT.TESTKODU
            WHERE T.IPTAL = 0
        `);

        for (const row of testResult.recordset) {
            const dataType = row.DEGERTURU === 1 ? 'numeric' : 'text';
            await mysqlConn.execute(
                `INSERT INTO sys_lab_test_definitions (test_code, test_name, loinc_code, data_type) 
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE test_name = VALUES(test_name), loinc_code = VALUES(loinc_code)`,
                [String(row.KOD), row.ACIKLAMA, row.LoincKodu || null, dataType]
            );
        }
        console.log(`Migrated ${testResult.recordset.length} definitions.`);

        // 2. Migrate Normals (sys_lab_test_normals)
        console.log('Migrating normal values...');
        const normalResult = await mssqlPool.request().query(`
            SELECT 
                TESTKODU, CINSIYET, ALT_ZAMAN, UST_ZAMAN, 
                NORMAL_ALT, NORMAL_UST, NORMALDEGERLER, BIRIM
            FROM LAB_TESTNORMALLERI
        `);

        for (const row of normalResult.recordset) {
            // Find our definition id
            const [defRows] = await mysqlConn.execute(
                'SELECT id FROM sys_lab_test_definitions WHERE test_code = ?',
                [String(row.TESTKODU)]
            );
            if (defRows.length === 0) continue;

            const defId = defRows[0].id;
            let gender = 'both';
            if (row.CINSIYET === 'E' || row.CINSIYET === 'M') gender = 'M';
            if (row.CINSIYET === 'K' || row.CINSIYET === 'F') gender = 'F';

            // Insert normal value
            await mysqlConn.execute(
                `INSERT INTO sys_lab_test_normals (test_definition_id, gender, age_min, age_max, min_value, max_value, reference_text, unit)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    defId,
                    gender,
                    row.ALT_ZAMAN || 0,
                    row.UST_ZAMAN || 200,
                    row.NORMAL_ALT,
                    row.NORMAL_UST,
                    row.NORMALDEGERLER,
                    row.BIRIM
                ]
            );

            // Also update the main definition's default unit if it's still null
            if (row.BIRIM) {
                await mysqlConn.execute(
                    'UPDATE sys_lab_test_definitions SET default_unit = ? WHERE id = ? AND default_unit IS NULL',
                    [row.BIRIM, defId]
                );
            }
        }
        console.log(`Migrated ${normalResult.recordset.length} normal values.`);

        // 3. Migrate Panels (cln_lab_test_panels)
        console.log('Migrating panels...');
        const panelResult = await mssqlPool.request().query(`SELECT ID, GrupAdi, Sira FROM Lab_TestGrubu WHERE Iptal = 0`);

        for (const row of panelResult.recordset) {
            const [ins] = await mysqlConn.execute(
                `INSERT INTO cln_lab_test_panels (clinic_id, name, sort_order, legacy_group_id) VALUES (?, ?, ?, ?)`,
                [CLINIC_ID, row.GrupAdi, row.Sira || 0, row.ID]
            );
            const panelId = ins.insertId;

            // 4. Migrate Panel Items (cln_lab_panel_items)
            const itemResult = await mssqlPool.request().query(`
                SELECT TetkikKodu FROM Lab_TestGrubu_Test WHERE GrupID = ${row.ID} AND Iptal = 0
            `);

            for (const item of itemResult.recordset) {
                const [defRows] = await mysqlConn.execute(
                    'SELECT id FROM sys_lab_test_definitions WHERE test_code = ?',
                    [String(item.TetkikKodu)]
                );
                if (defRows.length > 0) {
                    await mysqlConn.execute(
                        'INSERT INTO cln_lab_panel_items (panel_id, test_definition_id) VALUES (?, ?)',
                        [panelId, defRows[0].id]
                    );
                }
            }
        }
        console.log(`Migrated panels and their items.`);

        console.log('Migration completed successfully.');

    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

migrateMetadata();
