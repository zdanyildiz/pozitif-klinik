/**
 * Pozitif Klinik - Hizmet Tanımları Sayfası
 * services.js
 */

document.addEventListener('DOMContentLoaded', () => {
    initServices();
});

// Global state
let allServices = [];
let categories = [];
let serviceModal, deleteModal;

/**
 * Sayfa başlangıç işlemleri
 */
async function initServices() {
    // Modal instances
    serviceModal = new bootstrap.Modal(document.getElementById('serviceModal'));
    deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));

    // Event listeners
    setupEventListeners();

    // Load initial data
    await Promise.all([
        loadStats(),
        loadServices(),
        loadCategories()
    ]);
}

/**
 * Event listener'ları ayarla
 */
function setupEventListeners() {
    // New service button
    document.getElementById('btnNewService').addEventListener('click', () => openServiceModal());

    // Save service button
    document.getElementById('saveServiceBtn').addEventListener('click', saveService);

    // Delete confirmation button
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);

    // Search input (debounced)
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => filterServices(), 300);
    });

    // Category filter
    document.getElementById('categoryFilter').addEventListener('change', filterServices);

    // Show inactive checkbox
    document.getElementById('showInactive').addEventListener('change', loadServices);

    // Form submit prevention
    document.getElementById('serviceForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveService();
    });
}

/**
 * İstatistikleri yükle
 */
async function loadStats() {
    try {
        const response = await api.get('/api/services/stats');
        // api interceptor zaten response.data döndürüyor, yani response = {status, message, data}
        if (response.status) {
            const stats = response.data;
            document.getElementById('totalServices').textContent = stats.total || 0;
            document.getElementById('activeServices').textContent = stats.active || 0;
            document.getElementById('categoryCount').textContent = stats.category_count || 0;
        }
    } catch (error) {
        console.error('Stats yüklenirken hata:', error);
    }
}

/**
 * Hizmetleri yükle
 */
