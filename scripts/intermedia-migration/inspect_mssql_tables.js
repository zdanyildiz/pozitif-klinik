/**
 * MSSQL Tablo Denetleyici - Pozitif Klinik
 * 
 * Bu script db.config.json dosyasındaki kaynak MSSQL veritabanına bağlanır,
 * yalnızca içeriği dolu olan, "AYAR_", A-F arası, "Hastane", "Hizmet" veya "log" 
 * kelimelerini içermeyen tabloları listeler.
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const { getSourceConfig } = require('./db.helper');

async function inspectTables() {
    let pool;
    const outputPath = path.resolve(__dirname, 'mssql_inspection_report.html');

    try {
        const config = getSourceConfig();
        console.log('\x1b[36m%s\x1b[0m', '------------------------------------------------------------');
        console.log('\x1b[36m%s\x1b[0m', `🚀 MSSQL Bağlantısı Başlatılıyor: ${config.server}`);
        console.log('\x1b[36m%s\x1b[0m', '------------------------------------------------------------\n');

        pool = await sql.connect(config);

        // Tüm tabloları alfabetik sırada al (AYAR_, A-F, Hastane, Hizmet ve log içerenleri hariç tut)
        /*const tablesResult = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE' 
            AND TABLE_SCHEMA = 'dbo'
            AND TABLE_NAME NOT LIKE 'AYAR_%'
            AND TABLE_NAME NOT LIKE '[A-F]%'
            AND TABLE_NAME NOT LIKE '%Hastane%'
            AND TABLE_NAME NOT LIKE '%Hizmet%'
            AND TABLE_NAME NOT LIKE '%log%'
            ORDER BY TABLE_NAME
        `);*/

        const tablesResult = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE' 
            AND TABLE_SCHEMA = 'dbo'
            AND TABLE_NAME LIKE 'hst%'
            OR TABLE_NAME LIKE 'lab%'
            ORDER BY TABLE_NAME
        `);

        const tables = tablesResult.recordset.map(r => r.TABLE_NAME);
        console.log(`🔍 Filtreleme sonrası ${tables.length} tablo taranıyor...\n`);

        let htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MSSQL Veritabanı İnceleme Raporu</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #4f46e5;
            --bg: #f8fafc;
            --card-bg: #ffffff;
            --text: #1e293b;
            --text-light: #64748b;
            --border: #e2e8f0;
        }
        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 40px 20px;
            line-height: 1.5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        header {
            margin-bottom: 40px;
            text-align: center;
        }
        h1 {
            color: var(--primary);
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        .stats {
            display: flex;
            gap: 20px;
            justify-content: center;
            margin-bottom: 30px;
        }
        .stat-card {
            background: var(--card-bg);
            padding: 15px 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            border: 1px solid var(--border);
        }
        .stat-value {
            display: block;
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--primary);
        }
        .stat-label {
            font-size: 0.875rem;
            color: var(--text-light);
        }
        .table-section {
            background: var(--card-bg);
            border-radius: 16px;
            border: 1px solid var(--border);
            margin-bottom: 40px;
            overflow: hidden;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
        }
        .table-header {
            padding: 20px 25px;
            background: #f1f5f9;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .table-name {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0;
            color: #0f172a;
        }
        .row-count {
            background: var(--primary);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .table-container {
            overflow-x: auto;
            max-height: 400px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
        }
        th {
            background: #f8fafc;
            text-align: left;
            padding: 12px 25px;
            font-weight: 600;
            color: var(--text-light);
            border-bottom: 2px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 10;
        }
        td {
            padding: 12px 25px;
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        tr:hover td {
            background-color: #f1f5f9;
        }
        .empty-state {
            text-align: center;
            padding: 20px;
            color: var(--text-light);
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🗄️ Veritabanı İnceleme Raporu</h1>
            <p>Sunucu: ${config.server} | Veritabanı: ${config.database}</p>
            <p>Filtrelenmiş tablolar ilk 5 kayıt ile listelenmiştir.</p>
        </header>

        <div class="stats">
            <div class="stat-card">
                <span class="stat-value" id="full-table-count">0</span>
                <span class="stat-label">Dolu Tablo Sayısı</span>
            </div>
        </div>

        <div id="report-content">`;

        let fullTableCount = 0;

        for (const tableName of tables) {
            try {
                const countResult = await pool.request().query(`SELECT COUNT(*) as count FROM [${tableName}]`);
                const rowCount = countResult.recordset[0].count;

                if (rowCount > 0) {
                    fullTableCount++;
                    process.stdout.write(`\r✅ Ekleniyor: ${tableName}`.padEnd(60));

                    const dataResult = await pool.request().query(`SELECT TOP 5 * FROM [${tableName}]`);
                    const rows = dataResult.recordset;

                    htmlContent += `
        <section class="table-section">
            <div class="table-header">
                <h2 class="table-name">${tableName}</h2>
                <span class="row-count">${rowCount.toLocaleString('tr-TR')} Satır</span>
            </div>
            <div class="table-container">`;

                    if (rows.length > 0) {
                        const columns = Object.keys(rows[0]);
                        htmlContent += `
                <table>
                    <thead>
                        <tr>
                            ${columns.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => `
                            <tr>
                                ${columns.map(col => {
                            let val = row[col];
                            if (val instanceof Date) val = val.toISOString();
                            if (val === null) val = '<i style="color:#cbd5e1">null</i>';
                            return `<td>${val}</td>`;
                        }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
                    } else {
                        htmlContent += `<div class="empty-state">Veri okunamadı.</div>`;
                    }

                    htmlContent += `
            </div>
        </section>`;
                }
            } catch (tableErr) {
                // Sessiz geç
            }
        }

        htmlContent += `
        </div>
    </div>
    <script>
        document.getElementById('full-table-count').innerText = '${fullTableCount}';
    </script>
</body>
</html>`;

        fs.writeFileSync(outputPath, htmlContent);

        console.log('\n\n\x1b[36m%s\x1b[0m', '------------------------------------------------------------');
        console.log('\x1b[32m%s\x1b[0m', `✅ Rapor hazır: ${fullTableCount} dolu tablo eklendi.`);
        console.log('\x1b[36m%s\x1b[0m', `📍 Dosya: ${outputPath}`);
        console.log('\x1b[36m%s\x1b[0m', '------------------------------------------------------------');

    } catch (err) {
        console.error('\n\x1b[31m%s\x1b[0m', '🛑 Hata:');
        console.error(err.message);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

inspectTables();
