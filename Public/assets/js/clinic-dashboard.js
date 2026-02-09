/**
 * Pozitif Klinik - Clinic Dashboard Scripts
 */

// Authentication is handled server-side via SessionAuthMiddleware.
// No client-side token check needed for SSR pages.

// Global state
let users = window.users || [];

// DOM Elements (Initialized in DOMContentLoaded)
let usersTableBody;
let newUserForm;
let saveUserBtn;
let logoutBtn;
let btnAddUser;
let updateUserBtn;

// Stats Elements (Initialized in DOMContentLoaded)
let totalUsersCountEl;
let doctorCountEl;
let secretaryCountEl;

// Modal
let newUserModal;
let editUserModal; // Add this line

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM Elements
    usersTableBody = document.getElementById('usersTableBody');
    newUserForm = document.getElementById('newUserForm');
    saveUserBtn = document.getElementById('saveUserBtn');
    logoutBtn = document.getElementById('logoutBtn');
    btnAddUser = document.getElementById('btnAddUser');
    updateUserBtn = document.getElementById('updateUserBtn');
    totalUsersCountEl = document.getElementById('totalUsersCount');
    doctorCountEl = document.getElementById('doctorCount');
    secretaryCountEl = document.getElementById('secretaryCount');

    const newUserModalEl = document.getElementById('newUserModal');
    if (newUserModalEl) newUserModal = new bootstrap.Modal(newUserModalEl);

    const editUserModalEl = document.getElementById('editUserModal');
    if (editUserModalEl) editUserModal = new bootstrap.Modal(editUserModalEl);

    // Kullanıcı bilgilerini göster
    const fullName = localStorage.getItem('user_full_name');
    const role = localStorage.getItem('user_role');
    const roleText = role === 'admin' ? 'Yönetici' : (role === 'doctor' ? 'Doktor' : 'Sekreter');

    if (document.getElementById('userName')) document.getElementById('userName').textContent = fullName || 'Klinik Personeli';
    if (document.getElementById('userRole')) document.getElementById('userRole').textContent = roleText;

    loadUsers(false); // Pass false to skip API call if we already have data
    loadMedicalSpecialties();
    setupEventListeners();
    updateStats(); // Initial stats update from SSR data
});

function updateStats() {
    if (totalUsersCountEl) totalUsersCountEl.textContent = users.length;
    if (doctorCountEl) doctorCountEl.textContent = users.filter(u => u.role === 'doctor').length;
    if (secretaryCountEl) secretaryCountEl.textContent = users.filter(u => u.role === 'secretary').length;
}

let medicalSpecialties = [];
async function loadMedicalSpecialties() {
    try {
        const result = await api.get('/api/general/specialties');
        medicalSpecialties = result.data || [];

        const newSelect = document.getElementById('newSpecialty');
        const editSelect = document.getElementById('editSpecialty');

        [newSelect, editSelect].forEach(select => {
            if (select) {
                select.innerHTML = '<option value="">Seçiniz</option>';
                medicalSpecialties.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.code;
                    opt.textContent = s.name;
                    select.appendChild(opt);
                });
            }
        });
    } catch (error) {
        console.error('Branşlar yüklenirken hata:', error);
    }
}

// Event Listeners
function setupEventListeners() {
    // Modal Aç
    if (btnAddUser) {
        btnAddUser.addEventListener('click', () => {
            if (newUserModal) newUserModal.show();
        });
    }

    // Yeni Personel Kaydet
    if (saveUserBtn) {
        saveUserBtn.addEventListener('click', handleSaveUser);
    }

    // Personel Güncelle
    const updateBtn = document.getElementById('updateUserBtn');
    if (updateBtn) {
        updateBtn.addEventListener('click', handleUpdateUser);
    }

    // Role change listeners for specialty visibility
    const newRoleSelect = document.getElementById('newRole');
    if (newRoleSelect) {
        newRoleSelect.addEventListener('change', () => {
            document.getElementById('newSpecialtyContainer').style.display = newRoleSelect.value === 'doctor' ? 'block' : 'none';
        });
    }

    const editRoleSelect = document.getElementById('editRole');
    if (editRoleSelect) {
        editRoleSelect.addEventListener('change', () => {
            document.getElementById('editSpecialtyContainer').style.display = editRoleSelect.value === 'doctor' ? 'block' : 'none';
        });
    }
}

