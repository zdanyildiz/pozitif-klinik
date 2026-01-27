/**
 * Pozitif Klinik - Admin Dashboard Scripts
 */

// Token Kontrolü
const token = localStorage.getItem('platform_token');
const userType = localStorage.getItem('user_type');

if (!token || userType !== 'platform_admin') {
    window.location.href = API_URL + '/platform/login';
}

// DOM Elements
const tenantsTableBody = document.getElementById('tenantsTableBody');
const newTenantForm = document.getElementById('newTenantForm');
const saveTenantBtn = document.getElementById('saveTenantBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Stats Elements
const totalClinicsEl = document.getElementById('totalClinics');
const activeClinicsEl = document.getElementById('activeClinics');
const totalUsersEl = document.getElementById('totalUsers');

// Modal
let newTenantModal;

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    newTenantModal = new bootstrap.Modal(document.getElementById('newTenantModal'));
    loadTenants();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Yeni Klinik Kaydet
    saveTenantBtn.addEventListener('click', handleSaveTenant);

    // Klinik Güncelle
    document.getElementById('updateTenantBtn').addEventListener('click', handleUpdateTenant);

    // Çıkış Yap
    logoutBtn.addEventListener('click', handleLogout);
}

// Klinikleri Yükle
async function loadTenants() {
    try {
        const result = await api.get('/platform-admin/tenants');
        const tenants = result.data || [];

        // Stats güncelle
        totalClinicsEl.textContent = tenants.length;
        const activeCount = tenants.filter(t => t.is_active === 1 || t.is_active === '1' || t.is_active === true).length;
        activeClinicsEl.textContent = activeCount;

        // İstatistikleri ayrı yükle (veya tek endpoint'e çekilebilir)
        loadStats();

        // Loading'i kaldır
        tenantsTableBody.innerHTML = '';

        if (tenants.length === 0) {
            renderEmptyState();
            return;
        }

        // Klinikleri tabloya ekle
        tenants.forEach(tenant => renderTenantRow(tenant));

    } catch (error) {
        console.error('Klinikler yüklenirken hata:', error);
        renderErrorState();
    }
}

// Klinik satırı oluştur
function renderTenantRow(tenant) {
    const isActive = tenant.is_active === 1 || tenant.is_active === '1' || tenant.is_active === true;
    const statusClass = isActive ? 'active' : 'inactive';
    const statusText = isActive ? 'Aktif' : 'Pasif';
    const statusIcon = isActive ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
    const adminUsername = tenant.admin_username || '';

    const row = document.createElement('tr');
    row.innerHTML = `
        <td><strong>#${tenant.id}</strong></td>
        <td><span class="clinic-name">${escapeHtml(tenant.name)}</span></td>
        <td>
            <span class="domain-badge">
                <i class="bi bi-globe2"></i>
                ${escapeHtml(tenant.domain_prefix)}
            </span>
        </td>
        <td>
            <span class="status-badge ${statusClass}">
                <i class="bi ${statusIcon}"></i>
                ${statusText}
            </span>
        </td>
        <td class="date-cell">${Utils.formatDate(tenant.created_at)}</td>
        <td class="text-end">
            <div class="btn-group" role="group">
                <a href="${API_URL}/platform/clinic-settings?id=${tenant.id}" class="btn btn-sm btn-outline-secondary" title="Ayarlar">
                    <i class="bi bi-gear"></i>
                </a>
                <button class="btn btn-sm btn-outline-primary" onclick="openEditModal(${tenant.id}, '${escapeHtml(tenant.name)}', '${escapeHtml(tenant.domain_prefix)}', ${isActive}, '${escapeHtml(adminUsername)}')" title="Düzenle">
                    <i class="bi bi-pencil"></i>
                </button>
            </div>
        </td>
    `;
    tenantsTableBody.appendChild(row);
}

// ... (renderEmptyState, renderErrorState stay same)

// Edit Modal Aç
let editModal;
let currentEditId = null;

window.openEditModal = function (id, name, domainPrefix, isActive, adminUsername) {
    currentEditId = id;
    document.getElementById('editClinicName').value = name;
    document.getElementById('editClinicDomain').value = domainPrefix;
    document.getElementById('editClinicStatus').value = isActive ? "1" : "0";
    document.getElementById('editAdminUsername').value = adminUsername;
    document.getElementById('editAdminPassword').value = ''; // Şifre her zaman boş gelir

    if (!editModal) {
        editModal = new bootstrap.Modal(document.getElementById('editTenantModal'));
    }
    editModal.show();
}

