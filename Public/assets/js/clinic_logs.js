document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('logsTableBody');
    const filterForm = document.getElementById('filterForm');
    const pagination = document.getElementById('pagination');
    let currentPage = 1;

    // Detay Modal
    const detailModal = new bootstrap.Modal(document.getElementById('logDetailModal'));
    const oldValuesInfo = document.getElementById('oldValuesInfo');
    const newValuesInfo = document.getElementById('newValuesInfo');
    const metaInfo = document.getElementById('metaInfo');

    // İlk yükleme
    loadLogs();

    // Filtreleme
    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        currentPage = 1;
        loadLogs();
    });

    async function loadLogs(page = 1) {
        currentPage = page;

        // Filtre değerlerini al
        const module = document.getElementById('moduleFilter').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        // Query string oluştur
        const params = new URLSearchParams({
            page: page,
            limit: 30
        });

        if (module) params.append('module', module);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-muted">
                    <div class="spinner-border text-primary" role="status"></div>
                    <div class="mt-2">Yükleniyor...</div>
                </td>
            </tr>
        `;

        try {
            // "api" nesnesi config.js'den gelir ve BaseURL + Token otomatik eklenir.
            // Endpoint: /api/logs
            const response = await api.get('/api/logs', { params: params });

            if (response.status) {
                // api interceptor response.data döndürüyor olabilir, kontrol et
                // config.js'de: status === true ise return response.data diyor.
                // bu durumda response değişkeni direkt { status: true, data: { logs: ... } } olacaktır.

                renderTable(response.data.logs);
                renderPagination(response.data.pagination);
            } else {
                // Interceptor error fırlatacağı için buraya düşmeyebilir ama güvenlik için
                Utils.showError('Kayıtlar yüklenemedi.');
            }
        } catch (error) {
            // Config.js'deki interceptor mesajı string olarak reject ediyor
            Utils.showError(typeof error === 'string' ? error : 'Veri yüklenirken hata oluştu');
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">Veri yüklenirken hata oluştu.</td></tr>';
        }
    }

    function renderTable(logs) {
        if (!logs || logs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Kayıt bulunamadı.</td></tr>';
            return;
        }

        tableBody.innerHTML = logs.map(log => `
            <tr>
                <td class="ps-4">
                    <span class="d-block fw-medium">${formatDate(log.created_at)}</span>
                    <span class="small text-muted">${formatTime(log.created_at)}</span>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-sm bg-light rounded-circle me-2 d-flex align-items-center justify-content-center text-primary">
                            <i class="bi bi-person-fill"></i>
                        </div>
                        <div>
                            <div class="fw-medium">${log.user_name || 'Sistem'}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge bg-light text-dark border">
                        ${getModuleBadge(log.module)}
                    </span>
                </td>
                <td>
                    <span class="fw-medium text-dark">${formatAction(log.action)}</span>
                </td>
                <td class="text-muted small">
                    ${log.description || '-'}
                </td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-primary" onclick="showDetail(${log.id})">
                        <i class="bi bi-eye"></i>
                    </button>
                    <!-- Detay verisini sakla -->
                    <div id="log-data-${log.id}" class="d-none">
                        ${JSON.stringify(log)}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function renderPagination(meta) { // meta: {current_page, last_page, ...}
        if (meta.last_page <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let html = '';

        // Önceki Sayfa
        html += `
            <li class="page-item ${meta.current_page === 1 ? 'disabled' : ''}">
                <button class="page-link" onclick="changePage(${meta.current_page - 1})">
                    <i class="bi bi-chevron-left"></i>
                </button>
            </li>
        `;

        // Sayfa Numaraları (Basit versiyon: 1..N hepsini göster veya kısalt)
        // Şimdilik max 5 sayfa gösterelim, daha karmaşık logic gerekirse ekleriz.
        for (let i = 1; i <= meta.last_page; i++) {
            // Sadece aktif sayfanın etrafını göster (basitlik için +-2 range)
            if (i === 1 || i === meta.last_page || (i >= meta.current_page - 2 && i <= meta.current_page + 2)) {
                html += `
                    <li class="page-item ${i === meta.current_page ? 'active' : ''}">
                        <button class="page-link" onclick="changePage(${i})">${i}</button>
                    </li>
                `;
            }
        }

        // Sonraki Sayfa
        html += `
            <li class="page-item ${meta.current_page === meta.last_page ? 'disabled' : ''}">
                <button class="page-link" onclick="changePage(${meta.current_page + 1})">
                    <i class="bi bi-chevron-right"></i>
                </button>
            </li>
        `;

        pagination.innerHTML = html;
    }

    // Global fonksiyonlar
    window.changePage = (page) => {
        loadLogs(page);
    };

    window.showDetail = (id) => {
        const dataDiv = document.getElementById(`log-data-${id}`);
        if (!dataDiv) return;

        const log = JSON.parse(dataDiv.textContent);

        oldValuesInfo.textContent = log.old_values ? JSON.stringify(JSON.parse(log.old_values), null, 2) : '-';
        newValuesInfo.textContent = log.new_values ? JSON.stringify(JSON.parse(log.new_values), null, 2) : '-';

        metaInfo.innerHTML = `
            <strong>IP Adresi:</strong> ${log.ip_address || 'Bilinmiyor'} <span class="mx-2">|</span>
            <strong>Kayıt ID:</strong> #${log.record_id} (${log.record_type})
        `;

        detailModal.show();
    };

    // Yardımcılar
    function formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('tr-TR');
    }

    function formatTime(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }

    function getModuleBadge(module) {
        switch (module) {
            case 'PATIENT': return 'Hasta ve Muayene';
            case 'APPOINTMENT': return 'Randevu Takvimi';
            case 'FINANCE': return 'Finans / Kasa';
            default: return module;
        }
    }

    function formatAction(action) {
        // Okunabilir formata çevir
        return action
            .replace('APPOINTMENT_', '')
            .replace('PATIENT_', '')
            .replace(/_/g, ' ');
    }
});
