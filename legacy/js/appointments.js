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
let currentTypeId = null; // Düzenleme için tür ID'si
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
    doctors = (res.data.users || []).filter(u => u.role === 'doctor');
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

        // Time Column
        const tdTime = document.createElement('td');
        const timeBadge = document.createElement('span');
        timeBadge.className = 'time-badge';
        timeBadge.textContent = time;
        tdTime.appendChild(timeBadge);
        row.appendChild(tdTime);

        // Patient Column
        const tdPatient = document.createElement('td');
        tdPatient.className = 'fw-bold';
        tdPatient.textContent = app.patient_name;
        row.appendChild(tdPatient);

        // Type Column
        const tdType = document.createElement('td');
        const typeBadge = document.createElement('span');
        typeBadge.className = 'type-badge';
        typeBadge.style.backgroundColor = `${app.color_code}15`;
        typeBadge.style.color = app.color_code;
        typeBadge.textContent = app.type_name;
        tdType.appendChild(typeBadge);
        row.appendChild(tdType);

        // Doctor Column
        const tdDoctor = document.createElement('td');
        tdDoctor.textContent = app.doctor_name || '-';
        row.appendChild(tdDoctor);

        // Status Column
        const tdStatus = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `badge appointment-status-${app.status}`;
        statusBadge.textContent = getStatusLabel(app.status);
        tdStatus.appendChild(statusBadge);
        row.appendChild(tdStatus);

        // Actions Column
        const tdActions = document.createElement('td');
        tdActions.className = 'text-end';

        const btnGroup = document.createElement('div');
        btnGroup.className = 'btn-group';

        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-sm btn-outline-warning';
        btnEdit.innerHTML = '<i class="bi bi-pencil"></i>';
        btnEdit.onclick = (e) => editAppointment(app.id, e);
        btnGroup.appendChild(btnEdit);

        const btnView = document.createElement('button');
        btnView.className = 'btn btn-sm btn-outline-primary';
        btnView.innerHTML = '<i class="bi bi-eye"></i>';
        btnView.onclick = (e) => viewDetail(app.id, e);
        btnGroup.appendChild(btnView);

        tdActions.appendChild(btnGroup);
        row.appendChild(tdActions);

        row.onclick = (e) => viewDetail(app.id, e);
        tbody.appendChild(row);
    });
}

function renderTypeOptions() {
    const sel = document.getElementById('typeSelect');
    sel.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Seçiniz...';
    sel.appendChild(defaultOpt);

    appointmentTypes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        sel.appendChild(opt);
    });
}

function renderPatientOptions() {
    const sel = document.getElementById('patientSelect');
    sel.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Seçiniz...';
    sel.appendChild(defaultOpt);

    patients.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.tc_no || '-'})`;
        sel.appendChild(opt);
    });
}

function renderDoctorOptions() {
    const sel = document.getElementById('doctorSelect');
    sel.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Seçiniz...';
    sel.appendChild(defaultOpt);

    doctors.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name || d.username;
        sel.appendChild(opt);
    });
}

function renderTypeList() {
    const list = document.getElementById('typeList');
    list.innerHTML = '';
    appointmentTypes.forEach(t => {
        const item = document.createElement('div');
        item.className = 'd-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded';
        item.innerHTML = `
            <div class="d-flex align-items-center">
                <div style="width:12px; height:12px; border-radius:50%; background:${t.color_code}" class="me-2"></div>
                <div>
                    <div class="fw-bold small">${escapeHtml(t.name)}</div>
                    <small class="text-muted">${t.duration_minutes}dk - ${parseFloat(t.default_price).toFixed(2)}₺</small>
                </div>
            </div>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-warning btn-sm" onclick="editType(${t.id})" title="Düzenle">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="deleteType(${t.id})" title="Sil">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        list.appendChild(item);
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

    // Validasyon
    if (!data.patient_id) { Utils.showError('Hasta seçiniz'); return; }
    if (!data.type_id) { Utils.showError('Randevu türü seçiniz'); return; }
    if (!data.date || !data.time) { Utils.showError('Tarih ve saat seçiniz'); return; }

    const isEdit = !!currentAppointmentId;

    try {
        if (isEdit) {
            await api.put(`/api/appointments/${currentAppointmentId}`, data);
            Utils.showSuccess('Randevu güncellendi');
        } else {
            await api.post('/api/appointments', data);
            Utils.showSuccess('Randevu oluşturuldu');
        }

        appointmentModal.hide();
        loadAppointments();
        loadStats();
    } catch (e) {
        Utils.showError(typeof e === 'string' ? e : 'İşlem başarısız');
    }
}

