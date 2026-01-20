/**
 * Pozitif Klinik - Randevu Yönetimi Scripts
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

// Global State
let appointments = [];
let appointmentTypes = [];
let patients = [];
let doctors = [];
let appointmentModal;
let typeModal;

// DOM Elements
const appointmentsTableBody = document.getElementById('appointmentsTableBody');
const filterDate = document.getElementById('filterDate');
const btnRefresh = document.getElementById('btnRefresh');
const btnNewAppointment = document.getElementById('btnNewAppointment');
const saveAppointmentBtn = document.getElementById('saveAppointmentBtn');
const appointmentForm = document.getElementById('appointmentForm');
const patientSelect = document.getElementById('patientSelect');
const typeSelect = document.getElementById('typeSelect');
const doctorSelect = document.getElementById('doctorSelect');
const typeForm = document.getElementById('typeForm');
const typeList = document.getElementById('typeList');
const logoutBtn = document.getElementById('logoutBtn');

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    appointmentModal = new bootstrap.Modal(document.getElementById('appointmentModal'));
    typeModal = new bootstrap.Modal(document.getElementById('typeModal'));

    // Kullanıcı bilgilerini göster
    const fullName = localStorage.getItem('user_full_name') || 'Klinik Personeli';
    const role = localStorage.getItem('user_role');
    const roleText = role === 'doctor' ? 'Doktor' : (role === 'secretary' ? 'Sekreter' : (role === 'admin' ? 'Yönetici' : 'Personel'));

    if (document.getElementById('userName')) document.getElementById('userName').textContent = fullName;
    if (document.getElementById('userRole')) document.getElementById('userRole').textContent = roleText;

    // Bugünü seç
    const today = new Date().toISOString().split('T')[0];
    filterDate.value = today;

    loadAppointments();
    loadTypes();
    loadPatients();
    loadDoctors();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    filterDate.addEventListener('change', loadAppointments);
    btnRefresh.addEventListener('click', loadAppointments);

    btnNewAppointment.addEventListener('click', () => {
        appointmentForm.reset();
        document.getElementById('appDate').value = filterDate.value;

        // Varsayılan saati o anki saate en yakın 30 dakikalık dilime yuvarlayalım
        const now = new Date();
        now.setMinutes(now.getMinutes() > 30 ? 60 : 30);
        document.getElementById('appTime').value = now.getHours().toString().padStart(2, '0') + ':' + (now.getMinutes() === 0 ? '00' : '30');

        appointmentModal.show();
    });

    saveAppointmentBtn.addEventListener('click', handleSaveAppointment);

    typeForm.addEventListener('submit', handleSaveType);

    logoutBtn.addEventListener('click', handleLogout);
}

// Randevuları API'den Yükle
async function loadAppointments() {
    const date = filterDate.value;
    appointmentsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Yükleniyor...</td></tr>`;

    try {
        const response = await api.get('/api/appointments', { params: { date } });
        appointments = response.data?.appointments || [];
        renderAppointments();
    } catch (error) {
        console.error('Randevular yüklenirken hata:', error);
        Utils.showError('Randevu listesi yüklenemedi.');
    }
}

// Randevu Türlerini Yükle
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

// Hastaları Yükle
async function loadPatients() {
    try {
        const response = await api.get('/api/patients');
        patients = response.data?.patients || [];
        renderPatientOptions();
    } catch (error) {
        console.error('Hastalar yüklenirken hata:', error);
    }
}

// Doktorları Yükle
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

// Randevuları Tabloya Bas
function renderAppointments() {
    appointmentsTableBody.innerHTML = '';

    if (appointments.length === 0) {
        appointmentsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted"><i class="bi bi-calendar-x fs-2"></i><br>Bu tarihte randevu bulunmuyor.</td></tr>`;
        return;
    }

    appointments.forEach(app => {
        const row = document.createElement('tr');
        // app.appointment_date formatı "YYYY-MM-DD HH:MM:SS" varsayıyoruz
        const timePart = app.appointment_date.split(' ')[1] || '00:00:00';
        const time = timePart.slice(0, 5);

        row.innerHTML = `
            <td class="fw-bold text-primary">${time}</td>
            <td><div class="fw-semibold">${escapeHtml(app.patient_name)}</div></td>
            <td>
                <span class="type-badge" style="background-color: ${app.color_code || '#3788d8'}20; color: ${app.color_code || '#3788d8'}">
                    ${escapeHtml(app.type_name)}
                </span>
            </td>
            <td>${escapeHtml(app.doctor_name || '-')}</td>
            <td>
                <select class="form-select status-select appointment-status-${app.status}" onchange="updateAppointmentStatus(${app.id}, this)">
                    <option value="pending" ${app.status === 'pending' ? 'selected' : ''}>Bekliyor</option>
                    <option value="confirmed" ${app.status === 'confirmed' ? 'selected' : ''}>Onaylı</option>
                    <option value="waiting" ${app.status === 'waiting' ? 'selected' : ''}>Geldi / Bekliyor</option>
                    <option value="in_test" ${app.status === 'in_test' ? 'selected' : ''}>Testte</option>
                    <option value="completed" ${app.status === 'completed' ? 'selected' : ''}>Tamamlandı</option>
                    <option value="cancelled" ${app.status === 'cancelled' ? 'selected' : ''}>İptal</option>
                    <option value="no_show" ${app.status === 'no_show' ? 'selected' : ''}>Gelmedi</option>
                </select>
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-info" onclick="viewAppointment(${app.id})" title="Detay">
                    <i class="bi bi-info-circle"></i>
                </button>
            </td>
        `;
        appointmentsTableBody.appendChild(row);
    });
}

// Durum Güncelle
window.updateAppointmentStatus = async function (id, selectElement) {
    const status = selectElement.value;
    try {
        await api.put(`/api/appointments/${id}/status`, { status });
        Utils.showSuccess('Durum güncellendi.');

        // CSS class'ını güncelle
        selectElement.className = `form-select status-select appointment-status-${status}`;
    } catch (error) {
        Utils.showError('Durum güncellenemedi: ' + error);
        loadAppointments(); // Hata olduysa sayfayı yenileyip gerçek durumu göster
    }
}

// Randevu Kaydet
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
    saveAppointmentBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Oluşturuluyor...';

    try {
        await api.post('/api/appointments', data);
        appointmentModal.hide();
        Utils.showSuccess('Randevu başarıyla oluşturuldu.');
        loadAppointments();
    } catch (error) {
        console.error('Randevu kaydedilirken hata:', error);
        Utils.showError('Randevu oluşturulamadı: ' + error);
    } finally {
        saveAppointmentBtn.disabled = false;
        saveAppointmentBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Randevu Oluştur';
    }
}

// Randevu Türü Kaydet
async function handleSaveType(e) {
    e.preventDefault();
    const formData = new FormData(typeForm);
    const data = {
        name: formData.get('name'),
        color_code: formData.get('color_code'),
        duration_minutes: parseInt(formData.get('duration')) || 30
    };

    if (!data.name) return;

    try {
        await api.post('/api/appointments/types', data);
        typeForm.reset();
        Utils.showSuccess('Tür başarıyla eklendi.');
        loadTypes(); // Listeyi yenile
    } catch (error) {
        Utils.showError('Tür eklenemedi: ' + error);
    }
}

// Tür Listesini Render Et
function renderTypes() {
    typeList.innerHTML = '';
    if (appointmentTypes.length === 0) {
        typeList.innerHTML = '<div class="p-3 text-center text-muted small">Henüz tanımlı tür yok.</div>';
        return;
    }

    appointmentTypes.forEach(t => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center py-2';
        item.innerHTML = `
            <div class="d-flex align-items-center">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${t.color_code}; margin-right: 12px;"></div>
                <div class="small fw-medium">${escapeHtml(t.name)}</div>
                <div class="ms-2 badge bg-light text-dark border fw-normal" style="font-size: 0.7rem;">${t.duration_minutes} dk</div>
            </div>
            <i class="bi bi-grip-vertical text-muted"></i>
        `;
        typeList.appendChild(item);
    });
}

// Selectbox'ları doldur
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
        opt.textContent = `${p.name} (${p.tc_no})`;
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

// Randevu Detayı
window.viewAppointment = function (id) {
    const app = appointments.find(a => a.id === id);
    if (!app) return;

    Swal.fire({
        title: '<i class="bi bi-info-circle text-info me-2"></i>Randevu Detayı',
        html: `
            <div class="text-start border rounded p-3 bg-light">
                <div class="mb-2"><strong>Hasta:</strong> ${escapeHtml(app.patient_name)}</div>
                <div class="mb-2"><strong>Tarih:</strong> ${Utils.formatDate(app.appointment_date)}</div>
                <div class="mb-2"><strong>Tür:</strong> <span class="badge" style="background-color: ${app.color_code}">${escapeHtml(app.type_name)}</span></div>
                <div class="mb-2"><strong>Doktor:</strong> ${escapeHtml(app.doctor_name || '-')}</div>
                <hr>
                <div class="mb-0"><strong>Notlar:</strong><br><span class="text-muted small">${escapeHtml(app.notes || 'Not bulunmuyor.')}</span></div>
            </div>
        `,
        confirmButtonText: 'Kapat',
        confirmButtonColor: '#3788d8'
    });
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
