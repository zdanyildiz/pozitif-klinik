/**
 * Pozitif Klinik - Admin Dashboard Scripts
 */

// Token Kontrolü
const token = localStorage.getItem('platform_token');
if (!token) {
    window.location.href = 'index.html';
}

// DOM Elements
const tenantsTableBody = document.getElementById('tenantsTableBody');
const newTenantForm = document.getElementById('newTenantForm');
const saveTenantBtn = document.getElementById('saveTenantBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Stats Elements
const totalClinicsEl = document.getElementById('totalClinics');
const activeClinicsEl = document.getElementById('activeClinics');

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

    // Çıkış Yap
    logoutBtn.addEventListener('click', handleLogout);
}

// Klinikleri Yükle
async function loadTenants() {
    try {
        const result = await api.get('/admin/tenants');
        const tenants = result.data || [];

        // Stats güncelle
        totalClinicsEl.textContent = tenants.length;
        const activeCount = tenants.filter(t => t.is_active === 1 || t.is_active === '1' || t.is_active === true).length;
        activeClinicsEl.textContent = activeCount;

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
    `;
    tenantsTableBody.appendChild(row);
}

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
        await api.post('/admin/tenants', data);

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
        window.location.href = 'index.html';
    }
}

// XSS Koruması için HTML escape
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
