/**
 * Intermedia MSSQL -> Pozitif Klinik MySQL Migration
 * Step 1: SUBE -> sys_tenants Migration Script
 */

const sql = require('mssql');
const mysql = require('mysql2/promise');
const { getSourceConfig, getTargetConfig } = require('./core/db.helper');

// Function to convert Turkish characters to English equivalents
function turkishToEnglish(text) {
    if (!text) return '';
    return text
        .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
        .replace(/Ç/g, 'C').replace(/Ğ/g, 'G').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ş/g, 'S').replace(/Ü/g, 'U');
}

async function migrateTenants() {
    let mssqlPool;
    let mysqlConn;

    try {
        console.log('\n🚀 Şubeler Senkronize Ediliyor (SUBE -> sys_tenants)...');

        mssqlPool = await sql.connect(getSourceConfig());
        mysqlConn = await mysql.createConnection(getTargetConfig());

        const result = await mssqlPool.request().query('SELECT * FROM SUBE WHERE Iptal = 0 AND ID > 0 ORDER BY ID');
        const subeler = result.recordset;

        console.log(`📊 ${subeler.length} geçerli şube bulundu.`);

        for (const sube of subeler) {
            const domainPrefix = turkishToEnglish(sube.SubeAdi)
                .toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50);

            const sqlQuery = `
                INSERT INTO sys_tenants (id, name, phone, address, is_active, domain_prefix) 
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), address = VALUES(address)
            `;

            const params = [sube.ID, sube.SubeAdi, sube.Telefonlar || null, sube.Adresi || null, 1, domainPrefix];
            await mysqlConn.execute(sqlQuery, params);
            console.log(`✅ [ID: ${sube.ID}] ${sube.SubeAdi} aktarıldı/güncellendi.`);
        }

    } catch (err) {
        console.error('🛑 Şube Migration Hatası:', err.message);
        process.exit(1);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

migrateTenants();