// Klinik Güncelle
async function handleUpdateTenant() {
    const name = document.getElementById('editClinicName').value.trim();
    const isActive = document.getElementById('editClinicStatus').value;
    const adminUsername = document.getElementById('editAdminUsername').value.trim();
    const adminPassword = document.getElementById('editAdminPassword').value;

    if (!name) {
        Utils.showError('Klinik adı zorunludur.');
        return;
    }

    if (!adminUsername) {
        Utils.showError('Yönetici kullanıcı adı zorunludur.');
        return;
    }

    const btn = document.getElementById('updateTenantBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Güncelleniyor...';

    const payload = {
        name: name,
        is_active: isActive,
        admin_username: adminUsername
    };

    if (adminPassword) {
        payload.admin_password = adminPassword;
    }

    try {
        await api.put(`/platform-admin/tenants/${currentEditId}`, payload);

        editModal.hide();
        await Swal.fire({
            icon: 'success',
            title: 'Güncellendi',
            text: 'Klinik bilgileri başarıyla güncellendi.',
            timer: 1500,
            showConfirmButton: false
        });
        loadTenants();
    } catch (error) {
        console.error('Update error:', error);
        Utils.showError('Güncelleme sırasında bir hata oluştu.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Güncelle';
    }
}

// ... (handleSaveTenant, handleLogout, escapeHtml stay same)

// Boş durum göster
function renderEmptyState() {
    tenantsTableBody.innerHTML = `
        <tr>
            <td colspan="5">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="bi bi-building"></i>
                    </div>
                    <h5>Henüz klinik bulunmuyor</h5>
                    <p>İlk kliniğinizi oluşturmak için "Yeni Klinik Ekle" butonuna tıklayın.</p>
                    <button class="btn-add" data-bs-toggle="modal" data-bs-target="#newTenantModal">
                        <i class="bi bi-plus-lg"></i>
                        Yeni Klinik Ekle
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Hata durumu göster
function renderErrorState() {
    tenantsTableBody.innerHTML = `
        <tr>
            <td colspan="5">
                <div class="empty-state">
                    <div class="empty-state-icon error">
                        <i class="bi bi-exclamation-triangle"></i>
                    </div>
                    <h5>Veriler yüklenemedi</h5>
                    <p>Klinik listesi alınırken bir hata oluştu.</p>
                    <button class="btn-add" onclick="loadTenants()">
                        <i class="bi bi-arrow-clockwise"></i>
                        Yeniden Dene
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Yeni Klinik Kaydet
async function handleSaveTenant() {
    const data = {
        name: document.getElementById('clinicName').value.trim(),
        domain_prefix: document.getElementById('domainPrefix').value.trim().toLowerCase(),
        admin_username: document.getElementById('adminUsername').value.trim(),
        admin_password: document.getElementById('adminPassword').value
    };

    // Validasyon
    if (!data.name || !data.domain_prefix || !data.admin_username || !data.admin_password) {
        Utils.showError('Lütfen tüm alanları doldurun.');
        return;
    }

    // Domain prefix validasyonu (sadece küçük harf ve rakam)
    if (!/^[a-z0-9]+$/.test(data.domain_prefix)) {
        Utils.showError('Domain prefix sadece küçük harf ve rakam içerebilir.');
        return;
    }

    // Şifre uzunluğu kontrolü
    if (data.admin_password.length < 6) {
        Utils.showError('Şifre en az 6 karakter olmalıdır.');
        return;
    }

    // Butonu devre dışı bırak
    saveTenantBtn.disabled = true;
    saveTenantBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Kaydediliyor...';

    try {
        await api.post('/platform-admin/tenants', data);

        // Modal'ı kapat
        newTenantModal.hide();

        // Formu temizle
        newTenantForm.reset();

        // Başarı mesajı
        await Swal.fire({
            icon: 'success',
            title: 'Başarılı!',
            text: 'Klinik başarıyla oluşturuldu.',
            timer: 2000,
            showConfirmButton: false,
            timerProgressBar: true
        });

        // Tabloyu yenile
        loadTenants();

    } catch (error) {
        console.error('Klinik oluşturulurken hata:', error);

        // Interceptor hatayı string olarak fırlatıyor olabilir
        const errorMessage = typeof error === 'string' ? error : 'Klinik oluşturulamadı.';
        Utils.showError(errorMessage);
    } finally {
        saveTenantBtn.disabled = false;
        saveTenantBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Kaydet';
    }
}

// Çıkış Yap
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

// İstatistikleri Yükle
async function loadStats() {
    try {
        const result = await api.get('/platform-admin/tenants/stats');
        const stats = result.data;

        if (stats) {
            totalClinicsEl.textContent = stats.total_clinics;
            activeClinicsEl.textContent = stats.active_clinics;
            totalUsersEl.textContent = stats.total_users;
        }
    } catch (error) {
        console.error('İstatistikler yüklenirken hata:', error);
    }
}

// XSS Koruması için HTML escape
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
