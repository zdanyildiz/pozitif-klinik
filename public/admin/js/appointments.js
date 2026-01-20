/**
 * Pozitif Klinik - Randevu ve Adisyon Yönetimi
 * v3.0 - Billing & Crypto Integration
 */

let appointments = [];
let appointmentTypes = [];
let patients = [];
let doctors = [];
let services = [];
let detailModal;
let appointmentModal;
let typeModal;
let currentAppointmentId = null;
let patientTomSelect = null;
let doctorTomSelect = null;

document.addEventListener('DOMContentLoaded', async () => {
    detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
    appointmentModal = new bootstrap.Modal(document.getElementById('appointmentModal'));
    typeModal = new bootstrap.Modal(document.getElementById('typeModal'));

    displayUserInfo();
    setupFilters();
    setupEventListeners();

    await Promise.all([
        loadTypes(),
        loadPatients(),
        loadDoctors(),
        loadServices(),
        loadStats()
    ]);

    loadAppointments();
});

function displayUserInfo() {
    const name = localStorage.getItem('user_full_name') || 'Personel';
    const role = localStorage.getItem('user_role') || 'staff';
    document.getElementById('userName').textContent = name;
    document.getElementById('userRole').textContent = role.toUpperCase();
}

function setupFilters() {
    const today = new Date().toISOString().split('T')[0];
    const filterDate = document.getElementById('filterDate');
    filterDate.value = today;

    filterDate.addEventListener('change', loadAppointments);
    document.getElementById('btnToday').addEventListener('click', () => {
        filterDate.value = today;
        loadAppointments();
    });
    document.getElementById('btnRefresh').addEventListener('click', loadAppointments);
}

function setupEventListeners() {
    document.getElementById('btnNewAppointment').addEventListener('click', () => {
        resetAppointmentForm();
        appointmentModal.show();
    });

    document.getElementById('saveAppointmentBtn').addEventListener('click', handleSaveAppointment);

    document.getElementById('typeForm').addEventListener('submit', handleSaveType);

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });

    document.getElementById('btnAddService').addEventListener('click', handleAddServiceToBilling);
    document.getElementById('btnUpdateDetails').addEventListener('click', handleSaveDetails);
}

// ==========================================
// DATA LOADING
// ==========================================

async function loadStats() {
    try {
        const res = await api.get('/api/appointments/stats/today');
        document.getElementById('todayCount').textContent = res.data.today || 0;
        document.getElementById('pendingCount').textContent = res.data.pending || 0;
    } catch (e) { console.error('Stats error', e); }
}

