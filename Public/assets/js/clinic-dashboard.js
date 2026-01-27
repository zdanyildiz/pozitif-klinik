/**
 * Pozitif Klinik - Clinic Dashboard Scripts
 */

// Authentication is handled server-side via SessionAuthMiddleware.
// No client-side token check needed for SSR pages.

// Global state
let users = [];

// DOM Elements
const usersTableBody = document.getElementById('usersTableBody');
const newUserForm = document.getElementById('newUserForm');
const saveUserBtn = document.getElementById('saveUserBtn');
const logoutBtn = document.getElementById('logoutBtn');
const btnAddUser = document.getElementById('btnAddUser');
const updateUserBtn = document.getElementById('updateUserBtn');

// Stats Elements
const totalUsersCountEl = document.getElementById('totalUsersCount');
const doctorCountEl = document.getElementById('doctorCount');
const secretaryCountEl = document.getElementById('secretaryCount');

// Modal
let newUserModal;
let editUserModal; // Add this line

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    newUserModal = new bootstrap.Modal(document.getElementById('newUserModal'));
    editUserModal = new bootstrap.Modal(document.getElementById('editUserModal')); // Initialize editUserModal

    // Kullanıcı bilgilerini göster
    const fullName = localStorage.getItem('user_full_name');
    const role = localStorage.getItem('user_role');
    const roleText = role === 'admin' ? 'Yönetici' : (role === 'doctor' ? 'Doktor' : 'Sekreter');

    if (document.getElementById('userName')) document.getElementById('userName').textContent = fullName || 'Klinik Personeli';
    if (document.getElementById('userRole')) document.getElementById('userRole').textContent = roleText;

    loadUsers();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Modal Aç
    btnAddUser.addEventListener('click', () => {
        newUserModal.show();
    });

    // Yeni Personel Kaydet
    saveUserBtn.addEventListener('click', handleSaveUser);

    // Personel Güncelle
    document.getElementById('updateUserBtn').addEventListener('click', handleUpdateUser);

    // Çıkış Yap
    logoutBtn.addEventListener('click', handleLogout);
}

// Personelleri Yükle
async function loadUsers() {
    try {
        const result = await api.get('/api/users');
        // Backend {count: X, users: [...]} şeklinde bir obje dönüyor
        users = result.data?.users || [];

        // Stats güncelle
        totalUsersCountEl.textContent = users.length;
        doctorCountEl.textContent = users.filter(u => u.role === 'doctor').length;
        secretaryCountEl.textContent = users.filter(u => u.role === 'secretary').length;

        usersTableBody.innerHTML = '';

        if (users.length === 0) {
            renderEmptyState();
            return;
        }

        // Personelleri tabloya ekle
        users.forEach(user => renderUserRow(user));

    } catch (error) {
        console.error('Personel yüklenirken hata:', error);
        renderErrorState();
    }
}

// Personel satırı oluştur
function renderUserRow(user) {
    const isActive = user.is_active === 1 || user.is_active === '1' || user.is_active === true;
    const statusClass = isActive ? 'active' : 'inactive';
    const statusText = isActive ? 'Aktif' : 'Pasif';
    const statusIcon = isActive ? 'bi-check-circle-fill' : 'bi-x-circle-fill';

    // Rol Badge
    const roleMap = {
        'admin': { text: 'Yönetici', class: 'bg-danger' },
        'doctor': { text: 'Doktor', class: 'bg-primary' },
        'secretary': { text: 'Sekreter', class: 'bg-info' }
    };
    const roleInfo = roleMap[user.role] || { text: user.role, class: 'bg-secondary' };

    const row = document.createElement('tr');
    row.innerHTML = `
        <td><strong>#${user.id}</strong></td>
        <td><span class="user-full-name">${escapeHtml(user.name || '-')}</span></td>
        <td><span class="clinic-name text-secondary">${escapeHtml(user.username)}</span></td>
        <td>
            <span class="badge ${roleInfo.class} px-3 py-2 rounded-3">
                ${roleInfo.text}
            </span>
        </td>
        <td>
            <span class="status-badge ${statusClass}">
                <i class="bi ${statusIcon}"></i>
                ${statusText}
            </span>
        </td>
        <td class="date-cell">${Utils.formatDate(user.created_at)}</td>
        <td class="text-end">
            <button class="btn btn-sm btn-outline-primary me-2" onclick="handleEditUser(${user.id})">
                <i class="bi bi-pencil"></i> Düzenle
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteUser(${user.id}, '${escapeHtml(user.username)}')">
                <i class="bi bi-trash"></i> Sil
            </button>
        </td>
    `;
    usersTableBody.appendChild(row);
}