// Personelleri Yükle
async function loadUsers(forceFetch = true) {
    if (!forceFetch && users.length > 0) {
        updateStats();
        return;
    }

    try {
        const result = await api.get('/api/users');
        // Backend {count: X, users: [...]} şeklinde bir obje dönüyor
        users = result.data?.users || [];

        // Stats güncelle
        updateStats();

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
        <td class="d-none d-md-table-cell"><strong>#${user.id}</strong></td>
        <td><span class="user-full-name fw-bold">${escapeHtml(user.name || '-')}</span></td>
        <td class="d-none d-lg-table-cell"><span class="text-secondary">${escapeHtml(user.username)}</span></td>
        <td>
            <span class="badge ${roleInfo.class} px-2 py-1 rounded-2" style="font-size: 0.75rem;">
                ${roleInfo.text}
            </span>
        </td>
        <td>
            <span class="status-badge ${statusClass}">
                <i class="bi ${statusIcon}"></i>
                <span class="d-none d-sm-inline">${statusText}</span>
            </span>
        </td>
        <td class="date-cell d-none d-xl-table-cell">${Utils.formatDate(user.created_at)}</td>
        <td>
            <div class="d-flex justify-content-end gap-1">
                <button class="btn btn-sm btn-outline-primary" onclick="handleEditUser(${user.id})" title="Düzenle">
                    <i class="bi bi-pencil"></i> <span class="d-none d-md-inline">Düzenle</span>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteUser(${user.id}, '${escapeHtml(user.username)}')" title="Sil">
                    <i class="bi bi-trash"></i> <span class="d-none d-md-inline">Sil</span>
                </button>
            </div>
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
        role: document.getElementById('newRole').value,
        specialty: document.getElementById('newSpecialty').value
    };

    if (!data.name || !data.username || !data.password || !data.role) {
        Utils.showError('Lütfen tüm alanları doldurun.');
        return;
    }

    if (data.role === 'doctor' && !data.specialty) {
        Utils.showError('Doktor için branş seçimi zorunludur.');
        return;
    }

    if (data.role !== 'doctor') {
        data.specialty = null;
    }

    if (saveUserBtn) {
        saveUserBtn.disabled = true;
        saveUserBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Kaydediliyor...';
    }

    try {
        await api.post('/api/users', data);

        if (newUserModal) newUserModal.hide();
        if (newUserForm) newUserForm.reset();

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
        if (saveUserBtn) {
            saveUserBtn.disabled = false;
            saveUserBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Kaydet';
        }
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

    const specialtySelect = document.getElementById('editSpecialty');
    const specialtyContainer = document.getElementById('editSpecialtyContainer');
    if (specialtySelect) {
        specialtySelect.value = user.specialty || '';
    }
    if (specialtyContainer) {
        specialtyContainer.style.display = user.role === 'doctor' ? 'block' : 'none';
    }

    if (editUserModal) editUserModal.show();
}

// Personel Güncelle (API Çağrısı)
async function handleUpdateUser() {
    const updateUserBtn = document.getElementById('updateUserBtn');
    const userId = document.getElementById('editUserId').value;
    const data = {
        name: document.getElementById('editName').value.trim(),
        username: document.getElementById('editUsername').value.trim(),
        role: document.getElementById('editRole').value,
        specialty: document.getElementById('editSpecialty').value,
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

    if (data.role === 'doctor' && !data.specialty) {
        Utils.showError('Doktor için branş seçimi zorunludur.');
        return;
    }

    if (data.role !== 'doctor') {
        data.specialty = null;
    }

    if (updateUserBtn) {
        updateUserBtn.disabled = true;
        updateUserBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Güncelleniyor...';
    }

    try {
        await api.put(`/api/users/${userId}`, data);

        if (editUserModal) editUserModal.hide();
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
        if (updateUserBtn) {
            updateUserBtn.disabled = false;
            updateUserBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Güncelle';
        }
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
