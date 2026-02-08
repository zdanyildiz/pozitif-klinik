/**
 * Intermedia MSSQL -> Pozitif Klinik MySQL Migration
 * Step 1: SUBE -> sys_tenants Migration Script
 */

const sql = require('mssql');
const mysql = require('mysql2/promise');
const { getSourceConfig, getTargetConfig } = require('./db.helper');

async function migrateTenants() {
    let mssqlPool;
    let mysqlConn;

    try {
        console.log('🚀 Migration Başlatılıyor: SUBE -> sys_tenants');

        // Bağlantılar
        mssqlPool = await sql.connect(getSourceConfig());
        mysqlConn = await mysql.createConnection(getTargetConfig());

        // 1. Kaynak veriyi çek (İptal edilmemiş gerçek şubeler)
        const result = await mssqlPool.request().query('SELECT * FROM SUBE WHERE Iptal = 0 AND ID > 0 ORDER BY ID');
        const subeler = result.recordset;

        console.log(`📊 ${subeler.length} geçerli şube bulundu.`);

        if (subeler.length === 0) {
            console.log('⚠️ Aktarılacak şube bulunamadı.');
            return;
        }

        // 2. Hedef tabloyu temizle mi yoksa ekle mi? 
        // Genelde tenants tablosu temizlenmez ama migration başında istenebilir.
        // Şimdilik sadece yeni kayıtları ekleyelim veya varsa güncelleyelim.

        for (const sube of subeler) {
            console.log(`🔹 İşleniyor: ${sube.SubeAdi} (ID: ${sube.ID})`);

            // domain_prefix için şube adından güvenli bir string oluştur
            const domainPrefix = sube.SubeAdi
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .slice(0, 50);

            // MySQL Insert
            const sqlQuery = `
                INSERT INTO sys_tenants (
                    name, 
                    phone, 
                    address, 
                    is_active, 
                    domain_prefix,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    name = VALUES(name),
                    phone = VALUES(phone),
                    address = VALUES(address),
                    is_active = VALUES(is_active)
            `;

            const params = [
                sube.SubeAdi,
                sube.Telefonlar || null,
                sube.Adresi || null,
                sube.Iptal ? 0 : 1,
                domainPrefix,
                sube.SonKayitTarihi || new Date()
            ];

            await mysqlConn.execute(sqlQuery, params);
            console.log(`✅ ${sube.SubeAdi} aktarıldı/güncellendi.`);
        }

        console.log('------------------------------------------------------------');
        console.log(`🎉 SUBE migration tamamlandı. Toplam: ${subeler.length}`);
        console.log('------------------------------------------------------------');

    } catch (err) {
        console.error('🛑 Migration Hatası:', err.message);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

migrateTenants();
