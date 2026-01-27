/**
 * Pozitif Klinik - Platform Users Management
 */

// Token Control
const token = localStorage.getItem('platform_token');
const userType = localStorage.getItem('user_type');

if (!token || userType !== 'platform_admin') {
    window.location.href = API_URL + '/platform/login';
}

// DOM Elements
const usersTableBody = document.getElementById('usersTableBody');
const newUserForm = document.getElementById('newUserForm');
const saveUserBtn = document.getElementById('saveUserBtn');
const updateUserBtn = document.getElementById('updateUserBtn');
const logoutBtn = document.getElementById('logoutBtn');

let newUserModal;
let editUserModal;
let currentEditId = null;

// Page Load
document.addEventListener('DOMContentLoaded', () => {
    newUserModal = new bootstrap.Modal(document.getElementById('newUserModal'));
    editUserModal = new bootstrap.Modal(document.getElementById('editUserModal'));
    loadUsers();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    saveUserBtn.addEventListener('click', handleSaveUser);
    updateUserBtn.addEventListener('click', handleUpdateUser);
    logoutBtn.addEventListener('click', handleLogout);
}

// Load Users
async function loadUsers() {
    try {
        const result = await api.get('/platform-admin/users');
        const users = result.data || [];

        usersTableBody.innerHTML = '';

        if (users.length === 0) {
            renderEmptyState();
            return;
        }

        users.forEach(user => renderUserRow(user));

    } catch (error) {
        console.error('Kullanıcılar yüklenirken hata:', error);
        renderErrorState();
    }
}

// Render User Row
function renderUserRow(user) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><strong>#${user.id}</strong></td>
        <td><span class="fw-medium">${escapeHtml(user.username)}</span></td>
        <td class="text-secondary">${Utils.formatDate(user.created_at)}</td>
        <td class="text-end">
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary" onclick="openEditModal(${user.id}, '${escapeHtml(user.username)}')" title="Düzenle">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${user.id})" title="Sil">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </td>
    `;
    usersTableBody.appendChild(row);
}

// Open Edit Modal
window.openEditModal = function (id, username) {
    currentEditId = id;
    document.getElementById('editUsername').value = username;
    document.getElementById('editPassword').value = '';
    editUserModal.show();
};

// Handle Save User
async function handleSaveUser() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;

    if (!username || !password) {
        Utils.showError('Lütfen tüm alanları doldurun.');
        return;
    }

    saveUserBtn.disabled = true;
    saveUserBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Kaydediliyor...';

    try {
        await api.post('/platform-admin/users', { username, password });

        newUserModal.hide();
        newUserForm.reset();

        await Swal.fire({
            icon: 'success',
            title: 'Başarılı',
            text: 'Yeni yönetici başarıyla oluşturuldu.',
            timer: 1500,
            showConfirmButton: false
        });

        loadUsers();
    } catch (error) {
        const msg = typeof error === 'string' ? error : 'Kullanıcı oluşturulamadı.';
        Utils.showError(msg);
    } finally {
        saveUserBtn.disabled = false;
        saveUserBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Kaydet';
    }
}

// Handle Update User
async function handleUpdateUser() {
    const username = document.getElementById('editUsername').value.trim();
    const password = document.getElementById('editPassword').value;

    if (!username) {
        Utils.showError('Kullanıcı adı zorunludur.');
        return;
    }

    updateUserBtn.disabled = true;
    updateUserBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Güncelleniyor...';

    const payload = { username };
    if (password) payload.password = password;

    try {
        await api.put(`/platform-admin/users/${currentEditId}`, payload);

        editUserModal.hide();

        await Swal.fire({
            icon: 'success',
            title: 'Güncellendi',
            text: 'Kullanıcı bilgileri başarıyla güncellendi.',
            timer: 1500,
            showConfirmButton: false
        });

        loadUsers();
    } catch (error) {
        Utils.showError('Güncelleme sırasında bir hata oluştu.');
    } finally {
        updateUserBtn.disabled = false;
        updateUserBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Güncelle';
    }
}

// Delete User
window.deleteUser = async function (id) {
    const result = await Swal.fire({
        title: 'Emin misiniz?',
        text: "Bu yöneticiyi kalıcı olarak silmek istediğinize emin misiniz?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Evet, Sil',
        cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
        try {
            await api.delete(`/platform-admin/users/${id}`);
            Swal.fire('Silindi!', 'Kullanıcı başarıyla silindi.', 'success');
            loadUsers();
        } catch (error) {
            const msg = typeof error === 'string' ? error : 'Silme işlemi başarısız.';
            Utils.showError(msg);
        }
    }
};

// Handle Logout
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

// Helpers
function renderEmptyState() {
    usersTableBody.innerHTML = `
        <tr>
            <td colspan="4">
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="bi bi-people"></i></div>
                    <h5>Kayıtlı yönetici bulunamadı</h5>
                </div>
            </td>
        </tr>
    `;
}

function renderErrorState() {
    usersTableBody.innerHTML = `
        <tr>
            <td colspan="4">
                <div class="empty-state">
                    <div class="empty-state-icon error"><i class="bi bi-exclamation-triangle"></i></div>
                    <h5>Veriler yüklenemedi</h5>
                    <button class="btn btn-sm btn-outline-primary mt-2" onclick="loadUsers()">Yeniden Dene</button>
                </div>
            </td>
        </tr>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
