/**
 * Pozitif Klinik - Randevu Yönetimi Scripts
 * v2.0 - Full CRUD Support & Enhanced UX
 */

// Token & Yetki Kontrolü
const token = localStorage.getItem('platform_token');
const userType = localStorage.getItem('user_type');

if (!token) {
    Swal.fire({
        icon: 'error',
        title: 'Oturum Hatası',
        text: 'Oturum bilgileri bulunamadı. Lütfen tekrar giriş yapın.',
        confirmButtonText: 'Giriş Sayfasına Git'
    }).then(() => {
        window.location.href = 'index.html';
    });
}

// ==========================================
// GLOBAL STATE
// ==========================================
let appointments = [];
let appointmentTypes = [];
let patients = [];
let doctors = [];
let appointmentModal;
let typeModal;
let currentEditId = null; // Düzenleme modu için

// ==========================================
// DOM ELEMENTS
// ==========================================
const appointmentsTableBody = document.getElementById('appointmentsTableBody');
const filterDate = document.getElementById('filterDate');
const btnRefresh = document.getElementById('btnRefresh');
const btnToday = document.getElementById('btnToday');
const btnNewAppointment = document.getElementById('btnNewAppointment');
const saveAppointmentBtn = document.getElementById('saveAppointmentBtn');
const appointmentForm = document.getElementById('appointmentForm');
const patientSelect = document.getElementById('patientSelect');
const typeSelect = document.getElementById('typeSelect');
const doctorSelect = document.getElementById('doctorSelect');
const typeForm = document.getElementById('typeForm');
const typeList = document.getElementById('typeList');
const logoutBtn = document.getElementById('logoutBtn');

// Stats Elements
const todayCountEl = document.getElementById('todayCount');
const pendingCountEl = document.getElementById('pendingCount');

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    appointmentModal = new bootstrap.Modal(document.getElementById('appointmentModal'));
    typeModal = new bootstrap.Modal(document.getElementById('typeModal'));

    // Kullanıcı bilgilerini göster
    displayUserInfo();

    // Bugünü seç
    const today = new Date().toISOString().split('T')[0];
    filterDate.value = today;

    // Verileri yükle
    loadStats();
    loadAppointments();
    loadTypes();
    loadPatients();
    loadDoctors();

    // Event listener'ları kur
    setupEventListeners();
});

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
    // Tarih değiştiğinde
    filterDate.addEventListener('change', () => {
        loadAppointments();
    });

    // Yenile butonu
    btnRefresh.addEventListener('click', () => {
        loadStats();
        loadAppointments();
    });

    // Bugün butonu
    btnToday.addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        filterDate.value = today;
        loadAppointments();
    });

    // Yeni randevu butonu
    btnNewAppointment.addEventListener('click', () => {
        resetAppointmentForm();
        currentEditId = null;
        document.getElementById('modalTitle').textContent = 'Yeni Randevu Oluştur';
        document.getElementById('modalSubtitle').textContent = 'Randevu bilgilerini giriniz';
        document.getElementById('saveButtonText').textContent = 'Randevu Oluştur';
        appointmentModal.show();
    });

    // Randevu kaydet
    saveAppointmentBtn.addEventListener('click', handleSaveAppointment);

    // Tür formu
    typeForm.addEventListener('submit', handleSaveType);

    // Çıkış
    logoutBtn.addEventListener('click', handleLogout);
}

// ==========================================
// USER INFO
// ==========================================
function displayUserInfo() {
    const fullName = localStorage.getItem('user_full_name') || 'Klinik Personeli';
    const role = localStorage.getItem('user_role');
    const roleText = getRoleText(role);

    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');

    if (userNameEl) userNameEl.textContent = fullName;
    if (userRoleEl) userRoleEl.textContent = roleText;
}

function getRoleText(role) {
    const roles = {
        'doctor': 'Doktor',
        'secretary': 'Sekreter',
        'admin': 'Yönetici'
    };
    return roles[role] || 'Personel';
}

