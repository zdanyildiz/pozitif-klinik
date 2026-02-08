const sql = require('mssql');
const mysql = require('mysql2/promise');

const CLINIC_ID = 1;

const { getSourceConfig, getTargetConfig } = require('./db.helper');
const mssqlConfig = getSourceConfig();
const mysqlConfig = getTargetConfig();

async function categorizeData() {
    let mssqlPool, mysqlConn;
    try {
        console.log('Veritabanlarına bağlanılıyor...');
        mssqlPool = await sql.connect(mssqlConfig);
        mysqlConn = await mysql.createConnection(mysqlConfig);

        // KRITIK: Klinik var mı kontrol et
        const [tenants] = await mysqlConn.execute('SELECT id FROM sys_tenants WHERE id = ?', [CLINIC_ID]);
        if (tenants.length === 0) {
            console.error(`\n❌ HATA: Klinik ID=${CLINIC_ID} bulunamadı!`);
            process.exit(1);
        }

        console.log('İç Hastalıkları GELISNO listesi alınıyor...');
        const result = await mssqlPool.request().query("SELECT DISTINCT GELISNO FROM UZM_ICHASTALIKLARI_HST_ANAMNEZ");
        const visitIds = result.recordset.map(r => r.GELISNO);

        console.log(`${visitIds.length} adet kayıt kategorize edilecek...`);

        // Batch update for performance
        const batchSize = 1000;
        for (let i = 0; i < visitIds.length; i += batchSize) {
            const batch = visitIds.slice(i, i + batchSize);
            await mysqlConn.execute(
                `UPDATE cln_examinations SET specialty_code = 'IC_HASTALIKLARI' 
                 WHERE legacy_visit_id IN (${batch.join(',')}) AND clinic_id = ?`,
                [CLINIC_ID]
            );
            process.stdout.write(`\rİşlenen: ${i + batch.length}...`);
        }

        console.log('\nKategorizasyon tamamlandı.');

    } catch (err) {
        console.error('❌ Hata:', err);
        process.exit(1);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

categorizeData();
