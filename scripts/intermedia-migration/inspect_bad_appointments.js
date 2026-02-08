/**
 * MSSQL üzerindeki randevu tarihi (TARIH) boş olan kayıtları listeler.
 */

const sql = require('mssql');
const { getSourceConfig } = require('./db.helper');

async function inspect() {
    const config = getSourceConfig();
    try {
        const pool = await sql.connect(config);
        console.log('MSSQL Bağlantısı Başarılı.\n');

        console.log('--- Randevu Tarihi (TARIH) Boş Olanlar (TARIH IS NULL) ---');
        const result = await pool.request().query(`
            SELECT TOP 20 GELISNO, PROTOKOLNO, HASTANO, DOKTOR_ID, TARIH, IPTAL
            FROM HST_GELISLER 
            WHERE TARIH IS NULL
        `);
        console.table(result.recordset);

        await pool.close();
    } catch (err) {
        console.error('Hata:', err.message);
    }
}

inspect();