// ==========================================
// API CALLS - STATS
// ==========================================
async function loadStats() {
    try {
        const response = await api.get('/api/appointments/stats/today');
        const stats = response.data || {};

        if (todayCountEl) {
            animateNumber(todayCountEl, stats.today || 0);
        }
        if (pendingCountEl) {
            animateNumber(pendingCountEl, stats.pending || 0);
        }
    } catch (error) {
        console.error('İstatistikler yüklenirken hata:', error);
    }
}

function animateNumber(element, target) {
    const current = parseInt(element.textContent) || 0;
    const increment = target > current ? 1 : -1;
    const duration = 300;
    const steps = Math.abs(target - current);

    if (steps === 0) return;

    const stepDuration = duration / steps;
    let value = current;

    const timer = setInterval(() => {
        value += increment;
        element.textContent = value;

        if (value === target) {
            clearInterval(timer);
        }
    }, stepDuration);
}

// ==========================================
// API CALLS - APPOINTMENTS
// ==========================================
async function loadAppointments() {
    const date = filterDate.value;
    appointmentsTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-5">
                <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                <span class="text-muted">Randevular yükleniyor...</span>
            </td>
        </tr>
    `;

    try {
        const response = await api.get('/api/appointments', { params: { date } });
        appointments = response.data?.appointments || [];
        renderAppointments();
    } catch (error) {
        console.error('Randevular yüklenirken hata:', error);
        appointmentsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-danger">
                    <i class="bi bi-exclamation-triangle fs-3 d-block mb-2"></i>
                    Randevular yüklenirken hata oluştu
                </td>
            </tr>
        `;
        Utils.showError('Randevu listesi yüklenemedi.');
    }
}

// ==========================================
// API CALLS - TYPES
// ==========================================
async function loadTypes() {
    try {
        const response = await api.get('/api/appointments/types');
        appointmentTypes = response.data || [];
        renderTypes();
        renderTypeOptions();
    } catch (error) {
        console.error('Türler yüklenirken hata:', error);
    }
}

// ==========================================
// API CALLS - PATIENTS
// ==========================================
async function loadPatients() {
    try {
        const response = await api.get('/api/patients');
        patients = response.data?.patients || [];
        renderPatientOptions();
    } catch (error) {
        console.error('Hastalar yüklenirken hata:', error);
    }
}

