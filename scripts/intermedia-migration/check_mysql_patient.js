const mysql = require('mysql2/promise');
const { getTargetConfig } = require('./db.helper');

async function check() {
    const config = getTargetConfig();
    const conn = await mysql.createConnection(config);

    // Legacy ID's known to have data from previous MSSQL check: 1, 12715, 12717
    const legacyIds = [1, 12715, 12717];

    console.log('Checking MySQL ptn_cards for specific legacy IDs...');

    const [rows] = await conn.query(
        `SELECT id, name, legacy_id, identity_details 
         FROM ptn_cards 
         WHERE legacy_id IN (?)`,
        [legacyIds]
    );

    rows.forEach(row => {
        console.log(`\nNew MySQL ID: ${row.id}`);
        console.log(`Name: ${row.name} (Encrypted/Decrypted view depends on app, raw DB has encrypted)`);
        console.log(`Legacy ID: ${row.legacy_id}`);
        console.log(`Identity Details (JSON):`, JSON.stringify(row.identity_details, null, 2));
    });

    await conn.end();
}

check().catch(console.error);