async function editAppointment(id, e) {
    if (e) e.stopPropagation();
    currentAppointmentId = id;

    try {
        const res = await api.get(`/api/appointments/${id}`);
        const app = res.data;

        // Modal Başlığını Güncelle
        document.querySelector('#appointmentModal .modal-title').textContent = 'Randevu Düzenle';
        document.getElementById('saveAppointmentBtn').textContent = 'Güncelle';

        // Formu Doldur
        if (patientTomSelect) {
            patientTomSelect.setValue(app.patient_id);
            // patientTomSelect.disable(); // İsteğe bağlı
        }

        document.getElementById('typeSelect').value = app.type_id;
        if (doctorTomSelect) doctorTomSelect.setValue(app.doctor_id);

        const [date, time] = app.appointment_date.split(' ');
        document.getElementById('appDate').value = date;
        document.getElementById('appTime').value = time.substring(0, 5);
        document.getElementById('appNotes').value = app.notes || '';

        appointmentModal.show();
    } catch (e) {
        Utils.showError('Randevu bilgileri alınamadı');
    }
}

async function viewDetail(id, e) {
    if (e) e.stopPropagation();
    currentAppointmentId = id;

    try {
        const res = await api.get(`/api/appointments/${id}`);
        const app = res.data;

        document.getElementById('detailPatientName').textContent = app.patient_name;

        const typeBadgeWrapper = document.getElementById('detailTypeBadge');
        typeBadgeWrapper.innerHTML = '';
        const badge = document.createElement('span');
        badge.className = 'type-badge';
        badge.style.backgroundColor = `${app.color_code}15`;
        badge.style.color = app.color_code;
        badge.textContent = app.type_name;
        typeBadgeWrapper.appendChild(badge);
        document.getElementById('detailDoctorName').textContent = app.doctor_name || '-';
        document.getElementById('detailDateTime').textContent = app.appointment_date;
        document.getElementById('detailNotes').textContent = app.notes || 'Not yok';
        document.getElementById('detailStatusSelect').value = app.status;

        renderBillingItems(app.items, app.total_amount);

        detailModal.show();
    } catch (e) {
        Utils.showError('Detay yüklenemedi');
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
            Utils.showError('Hizmet eklenemedi');
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
            Utils.showError('Silinemedi');
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
        Utils.showSuccess('Güncellendi');
    } catch (e) {
        Utils.showError('Güncellenemedi');
    }
}

async function handleSaveType(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);

    const isEdit = !!currentTypeId;

    try {
        if (isEdit) {
            await api.put(`/api/appointments/types/${currentTypeId}`, data);
            Utils.showSuccess('Tür güncellendi');
        } else {
            await api.post('/api/appointments/types', data);
            Utils.showSuccess('Tür eklendi');
        }
        resetTypeForm();
        loadTypes();
    } catch (err) {
        Utils.showError(isEdit ? 'Tür güncellenemedi' : 'Tür eklenemedi');
    }
}

function editType(id) {
    const type = appointmentTypes.find(t => t.id === id);
    if (!type) return;

    currentTypeId = id;

    const form = document.getElementById('typeForm');
    form.querySelector('[name="name"]').value = type.name;
    form.querySelector('[name="color_code"]').value = type.color_code;
    form.querySelector('[name="duration_minutes"]').value = type.duration_minutes;
    form.querySelector('[name="default_price"]').value = type.default_price;

    // Buton metnini güncelle ve İptal butonunu göster
    form.querySelector('button[type="submit"]').textContent = 'Türü Güncelle';
    const cancelBtn = document.getElementById('btnCancelTypeEdit');
    if (cancelBtn) cancelBtn.style.display = 'block';
}

async function deleteType(id) {
    const res = await Swal.fire({
        title: 'Emin misiniz?',
        text: 'Bu randevu türü silinecek',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sil',
        cancelButtonText: 'İptal'
    });

    if (res.isConfirmed) {
        try {
            await api.delete(`/api/appointments/types/${id}`);
            Utils.showSuccess('Tür silindi');
            loadTypes();
        } catch (err) {
            Utils.showError('Tür silinemedi (kullanımda olabilir)');
        }
    }
}

function resetTypeForm() {
    currentTypeId = null;
    const form = document.getElementById('typeForm');
    form.reset();
    form.querySelector('[name="color_code"]').value = '#3788d8';
    form.querySelector('[name="duration_minutes"]').value = '30';
    form.querySelector('[name="default_price"]').value = '0';
    form.querySelector('button[type="submit"]').textContent = 'Yeni Tür Ekle';
    const cancelBtn = document.getElementById('btnCancelTypeEdit');
    if (cancelBtn) cancelBtn.style.display = 'none';
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
    currentAppointmentId = null;
    document.querySelector('#appointmentModal .modal-title').textContent = 'Yeni Randevu Oluştur';
    document.getElementById('saveAppointmentBtn').textContent = 'Oluştur';

    const f = document.getElementById('appointmentForm');
    f.reset();
    if (patientTomSelect) {
        patientTomSelect.clear();
        patientTomSelect.enable();
    }
    if (doctorTomSelect) doctorTomSelect.clear();
    document.getElementById('appDate').value = document.getElementById('filterDate').value;
    document.getElementById('appTime').value = new Date().toTimeString().substring(0, 5);
}

window.viewDetail = viewDetail;
window.removeBillingItem = removeBillingItem;
window.editType = editType;
window.deleteType = deleteType;
window.resetTypeForm = resetTypeForm;