async function loadServices() {
    const tableBody = document.getElementById('servicesTableBody');
    const emptyState = document.getElementById('emptyState');
    const tableCard = document.querySelector('.table-card');
    const showInactive = document.getElementById('showInactive').checked;

    tableBody.innerHTML = `
        <tr id="loadingRow">
            <td colspan="7">
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Hizmetler yükleniyor...</p>
                </div>
            </td>
        </tr>
    `;

    try {
        const url = showInactive
            ? '/api/services?includeInactive=1'
            : '/api/services';

        const response = await api.get(url);

        if (response.status) {
            allServices = response.data || [];

            if (allServices.length === 0) {
                tableCard.classList.add('d-none');
                emptyState.classList.remove('d-none');
            } else {
                tableCard.classList.remove('d-none');
                emptyState.classList.add('d-none');
                renderServices(allServices);
            }

            // Refresh stats
            loadStats();
        }
    } catch (error) {
        console.error('Hizmetler yüklenirken hata:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Hizmetler yüklenirken bir hata oluştu.
                </td>
            </tr>
        `;
    }
}

/**
 * Kategorileri yükle
 */
async function loadCategories() {
    try {
        const response = await api.get('/api/services/categories');
        if (response.status) {
            categories = response.data || [];
            updateCategoryFilters();
        }
    } catch (error) {
        console.error('Kategoriler yüklenirken hata:', error);
    }
}

/**
 * Kategori dropdown'larını güncelle
 */
function updateCategoryFilters() {
    // Filter dropdown
    const filterSelect = document.getElementById('categoryFilter');
    filterSelect.innerHTML = '<option value="">Tüm Kategoriler</option>';
    categories.forEach(cat => {
        filterSelect.innerHTML += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
    });

    // Datalist for form
    const datalist = document.getElementById('categoryList');
    datalist.innerHTML = '';
    categories.forEach(cat => {
        datalist.innerHTML += `<option value="${escapeHtml(cat)}">`;
    });
}

/**
 * Hizmetleri tabloda görüntüle
 */
function renderServices(services) {
    const tableBody = document.getElementById('servicesTableBody');

    if (services.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    <i class="bi bi-search me-2"></i>
                    Arama kriterlerine uygun hizmet bulunamadı.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = services.map(service => `
        <tr data-id="${service.id}">
            <td>
                ${service.code
            ? `<span class="service-code">${escapeHtml(service.code)}</span>`
            : '<span class="text-muted">-</span>'}
            </td>
            <td>
                <div class="fw-semibold">${escapeHtml(service.name)}</div>
                ${service.description
            ? `<div class="text-muted small text-truncate" style="max-width: 300px;">${escapeHtml(service.description)}</div>`
            : ''}
            </td>
            <td>
                ${service.category
            ? `<span class="category-badge">${escapeHtml(service.category)}</span>`
            : '<span class="text-muted">-</span>'}
            </td>
            <td class="text-end">
                <span class="price-display">${formatCurrency(service.price)}</span>
            </td>
            <td class="text-end">
                <span class="tax-rate">%${parseFloat(service.tax_rate || 0).toFixed(0)}</span>
            </td>
            <td class="text-center">
                ${service.is_active == 1
            ? '<span class="status-badge active"><i class="bi bi-check-circle-fill"></i> Aktif</span>'
            : '<span class="status-badge inactive"><i class="bi bi-x-circle-fill"></i> Pasif</span>'}
            </td>
            <td class="text-end">
                <button class="btn-action btn-edit me-1" onclick="editService(${service.id})" title="Düzenle">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn-action btn-delete" onclick="openDeleteModal(${service.id}, '${escapeHtml(service.name).replace(/'/g, "\\'")}')" title="Sil">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Hizmetleri filtrele
 */
function filterServices() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const categoryFilter = document.getElementById('categoryFilter').value;

    let filtered = allServices;

    // Search filter
    if (searchTerm) {
        filtered = filtered.filter(service =>
            (service.name && service.name.toLowerCase().includes(searchTerm)) ||
            (service.code && service.code.toLowerCase().includes(searchTerm)) ||
            (service.description && service.description.toLowerCase().includes(searchTerm))
        );
    }

    // Category filter
    if (categoryFilter) {
        filtered = filtered.filter(service => service.category === categoryFilter);
    }

    renderServices(filtered);
}

/**
 * Hizmet modal'ını aç (yeni veya düzenleme)
 */
function openServiceModal(service = null) {
    const form = document.getElementById('serviceForm');
    const titleEl = document.getElementById('modalTitle');

    form.reset();
    document.getElementById('serviceId').value = '';
    document.getElementById('serviceTaxRate').value = '20'; // Default KDV
    document.getElementById('serviceActive').checked = true;

    if (service) {
        titleEl.textContent = 'Hizmet Düzenle';
        document.getElementById('serviceId').value = service.id;
        document.getElementById('serviceName').value = service.name || '';
        document.getElementById('serviceCode').value = service.code || '';
        document.getElementById('serviceCategory').value = service.category || '';
        document.getElementById('servicePrice').value = service.price || 0;
        document.getElementById('serviceTaxRate').value = service.tax_rate || 0;
        document.getElementById('serviceDescription').value = service.description || '';
        document.getElementById('serviceActive').checked = service.is_active == 1;
    } else {
        titleEl.textContent = 'Yeni Hizmet Ekle';
    }

    serviceModal.show();
}

/**
 * Hizmeti düzenle
 */
async function editService(serviceId) {
    const service = allServices.find(s => s.id == serviceId);
    if (service) {
        openServiceModal(service);
    } else {
        // Fetch from API if not in cache
        try {
            const response = await api.get(`/api/services/${serviceId}`);
            if (response.status) {
                openServiceModal(response.data);
            }
        } catch (error) {
            Swal.fire('Hata', 'Hizmet bilgileri alınamadı.', 'error');
        }
    }
}

/**
 * Hizmeti kaydet veya güncelle
 */
async function saveService() {
    const serviceId = document.getElementById('serviceId').value;
    const isEdit = !!serviceId;

    const data = {
        name: document.getElementById('serviceName').value.trim(),
        code: document.getElementById('serviceCode').value.trim() || null,
        category: document.getElementById('serviceCategory').value.trim() || null,
        price: parseFloat(document.getElementById('servicePrice').value) || 0,
        tax_rate: parseFloat(document.getElementById('serviceTaxRate').value) || 0,
        description: document.getElementById('serviceDescription').value.trim() || null,
        is_active: document.getElementById('serviceActive').checked ? 1 : 0
    };

    // Validation
    if (!data.name) {
        Swal.fire('Uyarı', 'Hizmet adı gereklidir.', 'warning');
        return;
    }

    try {
        const saveBtn = document.getElementById('saveServiceBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Kaydediliyor...';

        let response;
        if (isEdit) {
            response = await api.put(`/api/services/${serviceId}`, data);
        } else {
            response = await api.post('/api/services', data);
        }

        if (response.status) {
            serviceModal.hide();
            Swal.fire({
                icon: 'success',
                title: 'Başarılı',
                text: isEdit ? 'Hizmet güncellendi.' : 'Hizmet oluşturuldu.',
                timer: 1500,
                showConfirmButton: false
            });

            await loadServices();
            await loadCategories();
        } else {
            Swal.fire('Hata', response.message || 'İşlem başarısız.', 'error');
        }
    } catch (error) {
        console.error('Kaydetme hatası:', error);
        Swal.fire('Hata', error || 'Bir hata oluştu.', 'error');
    } finally {
        const saveBtn = document.getElementById('saveServiceBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Kaydet';
    }
}

/**
 * Silme modal'ını aç
 */
function openDeleteModal(serviceId, serviceName) {
    document.getElementById('deleteServiceId').value = serviceId;
    document.getElementById('deleteServiceName').textContent = serviceName;
    deleteModal.show();
}

/**
 * Silme işlemini onayla
 */
async function confirmDelete() {
    const serviceId = document.getElementById('deleteServiceId').value;

    try {
        const deleteBtn = document.getElementById('confirmDeleteBtn');
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

        const response = await api.delete(`/api/services/${serviceId}`);

        if (response.status) {
            deleteModal.hide();
            Swal.fire({
                icon: 'success',
                title: 'Silindi',
                text: 'Hizmet başarıyla silindi.',
                timer: 1500,
                showConfirmButton: false
            });

            await loadServices();
            await loadCategories();
        } else {
            Swal.fire('Hata', response.message || 'Silme işlemi başarısız.', 'error');
        }
    } catch (error) {
        console.error('Silme hatası:', error);
        Swal.fire('Hata', error || 'Bir hata oluştu.', 'error');
    } finally {
        const deleteBtn = document.getElementById('confirmDeleteBtn');
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="bi bi-trash me-1"></i> Sil';
    }
}

/**
 * Para birimi formatla
 */
function formatCurrency(value) {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2
    });
}

/**
 * HTML karakterlerini escape et
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

