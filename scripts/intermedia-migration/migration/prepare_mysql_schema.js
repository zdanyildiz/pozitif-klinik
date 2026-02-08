/**
 * MySQL Şema Hazırlık Scripti
 * Şema hazırlığı artık migration SQL dosyalarıyla yapılır.
 * 
 * Kullanım: node migration/prepare_mysql_schema.js
 */

const mysql = require('mysql2/promise');
const { getTargetConfig } = require('../db.helper');

async function main() {
    const dbConfig = getTargetConfig();
    console.log(`Hedef veritabanı: ${dbConfig.database}`);

    let conn;
    try {
        conn = await mysql.createConnection(dbConfig);
        console.log('Veritabanına bağlanıldı.');

        // KRITIK: Önce sys_tenants tablosunda clinic_id=1 kaydının varlığını kontrol et ve oluştur
        console.log('\nTenant (Klinik) kaydı kontrol ediliyor...');
        const [tenants] = await conn.query('SELECT id FROM sys_tenants WHERE id = 1');
        if (tenants.length === 0) {
            console.log('Tenant bulunamadı, varsayılan klinik kaydı oluşturuluyor...');
            await conn.query(`INSERT INTO sys_tenants (id, name, domain_prefix, is_active, created_at) VALUES (1, 'Migrasyon Kliniği', 'migrasyon-klinigi', 1, NOW())`);
            console.log('Tenant kaydı oluşturuldu: id=1, name=Migrasyon Kliniği');
        } else {
            console.log('Tenant kaydı zaten mevcut: id=1');
        }

        console.log('\nŞema değişiklikleri migration SQL dosyalarında tutulur. Bu script ALTER çalıştırmaz.');
    } catch (err) {
        console.error('❌ KRİTİK HATA:', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

main().catch(console.error);
