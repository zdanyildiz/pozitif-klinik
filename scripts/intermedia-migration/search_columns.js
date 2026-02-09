const sql = require('mssql');
const { getSourceConfig } = require('./db.helper');

/**
 * Bu script, MSSQL veritabanında belirli anahtar kelimeleri içeren sütun adlarını bulur.
 * Aranan kelimeler: tansiyon, nabiz, boy, kilo (ve varyasyonları)
 */

const keywords = [
    'tansiyon',
    'nabiz',
    'nabız',
    'boy',
    'kilo',
    'kılo',
    'kg',
    'pulse',
    'tension'
];

async function searchColumns() {
    let pool;
    try {
        console.log('🚀 MSSQL kaynağına bağlanılıyor...');
        const config = getSourceConfig();
        pool = await sql.connect(config);
        console.log('✅ Bağlantı başarılı.\n');

        console.log(`🔍 Sütun adlarında şu kelimeler aranıyor: ${keywords.join(', ')}`);

        // SQL query build
        // SQL Server INFORMATION_SCHEMA.COLUMNS tablosunu sorguluyoruz
        const conditions = keywords.map((_, i) => `COLUMN_NAME LIKE @param${i}`).join(' OR ');
        const query = `
            SELECT 
                TABLE_SCHEMA,
                TABLE_NAME, 
                COLUMN_NAME,
                DATA_TYPE
            FROM 
                INFORMATION_SCHEMA.COLUMNS 
            WHERE 
                ${conditions}
            ORDER BY 
                TABLE_NAME, COLUMN_NAME
        `;

        const request = pool.request();
        keywords.forEach((k, i) => {
            request.input(`param${i}`, sql.VarChar, `%${k}%`);
        });

        const result = await request.query(query);

        if (result.recordset.length === 0) {
            console.log('❌ Eşleşen sütun bulunamadı.');
        } else {
            console.log(`✨ Toplam ${result.recordset.length} eşleşen sütun bulundu:\n`);

            // Tabloyu gruplayarak yazdıralım ki daha okunabilir olsun
            const grouped = {};
            result.recordset.forEach(row => {
                if (!grouped[row.TABLE_NAME]) grouped[row.TABLE_NAME] = [];
                grouped[row.TABLE_NAME].push(`${row.COLUMN_NAME} (${row.DATA_TYPE})`);
            });

            for (const table in grouped) {
                console.log(`--------------------------------------------------`);
                console.log(`📌 TABLO: ${table}`);
                console.log(`   Sütunlar: ${grouped[table].join(', ')}`);
            }
            console.log(`--------------------------------------------------\n`);
        }

    } catch (err) {
        console.error('❌ Hata oluştu:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('   Bağlantı reddedildi. Lütfen db.config.json dosyasındaki MSSQL bilgilerini kontrol edin.');
        }
    } finally {
        if (pool) {
            await pool.close();
            console.log('👋 Bağlantı kapatıldı.');
        }
    }
}

searchColumns();
