const mysql = require('mysql2/promise');

async function main() {
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'pozitif_klinik'
    });

    console.log('Veritabanına bağlanıldı. payment_status sütunu ekleniyor...');

    const alters = [
        "ALTER TABLE `cln_appointments` ADD COLUMN `payment_status` ENUM('unpaid', 'partially_paid', 'paid') NOT NULL DEFAULT 'unpaid' AFTER `status`"
    ];

    for (const sql of alters) {
        try {
            console.log(`Çalıştırılıyor: ${sql}`);
            await conn.query(sql);
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Sütun zaten mevcut, geçiliyor.');
            } else {
                console.error('Hata:', err.message);
            }
        }
    }

    console.log('Şema güncelleme tamamlandı.');
    await conn.end();
}

main().catch(console.error);
