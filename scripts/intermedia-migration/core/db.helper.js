/**
 * Pozitif Klinik - Merkezi Veritabanı Konfigürasyon Yardımcısı
 * 
 * Kullanım:
 *   const { getSourceConfig, getTargetConfig, getMigrationConfig } = require('./db.helper');
 *   
 *   // MSSQL bağlantısı için
 *   const mssqlPool = await sql.connect(getSourceConfig());
 *   
 *   // MySQL bağlantısı için
 *   const mysqlConn = await mysql.createConnection(getTargetConfig());
 */

const path = require('path');
const fs = require('fs');

// Config dosyasını yükle
const configPath = path.resolve(__dirname, 'db.config.json');
let config;

try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
    console.error('❌ db.config.json dosyası bulunamadı veya okunamadı!');
    console.error('   Beklenen konum:', configPath);
    process.exit(1);
}

/**
 * Kaynak (MSSQL) veritabanı konfigürasyonunu döndürür
 * @param {object} overrides - Üzerine yazılacak ayarlar (opsiyonel)
 * @returns {object} MSSQL config objesi
 */
function getSourceConfig(overrides = {}) {
    const source = config.source;
    return {
        user: overrides.user || source.user,
        password: overrides.password || source.password,
        server: overrides.server || source.server,
        database: overrides.database || source.database,
        port: overrides.port || source.port,
        options: {
            encrypt: source.options?.encrypt ?? false,
            trustServerCertificate: source.options?.trustServerCertificate ?? true,
            requestTimeout: 300000,
            ...overrides.options
        }
    };
}

/**
 * Hedef (MySQL) veritabanı konfigürasyonunu döndürür
 * Environment variable'lar config'den önceliklidir:
 *   DB_TARGET_HOST, DB_TARGET_USER, DB_TARGET_PASSWORD, DB_TARGET_DATABASE
 * @param {object} overrides - Üzerine yazılacak ayarlar (opsiyonel)
 * @returns {object} MySQL config objesi
 */
function getTargetConfig(overrides = {}) {
    const target = config.target;
    return {
        host: overrides.host || process.env.DB_TARGET_HOST || target.host,
        user: overrides.user || process.env.DB_TARGET_USER || target.user,
        password: overrides.password || process.env.DB_TARGET_PASSWORD || target.password,
        database: overrides.database || process.env.DB_TARGET_DATABASE || target.database,
        charset: overrides.charset || target.charset || 'utf8mb4',
        ...overrides
    };
}

/**
 * Migration ayarlarını döndürür
 * @returns {object} Migration config objesi
 */
function getMigrationConfig() {
    return {
        clinicId: config.migration?.clinic_id || 1,
        batchSize: config.migration?.batch_size || 100,
        dataOutputPath: path.resolve(__dirname, config.migration?.data_output_path || './data/migration_data.json')
    };
}

/**
 * Şifreleme anahtarını döndürür
 * Önce .env dosyasından, yoksa config'den okur
 * @returns {string} APP_KEY (64 karakter hex)
 */
function getAppKey() {
    // Önce environment variable kontrol et
    if (process.env.APP_KEY) {
        return process.env.APP_KEY;
    }
    // Fallback: Config dosyasından oku (sadece development için)
    return config.encryption?.app_key;
}

/**
 * Tüm konfigürasyonu döndürür
 * @returns {object} Tüm config objesi
 */
function getFullConfig() {
    return {
        source: getSourceConfig(),
        target: getTargetConfig(),
        migration: getMigrationConfig(),
        appKey: getAppKey()
    };
}

// Modül export
module.exports = {
    getSourceConfig,
    getTargetConfig,
    getMigrationConfig,
    getAppKey,
    getFullConfig,
    // Ham config erişimi (debug için)
    _rawConfig: config
};
