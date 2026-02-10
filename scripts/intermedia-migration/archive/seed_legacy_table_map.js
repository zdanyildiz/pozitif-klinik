const mysql = require('mysql2/promise');
const { getTargetConfig } = require('../db.helper');

async function seedLegacyTableMap() {
    console.log('--- Seeding Legacy Table Map ---');
    const config = getTargetConfig();
    const connection = await mysql.createConnection(config);

    try {
        // Define mappings
        // Format: [LegacyTableName, TargetRecordType, TargetModule, LegacyTableId (Optional)]
        const mappings = [
            ['HST_ANADOSYA', 'Patient', 'PATIENT', null],
            ['HST_GELISLER', 'Appointment', 'APPOINTMENT', null],
            ['HST_ISLEMLER', 'InvoiceItem', 'FINANCE', null],
            ['TAHSILAT', 'Payment', 'FINANCE', null],
            ['KULLANICILAR', 'User', 'SETTINGS', null],
            ['STOK', 'InventoryItem', 'INVENTORY', null],
            ['TETKIK', 'Service', 'SETTINGS', null],
            ['EPIKRIZ', 'Examination', 'CLINIC', null],
            ['HST_TIBBI_EPIKRIZ', 'Examination', 'CLINIC', null],
            ['RANDEVU', 'Appointment', 'APPOINTMENT', null],
            // Add other known tables here
        ];

        console.log(`Preparing to seed ${mappings.length} mappings...`);

        // Use INSERT IGNORE or ON DUPLICATE KEY UPDATE
        // We update record_type and module if table_name matches
        const query = `
            INSERT INTO map_legacy_tables (legacy_table_name, record_type, module, legacy_table_id)
            VALUES ?
            ON DUPLICATE KEY UPDATE
                record_type = VALUES(record_type),
                module = VALUES(module),
                legacy_table_id = VALUES(legacy_table_id) -- Update ID if we provide it
        `;

        await connection.query(query, [mappings]);

        console.log('✅ Legacy table map seeded successfully.');

    } catch (error) {
        console.error('❌ Error seeding legacy table map:', error);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

seedLegacyTableMap();
