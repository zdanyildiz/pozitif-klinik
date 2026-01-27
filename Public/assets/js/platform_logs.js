/**
 * Pozitif Klinik - Platform Log Görüntüleme Scripti
 */

// Token Kontrolü
const token = localStorage.getItem('platform_token');
const userType = localStorage.getItem('user_type');

if (!token || userType !== 'platform_admin') {
    window.location.href = API_URL + '/platform/login';
}

// DOM Elements
const logBody = document.getElementById('logBody');
const logCountEl = document.getElementById('logCount');
const logDateSelect = document.getElementById('logDateSelect');
const logLevelSelect = document.getElementById('logLevelSelect');
const logSearchInput = document.getElementById('logSearchInput');
const refreshLogsBtn = document.getElementById('refreshLogsBtn');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const expandAllBtn = document.getElementById('expandAllBtn');
const logoutBtn = document.getElementById('logoutBtn');

// State
let logsState = [];
let isAllExpanded = false;

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    setupEventListeners();
    await loadAvailableDates();
    await loadLogs();
}

function setupEventListeners() {
    refreshLogsBtn.addEventListener('click', loadLogs);

    logDateSelect.addEventListener('change', loadLogs);
    logLevelSelect.addEventListener('change', loadLogs);

    // Debounced Search
    let searchTimeout;
    logSearchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadLogs, 500);
    });

    clearSearchBtn.addEventListener('click', () => {
        logSearchInput.value = '';
        logLevelSelect.value = 'ALL';
        // logDateSelect unchanged to keep current day usually
        loadLogs();
    });

    expandAllBtn.addEventListener('click', toggleExpandAll);

    logoutBtn.addEventListener('click', handleLogout);
}

/**
 * Mevcut log tarihlerini yükle
 */
async function loadAvailableDates() {
    try {
        const response = await api.get('/platform-admin/logs/available-dates');
        const dates = response.data || [];

        if (dates.length > 0) {
            logDateSelect.innerHTML = '';
            dates.forEach(date => {
                const option = document.createElement('option');
                option.value = date;
                option.textContent = formatDateLabel(date);
                logDateSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Log tarihleri yüklenemedi:', error);
    }
}

/**
 * Logları yükle
 */
async function loadLogs() {
    renderLoading();

    const params = {
        date: logDateSelect.value,
        level: logLevelSelect.value,
        search: logSearchInput.value.trim()
    };

    try {
        const response = await api.get('/platform-admin/logs', { params });
        logsState = response.data.logs || [];

        renderLogs(logsState);
        logCountEl.textContent = `${logsState.length} kayıt`;

    } catch (error) {
        console.error('Loglar yüklenemedi:', error);
        renderError('Loglar getirilirken bir hata oluştu.');
    }
}

/**
 * Logları render et
 */
function renderLogs(logs) {
    if (logs.length === 0) {
        logBody.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-search text-secondary fs-1"></i>
                <p class="text-secondary mt-3">Kayıt bulunamadı.</p>
            </div>
        `;
        return;
    }

    logBody.innerHTML = '';
    logs.forEach((log, index) => {
        const entry = createLogEntry(log, index);
        logBody.appendChild(entry);

        const details = createLogDetails(log, index);
        logBody.appendChild(details);
    });
}

function createLogEntry(log, index) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.dataset.index = index;

    const levelClass = getLevelClass(log.level);
    const time = formatLogTime(log.timestamp);

    div.innerHTML = `
        <div class="log-time">${time}</div>
        <div class="log-level ${levelClass}">${log.level}</div>
        <div class="log-message">${escapeHtml(log.message)}</div>
    `;

    div.addEventListener('click', () => {
        div.classList.toggle('expanded');
    });

    return div;
}

function createLogDetails(log, index) {
    const div = document.createElement('div');
    div.className = 'log-details';
    div.id = `details-${index}`;

    let content = '<strong>Context:</strong><br>';
    content += `<pre class="mt-2 mb-3 text-info">${JSON.stringify(log.context, null, 2)}</pre>`;

    if (log.extra && Object.keys(log.extra).length > 0) {
        content += '<strong>Extra:</strong><br>';
        content += `<pre class="mt-2 text-warning">${JSON.stringify(log.extra, null, 2)}</pre>`;
    }

    if (log.context && log.context.trace) {
        content += '<strong class="text-danger">Stack Trace:</strong><br>';
        content += `<pre class="mt-2" style="color: #f87171; white-space: pre-wrap; font-size: 0.75rem;">${escapeHtml(log.context.trace)}</pre>`;
    }

    div.innerHTML = content;
    return div;
}

function toggleExpandAll() {
    isAllExpanded = !isAllExpanded;
    const entries = document.querySelectorAll('.log-entry');
    entries.forEach(entry => {
        if (isAllExpanded) {
            entry.classList.add('expanded');
        } else {
            entry.classList.remove('expanded');
        }
    });
    expandAllBtn.textContent = isAllExpanded ? 'Hepsini Kapat' : 'Hepsini Aç';
}

function renderLoading() {
    logBody.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="text-secondary mt-3">Loglar yükleniyor...</p>
        </div>
    `;
}

function renderError(msg) {
    logBody.innerHTML = `
        <div class="text-center py-5">
            <i class="bi bi-exclamation-triangle text-danger fs-1"></i>
            <p class="text-danger mt-3">${msg}</p>
            <button class="btn btn-sm btn-outline-danger mt-2" onclick="loadLogs()">Yeniden Dene</button>
        </div>
    `;
}

// Helpers
function getLevelClass(level) {
    level = level.toUpperCase();
    if (level.includes('ERROR') || level.includes('CRITICAL') || level.includes('ALERT') || level.includes('EMERGENCY')) return 'level-error';
    if (level.includes('WARNING')) return 'level-warning';
    if (level.includes('INFO')) return 'level-info';
    if (level.includes('DEBUG')) return 'level-debug';
    return '';
}

function formatLogTime(ts) {
    // [2026-01-27T16:26:06.824923+01:00]
    try {
        const date = new Date(ts);
        return date.toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    } catch (e) {
        return ts;
    }
}

function formatDateLabel(dateStr) {
    const date = new Date(dateStr);
    const today = new Date().toISOString().split('T')[0];
    const label = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return dateStr === today ? `Bugün (${label})` : label;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function handleLogout() {
    const result = await Swal.fire({
        icon: 'question',
        title: 'Çıkış Yap',
        text: 'Oturumunuzu kapatmak istediğinize emin misiniz?',
        showCancelButton: true,
        confirmButtonText: 'Evet, Çıkış Yap',
        cancelButtonText: 'İptal',
        confirmButtonColor: '#dc2626'
    });

    if (result.isConfirmed) {
        localStorage.removeItem('platform_token');
        localStorage.removeItem('user_type');
        window.location.href = API_URL + '/platform/login';
    }
}