// ==========================================
// API CALLS - DOCTORS
// ==========================================
async function loadDoctors() {
    try {
        const response = await api.get('/api/users');
        const users = response.data?.users || [];
        doctors = users.filter(u => u.role === 'doctor');
        renderDoctorOptions();
    } catch (error) {
        console.error('Doktorlar yüklenirken hata:', error);
    }
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================
function renderAppointments() {
    appointmentsTableBody.innerHTML = '';

    if (appointments.length === 0) {
        appointmentsTableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <i class="bi bi-calendar-x"></i>
                        <h5 class="mt-3">Bu tarihte randevu bulunmuyor</h5>
                        <p class="text-muted">Yeni randevu eklemek için "Yeni Randevu" butonuna tıklayın</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    appointments.forEach(app => {
        const row = document.createElement('tr');
        const timePart = app.appointment_date.split(' ')[1] || '00:00:00';
        const time = timePart.slice(0, 5);

        row.innerHTML = `
            <td>
                <span class="time-badge">${time}</span>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="avatar-circle bg-primary text-white me-2" style="width: 35px; height: 35px; font-size: 0.85rem;">
                        ${getInitials(app.patient_name)}
                    </div>
                    <div>
                        <div class="fw-semibold">${escapeHtml(app.patient_name)}</div>
                        <small class="text-muted">ID: ${app.patient_id}</small>
                    </div>
                </div>
            </td>
            <td>
                <span class="type-badge" style="background-color: ${app.color_code || '#3788d8'}15; color: ${app.color_code || '#3788d8'}">
                    ${escapeHtml(app.type_name)}
                </span>
            </td>
            <td>
                <span class="${app.doctor_name ? 'text-dark' : 'text-muted'}">
                    ${app.doctor_name ? `<i class="bi bi-person-badge me-1"></i>${escapeHtml(app.doctor_name)}` : '<i class="bi bi-dash"></i>'}
                </span>
            </td>
            <td>
                <select 
                    class="form-select status-select appointment-status-${app.status}" 
                    data-id="${app.id}"
                    onchange="updateAppointmentStatus(${app.id}, this)">
                    ${getStatusOptions(app.status)}
                </select>
            </td>
            <td class="text-end">
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-info action-btn" onclick="viewAppointment(${app.id})" title="Detay">
                        <i class="bi bi-info-circle"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary action-btn" onclick="editAppointment(${app.id})" title="Düzenle">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger action-btn" onclick="deleteAppointment(${app.id})" title="Sil">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        appointmentsTableBody.appendChild(row);
    });
}

function getStatusOptions(currentStatus) {
    const statuses = [
        { value: 'pending', label: 'Bekliyor' },
        { value: 'confirmed', label: 'Onaylı' },
        { value: 'waiting', label: 'Geldi / Bekliyor' },
        { value: 'in_test', label: 'Testte' },
        { value: 'completed', label: 'Tamamlandı' },
        { value: 'cancelled', label: 'İptal' },
        { value: 'no_show', label: 'Gelmedi' }
    ];

    return statuses.map(s =>
        `<option value="${s.value}" ${currentStatus === s.value ? 'selected' : ''}>${s.label}</option>`
    ).join('');
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
}

function renderTypes() {
    typeList.innerHTML = '';

    if (appointmentTypes.length === 0) {
        typeList.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-tags fs-2 d-block mb-2 opacity-50"></i>
                <p class="small mb-0">Henüz tanımlı tür yok</p>
            </div>
        `;
        return;
    }

    appointmentTypes.forEach(t => {
        const item = document.createElement('div');
        item.className = 'type-list-item';
        item.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="type-color-dot" style="background-color: ${t.color_code}"></div>
                <div>
                    <div class="fw-medium">${escapeHtml(t.name)}</div>
                    <small class="text-muted">${t.duration_minutes} dakika</small>
                </div>
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteType(${t.id})" title="Sil">
                <i class="bi bi-trash"></i>
            </button>
        `;
        typeList.appendChild(item);
    });
}

function renderTypeOptions() {
    typeSelect.innerHTML = '<option value="">Tür seçiniz...</option>';
    appointmentTypes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        typeSelect.appendChild(opt);
    });
}

function renderPatientOptions() {
    patientSelect.innerHTML = '<option value="">Hasta seçiniz...</option>';
    patients.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        // TC'nin sadece son 4 hanesini göster (güvenlik)
        const maskedTc = p.tc_no ? '***' + p.tc_no.slice(-4) : '';
        opt.textContent = `${p.name} ${maskedTc ? `(${maskedTc})` : ''}`;
        patientSelect.appendChild(opt);
    });
}

function renderDoctorOptions() {
    doctorSelect.innerHTML = '<option value="">Doktor seçiniz...</option>';
    doctors.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name || d.username;
        doctorSelect.appendChild(opt);
    });
}

// ==========================================
// APPOINTMENT CRUD OPERATIONS
// ==========================================

// Durum Güncelle (Auto-save)
window.updateAppointmentStatus = async function (id, selectElement) {
    const status = selectElement.value;
    const originalClass = selectElement.className;

    // Animasyon göster
    selectElement.classList.add('opacity-50');

    try {
        await api.put(`/api/appointments/${id}/status`, { status });

        // CSS class'ını güncelle
        selectElement.className = `form-select status-select appointment-status-${status}`;

        // Kısa başarı bildirimi
        Utils.showToast('Durum güncellendi', 'success');

        // İstatistikleri güncelle
        loadStats();

    } catch (error) {
        selectElement.className = originalClass;
        Utils.showError('Durum güncellenemedi: ' + error);
        loadAppointments();
    } finally {
        selectElement.classList.remove('opacity-50');
    }
}

// Randevu Kaydet (Create / Update)
async function handleSaveAppointment() {
    const formData = new FormData(appointmentForm);
    const rawData = Object.fromEntries(formData.entries());

    // Validasyon
    if (!rawData.patient_id || !rawData.type_id || !rawData.date || !rawData.time) {
        Utils.showError('Lütfen tüm zorunlu alanları doldurunuz.');
        return;
    }

    const data = {
        patient_id: parseInt(rawData.patient_id),
        type_id: parseInt(rawData.type_id),
        doctor_id: rawData.doctor_id ? parseInt(rawData.doctor_id) : null,
        appointment_date: `${rawData.date} ${rawData.time}:00`,
        notes: rawData.notes || ''
    };

    saveAppointmentBtn.disabled = true;
    const originalText = document.getElementById('saveButtonText').textContent;
    document.getElementById('saveButtonText').textContent = 'Kaydediliyor...';

    try {
        if (currentEditId) {
            // Güncelleme
            await api.put(`/api/appointments/${currentEditId}`, data);
            Utils.showSuccess('Randevu başarıyla güncellendi.');
        } else {
            // Yeni oluşturma
            await api.post('/api/appointments', data);
            Utils.showSuccess('Randevu başarıyla oluşturuldu.');
        }

        appointmentModal.hide();
        loadAppointments();
        loadStats();

    } catch (error) {
        console.error('Randevu kaydedilirken hata:', error);
        Utils.showError('Randevu kaydedilemedi: ' + error);
    } finally {
        saveAppointmentBtn.disabled = false;
        document.getElementById('saveButtonText').textContent = originalText;
    }
}

// Randevu Düzenle
window.editAppointment = function (id) {
    const app = appointments.find(a => a.id === id);
    if (!app) return;

    currentEditId = id;

    // Modal başlığını güncelle
    document.getElementById('modalTitle').textContent = 'Randevu Düzenle';
    document.getElementById('modalSubtitle').textContent = `${app.patient_name} - ${app.type_name}`;
    document.getElementById('saveButtonText').textContent = 'Değişiklikleri Kaydet';

    // Form alanlarını doldur
    document.getElementById('appointmentId').value = id;
    document.getElementById('patientSelect').value = app.patient_id;
    document.getElementById('typeSelect').value = app.type_id;
    document.getElementById('doctorSelect').value = app.doctor_id || '';

    // Tarih ve saati ayır
    const [datePart, timePart] = app.appointment_date.split(' ');
    document.getElementById('appDate').value = datePart;
    document.getElementById('appTime').value = timePart ? timePart.slice(0, 5) : '';
    document.getElementById('appNotes').value = app.notes || '';

    appointmentModal.show();
}

// Randevu Sil
window.deleteAppointment = async function (id) {
    const app = appointments.find(a => a.id === id);
    if (!app) return;

    const result = await Swal.fire({
        title: 'Randevu Silinecek',
        html: `
            <div class="text-start">
                <p><strong>Hasta:</strong> ${escapeHtml(app.patient_name)}</p>
                <p><strong>Tarih:</strong> ${Utils.formatDate(app.appointment_date)}</p>
                <p class="text-danger mb-0"><i class="bi bi-exclamation-triangle me-2"></i>Bu işlem geri alınamaz!</p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonText: 'İptal',
        confirmButtonText: 'Evet, Sil'
    });

    if (result.isConfirmed) {
        try {
            await api.delete(`/api/appointments/${id}`);
            Utils.showSuccess('Randevu başarıyla silindi.');
            loadAppointments();
            loadStats();
        } catch (error) {
            Utils.showError('Randevu silinemedi: ' + error);
        }
    }
}

// Randevu Detayı
window.viewAppointment = function (id) {
    const app = appointments.find(a => a.id === id);
    if (!app) return;

    const statusLabels = {
        'pending': 'Bekliyor',
        'confirmed': 'Onaylı',
        'waiting': 'Geldi / Bekliyor',
        'in_test': 'Testte',
        'completed': 'Tamamlandı',
        'cancelled': 'İptal',
        'no_show': 'Gelmedi'
    };

    Swal.fire({
        title: `<i class="bi bi-calendar-check text-primary me-2"></i>Randevu Detayı`,
        html: `
            <div class="text-start">
                <div class="border rounded p-3 bg-light mb-3">
                    <div class="row mb-2">
                        <div class="col-5 text-muted">Hasta:</div>
                        <div class="col-7 fw-bold">${escapeHtml(app.patient_name)}</div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-5 text-muted">Tarih/Saat:</div>
                        <div class="col-7">${Utils.formatDate(app.appointment_date)}</div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-5 text-muted">Tür:</div>
                        <div class="col-7">
                            <span class="badge" style="background-color: ${app.color_code}">${escapeHtml(app.type_name)}</span>
                        </div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-5 text-muted">Doktor:</div>
                        <div class="col-7">${escapeHtml(app.doctor_name || 'Atanmadı')}</div>
                    </div>
                    <div class="row">
                        <div class="col-5 text-muted">Durum:</div>
                        <div class="col-7">
                            <span class="badge appointment-status-${app.status}">${statusLabels[app.status] || app.status}</span>
                        </div>
                    </div>
                </div>
                ${app.notes ? `
                    <div class="border rounded p-3">
                        <div class="text-muted small mb-1">Notlar:</div>
                        <div>${escapeHtml(app.notes)}</div>
                    </div>
                ` : ''}
            </div>
        `,
        showCloseButton: true,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-pencil me-1"></i> Düzenle',
        cancelButtonText: 'Kapat',
        confirmButtonColor: '#3788d8'
    }).then(result => {
        if (result.isConfirmed) {
            editAppointment(id);
        }
    });
}

// ==========================================
// TYPE CRUD OPERATIONS
// ==========================================

// Tür Kaydet
async function handleSaveType(e) {
    e.preventDefault();
    const formData = new FormData(typeForm);

    const data = {
        name: formData.get('name'),
        color_code: formData.get('color_code'),
        duration_minutes: parseInt(formData.get('duration')) || 30
    };

    if (!data.name) return;

    const submitBtn = typeForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
        await api.post('/api/appointments/types', data);
        typeForm.reset();
        document.getElementById('typeColor').value = '#3788d8';
        document.getElementById('typeDuration').value = '30';
        Utils.showToast('Tür başarıyla eklendi', 'success');
        loadTypes();
    } catch (error) {
        Utils.showError('Tür eklenemedi: ' + error);
    } finally {
        submitBtn.disabled = false;
    }
}

// Tür Sil
window.deleteType = async function (id) {
    const type = appointmentTypes.find(t => t.id === id);
    if (!type) return;

    const result = await Swal.fire({
        title: 'Tür Silinecek',
        text: `"${type.name}" türünü silmek istediğinize emin misiniz?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonText: 'İptal',
        confirmButtonText: 'Evet, Sil'
    });

    if (result.isConfirmed) {
        try {
            await api.delete(`/api/appointments/types/${id}`);
            Utils.showSuccess('Tür başarıyla silindi.');
            loadTypes();
        } catch (error) {
            Utils.showError('Tür silinemedi: ' + error);
        }
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function resetAppointmentForm() {
    appointmentForm.reset();
    document.getElementById('appointmentId').value = '';
    document.getElementById('appDate').value = filterDate.value;

    // Varsayılan saati o anki saate en yakın 30 dakikalık dilime yuvarlayalım
    const now = new Date();
    now.setMinutes(now.getMinutes() > 30 ? 60 : 30);
    document.getElementById('appTime').value =
        now.getHours().toString().padStart(2, '0') + ':' +
        (now.getMinutes() === 0 ? '00' : '30');
}

// Çıkış Yap
async function handleLogout() {
    const result = await Swal.fire({
        title: 'Çıkış Yapılıyor',
        text: "Oturumunuzu kapatmak istediğinize emin misiniz?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Evet, Çıkış Yap',
        cancelButtonText: 'İptal',
        confirmButtonColor: '#dc3545'
    });

    if (result.isConfirmed) {
        localStorage.removeItem('platform_token');
        localStorage.removeItem('user_type');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_full_name');
        window.location.href = 'index.html';
    }
}

// XSS Koruması
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
