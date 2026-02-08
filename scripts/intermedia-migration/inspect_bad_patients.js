/**
 * MSSQL üzerindeki eksik verili (TC, İsim, Tel) hastaları listeler.
 */

const sql = require('mssql');
const { getSourceConfig } = require('./db.helper');

async function inspect() {
    const config = getSourceConfig();
    try {
        const pool = await sql.connect(config);
        console.log('MSSQL Bağlantısı Başarılı.\n');

        // 1. TC Kimlik No Boş Olanlar
        console.log('--- TC NO Boş Olanlar (KIMLIKNO IS NULL OR KIMLIKNO = \'\') ---');
        const tcRes = await pool.request().query(`
            SELECT TOP 10 HASTANO, AD, SOYAD, KIMLIKNO 
            FROM HST_ANADOSYA 
            WHERE KIMLIKNO IS NULL OR LTRIM(RTRIM(KIMLIKNO)) = ''
        `);
        console.table(tcRes.recordset);

        // 2. İsim Boş Olanlar (Hem AD hem SOYAD boşsa)
        console.log('\n--- İSİM Boş Olanlar (AD ve SOYAD IS NULL OR empty) ---');
        const nameRes = await pool.request().query(`
            SELECT TOP 10 HASTANO, AD, SOYAD 
            FROM HST_ANADOSYA 
            WHERE (AD IS NULL OR LTRIM(RTRIM(AD)) = '') AND (SOYAD IS NULL OR LTRIM(RTRIM(SOYAD)) = '')
        `);
        console.table(nameRes.recordset);

        // 3. Telefon Boş Olanlar
        console.log('\n--- TELEFON Boş Olanlar (MOBIL ve EV TEL IS NULL OR empty) ---');
        const phoneRes = await pool.request().query(`
            SELECT TOP 10 HASTANO, AD, SOYAD, EV_TELEFON, EV_MOBIL 
            FROM HST_ANADOSYA 
            WHERE (EV_TELEFON IS NULL OR LTRIM(RTRIM(EV_TELEFON)) = '') 
              AND (EV_MOBIL IS NULL OR LTRIM(RTRIM(EV_MOBIL)) = '')
        `);
        console.table(phoneRes.recordset);

        await pool.close();
    } catch (err) {
        console.error('Hata:', err.message);
    }
}

inspect();
