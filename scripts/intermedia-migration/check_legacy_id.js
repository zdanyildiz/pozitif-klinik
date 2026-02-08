const mysql = require('mysql2/promise');
const { getTargetConfig } = require('./db.helper');

async function checkLegacyId() {
    try {
        const config = getTargetConfig();
        const conn = await mysql.createConnection(config);

        console.log('Connected to MySQL');

        const [rows] = await conn.query('SELECT COUNT(*) as total, COUNT(legacy_id) as with_legacy FROM ptn_cards');
        console.log('Patients:', rows[0]);

        const [sample] = await conn.query('SELECT id, legacy_id FROM ptn_cards LIMIT 5');
        console.log('Sample:', sample);

        await conn.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkLegacyId();
