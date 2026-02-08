const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const { getSourceConfig } = require('./db.helper');

async function analyzeLogTables() {
    let pool;
    const reportPath = path.resolve(__dirname, 'LOG_CRITICALITY_REPORT.md');

    try {
        const config = getSourceConfig();
        console.log(`🚀 Connecting to MSSQL: ${config.server}`);
        pool = await sql.connect(config);

        // 1. Find tables with "log" in the name
        const tablesResult = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE' 
            AND TABLE_SCHEMA = 'dbo'
            AND TABLE_NAME LIKE '%log%'
            ORDER BY TABLE_NAME
        `);

        const tables = tablesResult.recordset.map(r => r.TABLE_NAME);
        console.log(`🔍 Found ${tables.length} tables with 'log' in name.`);

        let reportContent = `# MSSQL Veritabanı "Log" Tabloları Kritiklik Analizi Raporu\n\n`;
        reportContent += `**Tarih:** ${new Date().toLocaleString('tr-TR')}\n`;
        reportContent += `**Sunucu:** ${config.server}\n`;
        reportContent += `**Veritabanı:** ${config.database}\n\n`;
        reportContent += `## Amaç\nEski sistemdeki log içerikli tabloların incelenerek, yeni sisteme taşınma gerekliliği, yasal saklama zorunlulukları ve operasyonel önemlerinin belirlenmesi.\n\n`;

        for (const tableName of tables) {
            console.log(`\nAnalyzing table: ${tableName}`);

            // a. Schema Analysis
            const schemaResult = await pool.request().query(`
                SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = 'dbo'
                ORDER BY ORDINAL_POSITION
            `);
            const schema = schemaResult.recordset;

            // b. Sample Data (10 rows)
            let sampleRows = [];
            try {
                // Try to get random sample or just top 10
                const dataResult = await pool.request().query(`SELECT TOP 10 * FROM dbo.[${tableName}]`);
                sampleRows = dataResult.recordset;
            } catch (err) {
                console.error(`Error fetching data for ${tableName}:`, err.message);
            }

            // c. Row Count
            let totalRows = 0;
            try {
                const countResult = await pool.request().query(`SELECT COUNT(*) as total FROM dbo.[${tableName}]`);
                totalRows = countResult.recordset[0].total;
            } catch (err) { }

            reportContent += `---\n\n`;
            reportContent += `## 📊 Tablo: \`${tableName}\`\n\n`;
            reportContent += `- **Toplam Kayıt Sayısı:** ${totalRows.toLocaleString('tr-TR')}\n`;

            reportContent += `### 🏗️ Sütun Yapısı (Schema)\n\n`;
            reportContent += `| Sütun Adı | Veri Tipi | Uzunluk | NULL? |\n`;
            reportContent += `| :--- | :--- | :--- | :--- |\n`;
            schema.forEach(col => {
                reportContent += `| ${col.COLUMN_NAME} | ${col.DATA_TYPE} | ${col.CHARACTER_MAXIMUM_LENGTH || '-'} | ${col.IS_NULLABLE} |\n`;
            });
            reportContent += `\n`;

            reportContent += `### 📄 Örnek Veri (İlk 10 Kayıt)\n\n`;
            if (sampleRows.length > 0) {
                const cols = Object.keys(sampleRows[0]);
                reportContent += `| ${cols.join(' | ')} |\n`;
                reportContent += `| ${cols.map(() => '---').join(' | ')} |\n`;
                sampleRows.forEach(row => {
                    const values = cols.map(c => {
                        let val = row[c];
                        if (val instanceof Date) return val.toISOString();
                        if (val === null) return '*null*';
                        if (typeof val === 'string') {
                            // Clean up string for markdown table
                            return val.replace(/\n/g, ' ').replace(/\|/g, '\\|').substring(0, 100);
                        }
                        if (typeof val === 'object') return JSON.stringify(val).substring(0, 100);
                        return val;
                    });
                    reportContent += `| ${values.join(' | ')} |\n`;
                });
            } else {
                reportContent += `*Tablo boş veya veri okunamadı.*\n`;
            }
            reportContent += `\n`;

            // d. Criticality Assessment logic
            const hasUserRef = schema.some(c => /kullanici|user|personel|dr|doktor|lastmod/i.test(c.COLUMN_NAME));
            const hasDate = schema.some(c => /tarih|date|time|timestamp/i.test(c.COLUMN_NAME));
            const hasAction = schema.some(c => /islem|action|type|tip|descr|aciklama|sql|query/i.test(c.COLUMN_NAME));
            const hasIP = schema.some(c => /ipaddr|host|client/i.test(c.COLUMN_NAME));
            const hasSensitiveData = schema.some(c => /hasta|tc|tel|mail|sifre|pass|kart|para|tutar/i.test(c.COLUMN_NAME));
            const isErrorLog = /hata|error|bug|log_error|sql_error/i.test(tableName);

            reportContent += `### 🧐 Kritiklik Değerlendirmesi\n\n`;

            // 1. Yasal Zorunluluk
            reportContent += `#### 1. Yasal Zorunluluk (KVKK / Tıbbi Kayıt)\n`;
            if (hasSensitiveData) {
                reportContent += `*   **Durum:** 🔴 YÜKSEK\n`;
                reportContent += `*   **Gerekçe:** Tablo doğrudan hassas kişisel veriler veya bunların değişim geçmişini barındırıyor olabilir. KVKK gereği veri sorumlusunun bu verilerin geçmişini saklaması veya denetimlerde sunabilmesi gerekebilir.\n`;
            } else if (hasUserRef && hasDate && hasAction) {
                reportContent += `*   **Durum:** 🟠 ORTA/YÜKSEK\n`;
                reportContent += `*   **Gerekçe:** Audit log niteliğindedir. Kimin hangi veriye ne zaman eriştiği/değiştirdiği bilgisi yasal denetimlerde (forensic analysis) zorunlu olabilir.\n`;
            } else {
                reportContent += `*   **Durum:** 🟡 DÜŞÜK\n`;
                reportContent += `*   **Gerekçe:** Doğrudan kişisel veri veya kritik işlem izi barındırmıyor gibi görünmektedir.\n`;
            }

            // 2. Operasyonel Önem
            reportContent += `\n#### 2. Operasyonel Önem\n`;
            if (isErrorLog) {
                reportContent += `*   **Durum:** 🟠 ORTA\n`;
                reportContent += `*   **Gerekçe:** Sistem hatalarının takibi için kritik olmakla birlikte, eski sistemden yeni sisteme taşınması "geçmiş hataların analizi" dışında şart değildir. Ancak hata ayıklama sürecinde referans olabilir.\n`;
            } else if (totalRows > 100000) {
                reportContent += `*   **Durum:** 🟠 ORTA\n`;
                reportContent += `*   **Gerekçe:** Yüksek hacimli veri barındırıyor. Sistemin yoğun kullanılan bir parçası olduğu anlaşılıyor.\n`;
            } else {
                reportContent += `*   **Durum:** 🟡 DÜŞÜK\n`;
                reportContent += `*   **Gerekçe:** Sistemin temel işleyişini doğrudan etkileyen bir ana tablo değil, yan kayıt tutucu niteliğindedir.\n`;
            }

            // 3. Güvenlik ve Denetim
            reportContent += `\n#### 3. Güvenlik ve Denetim\n`;
            if (hasIP || (hasUserRef && hasAction)) {
                reportContent += `*   **Durum:** 🔴 KRİTİK\n`;
                reportContent += `*   **Gerekçe:** Erişim kayıtları (IP, kullanıcı girişi vb.) ve işlem izlerini içermektedir. Güvenlik ihlallerinin tespiti için vazgeçilmezdir.\n`;
            } else {
                reportContent += `*   **Durum:** 🟡 DÜŞÜK\n`;
                reportContent += `*   **Gerekçe:** Güvenlik odaklı spesifik veriler barındırmıyor.\n`;
            }

            const isRed = hasSensitiveData || hasIP || (hasUserRef && hasAction);
            reportContent += `\n**NİHAİ KARAR:** ${isRed ? '🚫 TAŞINMALI / ARŞİVLENMELİ (KRİTİK)' : '✅ İKİNCİ PLANDA (DÜŞÜK ÖNCELİKLİ)'}\n\n`;
        }

        fs.writeFileSync(reportPath, reportContent);
        console.log(`\n✅ Analysis complete. Report saved to: ${reportPath}`);

    } catch (err) {
        console.error('🛑 Error:', err);
    } finally {
        if (pool) await pool.close();
    }
}

analyzeLogTables();