async function loadAppointments() {
    const date = document.getElementById('filterDate').value;
    const tbody = document.getElementById('appointmentsTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Yükleniyor...</td></tr>';

    try {
        const res = await api.get('/api/appointments', { params: { date } });
        appointments = res.data.appointments || [];
        renderAppointments();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Hata oluştu</td></tr>';
    }
}

async function loadTypes() {
    const res = await api.get('/api/appointments/types');
    appointmentTypes = res.data || [];
    renderTypeOptions();
    renderTypeList();
}

async function loadPatients() {
    const res = await api.get('/api/patients/select-list');
    patients = res.data || [];
    renderPatientOptions();

    // Tom Select Başlat
    if (!patientTomSelect) {
        patientTomSelect = new TomSelect('#patientSelect', {
            create: false,
            sortField: { field: 'text', order: 'asc' },
            placeholder: 'Hasta Ara...',
            allowEmptyOption: true
        });
    } else {
        patientTomSelect.clearOptions();
        const options = patients.map(p => ({
            value: p.id,
            text: `${p.name} (${p.tc_no || '-'})`
        }));
        patientTomSelect.addOptions(options);
    }
}

async function loadDoctors() {
    const res = await api.get('/api/users');
    doctors = (res.data.users || []).filter(u => u.role === 'doctor' || u.role === 'admin');
    renderDoctorOptions();

    // Tom Select Başlat
    if (!doctorTomSelect) {
        doctorTomSelect = new TomSelect('#doctorSelect', {
            create: false,
            sortField: { field: 'text', order: 'asc' },
            placeholder: 'Doktor Seç...',
            allowEmptyOption: true
        });
    } else {
        doctorTomSelect.clearOptions();
        const options = doctors.map(d => ({
            value: d.id,
            text: d.name || d.username
        }));
        doctorTomSelect.addOptions(options);
    }
}

async function loadServices() {
    const res = await api.get('/api/services');
    services = res.data || [];
}

// ==========================================
// RENDERERS
// ==========================================

function renderAppointments() {
    const tbody = document.getElementById('appointmentsTableBody');
    tbody.innerHTML = '';

    if (appointments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Randevu bulunamadı</td></tr>';
        return;
    }

    appointments.forEach(app => {
        const time = app.appointment_date.split(' ')[1].substring(0, 5);
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <td><span class="time-badge">${time}</span></td>
            <td class="fw-bold">${escapeHtml(app.patient_name)}</td>
            <td>
                <span class="type-badge" style="background: ${app.color_code}15; color: ${app.color_code}">
                    ${escapeHtml(app.type_name)}
                </span>
            </td>
            <td>${escapeHtml(app.doctor_name || '-')}</td>
            <td>
                <span class="badge appointment-status-${app.status}">
                    ${getStatusLabel(app.status)}
                </span>
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary" onclick="viewDetail(${app.id}, event)">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        `;
        row.onclick = (e) => viewDetail(app.id, e);
        tbody.appendChild(row);
    });
}

function renderTypeOptions() {
    const sel = document.getElementById('typeSelect');
    sel.innerHTML = '<option value="">Seçiniz...</option>';
    appointmentTypes.forEach(t => {
        sel.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
}

function renderPatientOptions() {
    const sel = document.getElementById('patientSelect');
    sel.innerHTML = '<option value="">Seçiniz...</option>';
    patients.forEach(p => {
        sel.innerHTML += `<option value="${p.id}">${p.name} (${p.tc_no || '-'})</option>`;
    });
}

function renderDoctorOptions() {
    const sel = document.getElementById('doctorSelect');
    sel.innerHTML = '<option value="">Seçiniz...</option>';
    doctors.forEach(d => {
        sel.innerHTML += `<option value="${d.id}">${d.name || d.username}</option>`;
    });
}

function renderTypeList() {
    const list = document.getElementById('typeList');
    list.innerHTML = '';
    appointmentTypes.forEach(t => {
        list.innerHTML += `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
                <div class="d-flex align-items-center">
                    <div style="width:12px; height:12px; border-radius:50%; background:${t.color_code}" class="me-2"></div>
                    <div>
                        <div class="fw-bold small">${t.name}</div>
                        <small class="text-muted">${t.duration_minutes}dk - ${t.default_price}₺</small>
                    </div>
                </div>
            </div>
        `;
    });
}

// ==========================================
// ACTIONS
// ==========================================

async function handleSaveAppointment() {
    const form = document.getElementById('appointmentForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    data.appointment_date = `${data.date} ${data.time}:00`;

    try {
        await api.post('/api/appointments', data);
        appointmentModal.hide();
        loadAppointments();
        loadStats();
        Swal.fire('Başarılı', 'Randevu oluşturuldu', 'success');
    } catch (e) {
        Swal.fire('Hata', 'Randevu oluşturulamadı', 'error');
    }
}

async function viewDetail(id, e) {
    if (e) e.stopPropagation();
    currentAppointmentId = id;

    try {
        const res = await api.get(`/api/appointments/${id}`);
        const app = res.data;

        document.getElementById('detailPatientName').textContent = app.patient_name;
        document.getElementById('detailTypeBadge').innerHTML = `
            <span class="type-badge" style="background: ${app.color_code}15; color: ${app.color_code}">${app.type_name}</span>
        `;
        document.getElementById('detailDoctorName').textContent = app.doctor_name || '-';
        document.getElementById('detailDateTime').textContent = app.appointment_date;
        document.getElementById('detailNotes').textContent = app.notes || 'Not yok';
        document.getElementById('detailStatusSelect').value = app.status;

        renderBillingItems(app.items, app.total_amount);

        detailModal.show();
    } catch (e) {
        Swal.fire('Hata', 'Detay yüklenemedi', 'error');
    }
}

function renderBillingItems(items, total) {
    const tbody = document.getElementById('billingItemsBody');
    tbody.innerHTML = '';

    items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.item_name}</td>
            <td>${item.quantity}</td>
            <td class="text-end">${parseFloat(item.unit_price).toFixed(2)} ₺</td>
            <td class="text-end fw-bold">${parseFloat(item.total_price).toFixed(2)} ₺</td>
            <td class="text-end">
                <button class="btn btn-sm text-danger" onclick="removeBillingItem(${item.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('billingGrandTotal').textContent = parseFloat(total).toFixed(2) + ' ₺';
}

async function handleAddServiceToBilling() {
    const { value: serviceId } = await Swal.fire({
        title: 'Hizmet Seçin',
        html: '<select id="swalServiceSelect" class="form-select"></select>',
        showCancelButton: true,
        confirmButtonText: 'Ekle',
        cancelButtonText: 'İptal',
        didOpen: () => {
            const select = document.getElementById('swalServiceSelect');
            const options = services.map(s => ({
                id: s.id,
                name: s.name,
                price: s.price
            }));

            new TomSelect('#swalServiceSelect', {
                options: options,
                valueField: 'id',
                labelField: 'name',
                searchField: ['name'],
                placeholder: 'Hizmet ara...',
                render: {
                    option: function (data, escape) {
                        return `<div><span class="fw-bold">${escape(data.name)}</span> <small class="text-muted">(${escape(parseFloat(data.price).toFixed(2))} ₺)</small></div>`;
                    },
                    item: function (data, escape) {
                        return `<div>${escape(data.name)}</div>`;
                    }
                }
            });
        },
        preConfirm: () => {
            return document.getElementById('swalServiceSelect').value;
        }
    });

    if (serviceId) {
        const s = services.find(x => x.id == serviceId);
        try {
            await api.post(`/api/appointments/${currentAppointmentId}/items`, {
                service_id: s.id,
                item_name: s.name,
                unit_price: s.price,
                quantity: 1
            });
            refreshDetail();
        } catch (e) {
            Swal.fire('Hata', 'Hizmet eklenemedi', 'error');
        }
    }
}

async function removeBillingItem(itemId) {
    const res = await Swal.fire({
        title: 'Emin misiniz?',
        text: 'Bu kalem silinecek',
        icon: 'warning',
        showCancelButton: true
    });

    if (res.isConfirmed) {
        try {
            await api.delete(`/api/appointments/${currentAppointmentId}/items/${itemId}`);
            refreshDetail();
        } catch (e) {
            Swal.fire('Hata', 'Silinemedi', 'error');
        }
    }
}

async function handleSaveDetails() {
    const status = document.getElementById('detailStatusSelect').value;
    try {
        await api.put(`/api/appointments/${currentAppointmentId}/status`, { status });
        detailModal.hide();
        loadAppointments();
        loadStats();
        Swal.fire('Başarılı', 'Güncellendi', 'success');
    } catch (e) {
        Swal.fire('Hata', 'Güncellenemedi', 'error');
    }
}

async function handleSaveType(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);

    try {
        await api.post('/api/appointments/types', data);
        e.target.reset();
        loadTypes();
        Swal.fire('Başarılı', 'Tür eklendi', 'success');
    } catch (e) {
        Swal.fire('Hata', 'Tür eklenemedi', 'error');
    }
}

async function refreshDetail() {
    const res = await api.get(`/api/appointments/${currentAppointmentId}`);
    renderBillingItems(res.data.items, res.data.total_amount);
}

// HELPERS
function getStatusLabel(s) {
    const labels = { pending: 'Bekliyor', waiting: 'Klinikte', in_test: 'İşlemde', completed: 'Tamamlandı', cancelled: 'İptal', no_show: 'Gelmedi' };
    return labels[s] || s;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function resetAppointmentForm() {
    const f = document.getElementById('appointmentForm');
    f.reset();
    if (patientTomSelect) patientTomSelect.clear();
    if (doctorTomSelect) doctorTomSelect.clear();
    document.getElementById('appDate').value = document.getElementById('filterDate').value;
    document.getElementById('appTime').value = new Date().toTimeString().substring(0, 5);
}

window.viewDetail = viewDetail;
window.removeBillingItem = removeBillingItem;