// Personel Kaydet
async function handleSaveUser() {
    const data = {
        name: document.getElementById('newName').value.trim(),
        username: document.getElementById('newUsername').value.trim(),
        password: document.getElementById('newPassword').value,
        role: document.getElementById('newRole').value
    };

    if (!data.name || !data.username || !data.password || !data.role) {
        Utils.showError('Lütfen tüm alanları doldurun.');
        return;
    }

    saveUserBtn.disabled = true;
    saveUserBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Kaydediliyor...';

    try {
        await api.post('/api/users', data);

        newUserModal.hide();
        newUserForm.reset();

        await Swal.fire({
            icon: 'success',
            title: 'Başarılı!',
            text: 'Personel kaydı oluşturuldu.',
            timer: 2000,
            showConfirmButton: false
        });

        loadUsers();

    } catch (error) {
        console.error('Personel eklenirken hata:', error);
        Utils.showError(typeof error === 'string' ? error : 'İşlem başarısız.');
    } finally {
        saveUserBtn.disabled = false;
        saveUserBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Kaydet';
    }
}

// Personel Düzenle (Modal Doldurma)
window.handleEditUser = function (userId) {
    const user = users.find(u => u.id === userId);
    if (!user) {
        console.error('User not found for editing:', userId);
        Utils.showError('Personel bulunamadı.');
        return;
    }

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editName').value = user.name || ''; // null kontrolü
    document.getElementById('editUsername').value = user.username || '';
    document.getElementById('editRole').value = user.role || 'secretary';
    document.getElementById('editStatus').value = (user.is_active === 1 || user.is_active === '1' || user.is_active === true) ? 'active' : 'inactive';
    document.getElementById('editPassword').value = ''; // Clear password field for security

    editUserModal.show();
}

// Personel Güncelle (API Çağrısı)
async function handleUpdateUser() {
    const updateUserBtn = document.getElementById('updateUserBtn');
    const userId = document.getElementById('editUserId').value;
    const data = {
        name: document.getElementById('editName').value.trim(),
        username: document.getElementById('editUsername').value.trim(),
        role: document.getElementById('editRole').value,
        is_active: document.getElementById('editStatus').value === 'active' ? 1 : 0
    };

    const password = document.getElementById('editPassword').value;
    if (password) {
        data.password = password;
    }

    if (!data.name || !data.username || !data.role) {
        Utils.showError('Lütfen tüm gerekli alanları doldurun.');
        return;
    }

    updateUserBtn.disabled = true;
    updateUserBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Güncelleniyor...';

    try {
        await api.put(`/api/users/${userId}`, data);

        editUserModal.hide();
        // Clear the password field explicitly after successful update
        document.getElementById('editPassword').value = '';

        await Swal.fire({
            icon: 'success',
            title: 'Başarılı!',
            text: 'Personel bilgileri güncellendi.',
            timer: 2000,
            showConfirmButton: false
        });

        loadUsers();

    } catch (error) {
        console.error('Personel güncellenirken hata:', error);
        Utils.showError(typeof error === 'string' ? error : 'Güncelleme işlemi başarısız.');
    } finally {
        updateUserBtn.disabled = false;
        updateUserBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Güncelle';
    }
}

// Personel Sil
window.handleDeleteUser = async function (id, username) {
    const result = await Swal.fire({
        icon: 'warning',
        title: 'Emin misiniz?',
        text: `${username} personeli silinecek. Bu işlem geri alınamaz!`,
        showCancelButton: true,
        confirmButtonText: 'Evet, Sil',
        cancelButtonText: 'İptal',
        confirmButtonColor: '#dc2626'
    });

    if (result.isConfirmed) {
        try {
            await api.delete(`/api/users/${id}`);
            Utils.showSuccess('Personel silindi.');
            loadUsers();
        } catch (error) {
            Utils.showError(typeof error === 'string' ? error : 'Silme işlemi başarısız.');
        }
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
        window.location.href = API_URL + '/admin/login';
    }
}

// Helper: Boş durum
function renderEmptyState() {
    usersTableBody.innerHTML = `
        <tr>
            <td colspan="6">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="bi bi-people"></i>
                    </div>
                    <h5>Henüz personel bulunmuyor</h5>
                    <p>Klinik personelini eklemek için "Yeni Personel Ekle" butonuna tıklayın.</p>
                </div>
            </td>
        </tr>
    `;
}

// Helper: Hata durum
function renderErrorState() {
    usersTableBody.innerHTML = `
        <tr>
            <td colspan="6">
                <div class="empty-state">
                    <div class="empty-state-icon error">
                        <i class="bi bi-exclamation-triangle"></i>
                    </div>
                    <h5>Veriler yüklenemedi</h5>
                    <button class="btn-add" onclick="loadUsers()">
                        <i class="bi bi-arrow-clockwise"></i> Yeniden Dene
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// XSS Koruması
function escapeHtml(text) {
    if (typeof text !== 'string') {
        return '';
    }
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
