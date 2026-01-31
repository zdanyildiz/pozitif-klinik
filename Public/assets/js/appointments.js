/**
 * Pozitif Klinik - Randevu ve Adisyon Yönetimi
 * v3.0 - Billing & Crypto Integration
 */

let appointments = [];
let appointmentTypes = [];
let patients = [];
let doctors = [];
// let services = []; // Artık global liste kullanılmıyor, TomSelect uzak arama yapıyor
let appointmentStatuses = [];
let detailModal;
let appointmentModal;
let typeModal;
let currentAppointmentId = null;
let currentTypeId = null; // Düzenleme için tür ID'si
let patientTomSelect = null;
let doctorTomSelect = null;
let serviceTomSelect = null; // Hizmet seçimi için TomSelect
let billingServiceTomSelect = null; // Detay ekranı inline hizmet seçimi
let filterMode = 'date'; // 'date' | 'week'

document.addEventListener('DOMContentLoaded', async () => {
    detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
    appointmentModal = new bootstrap.Modal(document.getElementById('appointmentModal'));
    typeModal = new bootstrap.Modal(document.getElementById('typeModal'));

    displayUserInfo();
    setupFilters();
    setupEventListeners();

    await Promise.all([
        loadTypes(),
        loadStatuses(),
        loadPatients(),
        loadDoctors(),
        loadStats()
    ]);

    renderServiceOptionsForTypes();
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

    // Helper to toggle active state
    const setActiveBtn = (btnId) => {
        ['btnToday', 'btnTomorrow', 'btnThisWeek'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            if (id === btnId) {
                btn.classList.remove('btn-outline-primary');
                btn.classList.add('btn-primary');
            } else {
                btn.classList.add('btn-outline-primary');
                btn.classList.remove('btn-primary');
            }
        });
    };

    // Initial state
    setActiveBtn('btnToday');

    filterDate.addEventListener('change', () => {
        filterMode = 'date';
        setActiveBtn(null);
        loadAppointments();
    });

    document.getElementById('btnToday').addEventListener('click', () => {
        filterMode = 'date';
        filterDate.value = new Date().toISOString().split('T')[0];
        setActiveBtn('btnToday');
        loadAppointments();
    });

    document.getElementById('btnTomorrow').addEventListener('click', () => {
        filterMode = 'date';
        const d = new Date();
        d.setDate(d.getDate() + 1);
        filterDate.value = d.toISOString().split('T')[0];
        setActiveBtn('btnTomorrow');
        loadAppointments();
    });

    document.getElementById('btnThisWeek').addEventListener('click', () => {
        filterMode = 'week';
        filterDate.value = ''; // Clear specific date
        setActiveBtn('btnThisWeek');
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
        window.location.href = API_URL + '/admin/login';
    });

    document.getElementById('btnAddService').addEventListener('click', toggleServicePanel);
    document.getElementById('btnConfirmAddService').addEventListener('click', handleConfirmAddService);
    document.getElementById('btnUpdateDetails').addEventListener('click', handleSaveDetails);

    // ==========================================
    // SLOT GRID EVENT LISTENERS
    // ==========================================

    // Tarih değiştiğinde slotları yükle
    document.getElementById('appDate').addEventListener('change', loadAvailableSlots);

    // Tür seçildiğinde slotları yeniden yükle (süre farklı olabilir)
    document.getElementById('typeSelect').addEventListener('change', loadAvailableSlots);

    // Doktor seçildiğinde slotları yeniden yükle
    document.getElementById('doctorSelect').addEventListener('change', loadAvailableSlots);

    // Quick date buttons
    document.querySelectorAll('.quick-date').forEach(btn => {
        btn.addEventListener('click', () => {
            const offset = parseInt(btn.dataset.offset, 10);
            const date = new Date();
            date.setDate(date.getDate() + offset);
            document.getElementById('appDate').value = date.toISOString().split('T')[0];

            // Update active state
            document.querySelectorAll('.quick-date').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            loadAvailableSlots();
        });
    });

    // DOKTOR EKRANI KURGUSU: Modal açılınca başlat
    const typeModalEl = document.getElementById('typeModal');
    if (typeModalEl) {
        typeModalEl.addEventListener('shown.bs.modal', function () {
            initTypeServiceSelect();
        });
    }
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
    const tbody = document.getElementById('appointmentsTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Yükleniyor...</td></tr>';

    let params = {};
    if (filterMode === 'week') {
        const { start, end } = getWeekRange();
        params = { start_date: start, end_date: end };
    } else {
        const date = document.getElementById('filterDate').value;
        if (!date) {
            // If date is empty but mode is date (fallback to today)
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('filterDate').value = today;
            params = { date: today };
        } else {
            params = { date };
        }
    }

    try {
        const res = await api.get('/api/appointments', { params });
        appointments = res.data.appointments || [];
        renderAppointments();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Hata oluştu</td></tr>';
    }
}

function getWeekRange() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
    const numDay = now.getDate();

    const start = new Date(now);
    // Pazartesi'yi haftanın başı kabul et (TR standardı)
    start.setDate(numDay - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Pazar

    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

async function loadTypes() {
    const res = await api.get('/api/appointments/types');
    appointmentTypes = res.data || [];
    renderTypeOptions();
    renderTypeList();
    // NOT: renderServiceOptionsForTypes loadServices'dan sonra çağrılacak
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
    // Bu fonksiyon artık kullanılmıyor, yerine TomSelect remote search kullanılıyor.
    console.log('loadServices() devre dışı bırakıldı.');
}
async function loadStatuses() {
    try {
        const res = await api.get('/api/appointments/statuses');
        appointmentStatuses = res.data || [];
        renderStatusOptions();
    } catch (e) {
        console.error('Statüler yüklenirken hata:', e);
    }
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

        // Dinamik statü bilgilerini kullan (varsa)
        if (app.status_name) {
            statusBadge.className = 'badge';
            statusBadge.style.backgroundColor = `${app.status_color}20`;
            statusBadge.style.color = app.status_color;
            statusBadge.style.border = `1px solid ${app.status_color}40`;
            statusBadge.innerHTML = `<i class="bi ${app.status_icon} me-1"></i> ${app.status_name}`;
        } else {
            statusBadge.className = `badge appointment-status-${app.status}`;
            statusBadge.textContent = getStatusLabel(app.status);
        }

        tdStatus.appendChild(statusBadge);
        row.appendChild(tdStatus);

        // Actions Column
        const tdActions = document.createElement('td');
        const actionWrapper = document.createElement('div');
        actionWrapper.className = 'd-flex justify-content-end align-items-center gap-2';

        // 1. Muayene Butonu (Primary Action)
        const btnExam = document.createElement('button');
        btnExam.className = 'btn btn-sm btn-exam-action';
        btnExam.innerHTML = '<i class="bi bi-person-pulse me-1"></i> Muayene';
        btnExam.title = 'Muayene Ekranı';
        btnExam.onclick = (e) => {
            e.stopPropagation();
            window.location.href = `${API_URL}/admin/examination?appointment_id=${app.id}`;
        };
        actionWrapper.appendChild(btnExam);

        // 2. Diğer İşlemler (Secondary Actions)
        const btnGroup = document.createElement('div');
        btnGroup.className = 'btn-group';

        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-sm btn-outline-warning';
        btnEdit.innerHTML = '<i class="bi bi-pencil"></i>';
        btnEdit.title = 'Düzenle';
        btnEdit.onclick = (e) => editAppointment(app.id, e);
        btnGroup.appendChild(btnEdit);

        const btnView = document.createElement('button');
        btnView.className = 'btn btn-sm btn-outline-primary';
        btnView.innerHTML = '<i class="bi bi-eye"></i>';
        btnView.title = 'Detaylar';
        btnView.onclick = (e) => viewDetail(app.id, e);
        btnGroup.appendChild(btnView);

        actionWrapper.appendChild(btnGroup);
        tdActions.appendChild(actionWrapper);
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

function renderStatusOptions() {
    const sel = document.getElementById('detailStatusSelect');
    const sel2 = document.getElementById('createStatusSelect');

    if (sel) {
        sel.innerHTML = '';
        appointmentStatuses.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.status_code;
            opt.textContent = s.name;
            sel.appendChild(opt);
        });
    }

    if (sel2) {
        sel2.innerHTML = '';
        appointmentStatuses.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.status_code;
            opt.textContent = s.name;
            sel2.appendChild(opt);
        });
    }
}

function renderTypeList() {
    const list = document.getElementById('typeList');
    list.innerHTML = '';
    appointmentTypes.forEach(t => {
        const priceDisplay = t.service_id && t.service_price
            ? `${parseFloat(t.service_price).toFixed(2)}₺ (KDV: %${t.service_tax_rate || 0})`
            : `${parseFloat(t.default_price).toFixed(2)}₺`;

        const serviceInfo = t.service_name
            ? `<small class="text-primary"><i class="bi bi-link-45deg"></i> ${escapeHtml(t.service_name)}</small>`
            : '';

        const item = document.createElement('div');
        item.className = 'd-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded';
        item.innerHTML = `
            <div class="d-flex align-items-center">
                <div style="width:12px; height:12px; border-radius:50%; background:${t.color_code}" class="me-2"></div>
                <div>
                    <div class="fw-bold small">${escapeHtml(t.name)}</div>
                    <small class="text-muted">${t.duration_minutes}dk - ${priceDisplay}</small>
                    ${serviceInfo}
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

// Hizmet dropdown'ını randevu türleri modalına doldur (TomSelect ile aranabilir)
let serviceSelectInitialized = false;

function initTypeServiceSelect() {
    const sel = document.getElementById('typeServiceSelect');
    if (!sel) return;

    // Zaten başlatılmışsa çık
    if (serviceTomSelect) return;

    // TomSelect başlat (Remote Search) - DOKTOR EKRANIYLA AYNI AYARLAR
    serviceTomSelect = new TomSelect('#typeServiceSelect', {
        valueField: 'id',
        labelField: 'name',
        searchField: ['name'],
        placeholder: 'Hizmet ara (en az 2 karakter)...',
        preload: false,
        loadThrottle: 500,
        allowEmptyOption: true,
        // dropdownParent: 'body', // KALDIRILDI - DOKTOR EKRANINDA YOK
        load: function (query, callback) {
            if (query.length < 2) return callback();
            api.get(`/api/services/search?q=${encodeURIComponent(query)}`)
                .then(res => {
                    if (res.data && Array.isArray(res.data)) {
                        const results = res.data.map(s => ({
                            id: s.id,
                            name: s.name,
                            price: parseFloat(s.price || 0),
                            tax_rate: parseFloat(s.tax_rate || 0),
                            code: s.code || ''
                        }));
                        callback(results);
                    } else {
                        callback();
                    }
                })
                .catch(err => {
                    console.error('Service search error:', err);
                    callback();
                });
        },
        render: {
            option: function (data, escape) {
                return `<div class="py-2 px-3 border-bottom">
                    <div class="fw-bold text-primary">${escape(data.name)}</div>
                    <div class="d-flex justify-content-between align-items-center mt-1">
                        <small class="text-muted">${data.code ? escape(data.code) : ''}</small>
                        <div class="fw-bold text-success">${parseFloat(data.price).toFixed(2)} ₺</div>
                    </div>
                </div>`;
            },
            item: function (data, escape) {
                return `<div>${escape(data.name)} <span class="text-muted ms-2">(${parseFloat(data.price).toFixed(2)} ₺)</span></div>`;
            },
            no_results: (data, escape) => `<div class="no-results p-2">"${escape(data.input)}" için sonuç bulunamadı</div>`,
            loading: (data, escape) => `<div class="spinner-border spinner-border-sm text-primary m-2" role="status"></div> Aranıyor...`
        },
        onChange: function (value) {
            if (!value) {
                handleServiceChange(null, null);
                return;
            }
            const s = this.options[value];
            handleServiceChange(value, s);
        }
    });
}

function renderServiceOptionsForTypes() {
    // Bu fonksiyon artık modal tetiklendiğinde initTypeServiceSelect'i çağırıyor
    console.log('Hizmet seçimi modal açılışına bağlandı.');
}

// Hizmet seçildiğinde fiyatı otomatik doldur
function handleServiceChange(serviceId, serviceData) {
    const priceHint = document.getElementById('servicePriceHint');
    const priceValue = document.getElementById('servicePriceValue');
    const defaultPriceInput = document.getElementById('typeDefaultPrice');

    if (serviceId && serviceData) {
        const price = parseFloat(serviceData.price).toFixed(2);
        const taxRate = serviceData.tax_rate || 0;
        priceHint.style.display = 'block';
        priceValue.textContent = `${price}₺ (KDV: %${taxRate})`;
        defaultPriceInput.value = price;
    } else {
        priceHint.style.display = 'none';
        // defaultPriceInput.value = '0.00'; // Opsiyonel: Fiyatı sıfırlama
    }
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
        document.getElementById('createStatusSelect').value = app.status;

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

async function toggleServicePanel() {
    const panel = document.getElementById('serviceSelectionPanel');
    if (!panel) return;

    if (panel.style.display === 'none') {
        panel.style.display = 'block';

        // CRITICAL FIX: Bootstrap focus hapsini kır (Vanilla JS)
        const modal = document.getElementById('detailModal');
        if (modal) modal.removeAttribute('tabindex');

        // TomSelect başlat
        if (!billingServiceTomSelect) {
            initBillingServiceSelect();
        }
    } else {
        panel.style.display = 'none';
        if (billingServiceTomSelect) billingServiceTomSelect.clear();
    }
}

function initBillingServiceSelect() {
    billingServiceTomSelect = new TomSelect('#inlineServiceSelect', {
        valueField: 'id',
        labelField: 'name',
        searchField: ['name'],
        placeholder: 'Hizmet ara...',
        preload: false,
        loadThrottle: 500,
        // dropdownParent: 'body', // Disable for inline feeling, relying on focus fix
        load: function (query, callback) {
            if (query.length < 2) return callback();
            api.get(`/api/services/search?q=${encodeURIComponent(query)}`)
                .then(res => {
                    if (res.data && Array.isArray(res.data)) {
                        const results = res.data.map(s => ({
                            id: s.id,
                            name: s.name,
                            price: parseFloat(s.price || 0),
                            tax_rate: parseFloat(s.tax_rate || 0),
                            code: s.code || ''
                        }));
                        callback(results);
                    } else {
                        callback();
                    }
                })
                .catch(err => {
                    console.error('Service search error:', err);
                    callback();
                });
        },
        render: {
            option: function (data, escape) {
                return `<div class="py-2 px-3 border-bottom">
                    <div class="fw-bold text-primary">${escape(data.name)}</div>
                    <div class="d-flex justify-content-between align-items-center mt-1">
                        <small class="text-muted">${data.code ? escape(data.code) : ''}</small>
                        <div class="fw-bold text-success">${parseFloat(data.price).toFixed(2)} ₺</div>
                    </div>
                </div>`;
            },
            item: function (data, escape) {
                return `<div>${escape(data.name)} <span class="text-muted ms-2">(${parseFloat(data.price).toFixed(2)} ₺)</span></div>`;
            },
            no_results: (data, escape) => `<div class="no-results p-2">"${escape(data.input)}" için sonuç bulunamadı</div>`,
            loading: (data, escape) => `<div class="spinner-border spinner-border-sm text-primary m-2" role="status"></div> Aranıyor...`
        }
    });
}

async function handleConfirmAddService() {
    if (!billingServiceTomSelect) return;
    const val = billingServiceTomSelect.getValue();
    if (!val) {
        Utils.showError('Lütfen bir hizmet seçin');
        return;
    }

    const s = billingServiceTomSelect.options[val];

    try {
        await api.post(`/api/appointments/${currentAppointmentId}/items`, {
            service_id: s.id,
            item_name: s.name,
            unit_price: s.price,
            quantity: 1
        });

        Utils.showSuccess('Hizmet eklendi');

        // Paneli gizle ve temizle
        document.getElementById('serviceSelectionPanel').style.display = 'none';
        billingServiceTomSelect.clear();

        // Detayı yenile
        viewDetail(currentAppointmentId);
    } catch (e) {
        Utils.showError('Hizmet eklenemedi');
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

    // service_id boşsa null olarak gönder
    if (!data.service_id) data.service_id = null;

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
    form.querySelector('[name="id"]').value = type.id;
    form.querySelector('[name="name"]').value = type.name;
    form.querySelector('[name="color_code"]').value = type.color_code;
    form.querySelector('[name="duration_minutes"]').value = type.duration_minutes;
    form.querySelector('[name="default_price"]').value = type.default_price;

    // TomSelect ile hizmet seçimini ayarla
    if (serviceTomSelect) {
        if (type.service_id) {
            // Mevcut hizmeti seçeneklere ekle (yoksa gösterilmez)
            serviceTomSelect.addOption({
                id: type.service_id,
                name: type.service_name,
                price: type.service_price,
                tax_rate: type.service_tax_rate
            });
            serviceTomSelect.setValue(type.service_id, true); // silent=true
        } else {
            serviceTomSelect.clear(true);
        }
    }

    // Hizmet seçiliyse fiyat bilgisini göster
    const priceHint = document.getElementById('servicePriceHint');
    const priceValue = document.getElementById('servicePriceValue');
    if (type.service_id && type.service_price) {
        priceHint.style.display = 'block';
        priceValue.textContent = `${parseFloat(type.service_price).toFixed(2)}₺ (KDV: %${type.service_tax_rate || 0})`;
    } else {
        priceHint.style.display = 'none';
    }

    // Buton metnini güncelle ve İptal butonunu göster
    const submitBtn = document.getElementById('typeSubmitBtn');
    submitBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Türü Güncelle';
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
    form.querySelector('[name="id"]').value = '';
    form.querySelector('[name="color_code"]').value = '#3788d8';
    form.querySelector('[name="duration_minutes"]').value = '30';
    form.querySelector('[name="default_price"]').value = '0';

    // TomSelect'i temizle
    if (serviceTomSelect) {
        serviceTomSelect.clear(true); // silent=true
    }

    const submitBtn = document.getElementById('typeSubmitBtn');
    submitBtn.innerHTML = '<i class="bi bi-plus-lg me-1"></i> Yeni Tür Ekle';
    const cancelBtn = document.getElementById('btnCancelTypeEdit');
    if (cancelBtn) cancelBtn.style.display = 'none';

    // Fiyat hint'ini gizle
    const priceHint = document.getElementById('servicePriceHint');
    if (priceHint) priceHint.style.display = 'none';
}

async function refreshDetail() {
    const res = await api.get(`/api/appointments/${currentAppointmentId}`);
    renderBillingItems(res.data.items, res.data.total_amount);
}

// HELPERS
function getStatusLabel(s) {
    const status = appointmentStatuses.find(x => x.status_code === s);
    if (status) return status.name;

    const labels = { unconfirmed: 'Onay Bekliyor', confirmed: 'Onaylandı', waiting: 'Klinikte', in_test: 'İşlemde', completed: 'Tamamlandı', cancelled: 'İptal', did_not_come: 'Gelmedi' };
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
    document.getElementById('saveAppointmentBtn').innerHTML = '<i class="bi bi-calendar-check me-1"></i> Randevu Oluştur';
    document.getElementById('saveAppointmentBtn').disabled = true;

    const f = document.getElementById('appointmentForm');
    f.reset();
    if (patientTomSelect) {
        patientTomSelect.clear();
        patientTomSelect.enable();
    }
    if (doctorTomSelect) doctorTomSelect.clear();

    // Tarihi bugün yap
    document.getElementById('appDate').value = document.getElementById('filterDate').value || new Date().toISOString().split('T')[0];
    document.getElementById('appTime').value = '';
    document.getElementById('selectedSlot').value = '';

    // Slot grid'i temizle
    resetSlotGrid();

    // Quick date butonlarını resetle
    document.querySelectorAll('.quick-date').forEach(b => b.classList.remove('active'));

    // Working hours info'yu gizle
    document.getElementById('workingHoursInfo').style.display = 'none';
}

// ==========================================
// SLOT GRID FUNCTIONS
// ==========================================

let currentSlots = [];
let selectedSlotData = null;

async function loadAvailableSlots() {
    const date = document.getElementById('appDate').value;
    const typeId = document.getElementById('typeSelect').value;
    const doctorId = document.getElementById('doctorSelect')?.value || '';

    const container = document.getElementById('slotGridContainer');

    if (!date) {
        resetSlotGrid();
        return;
    }

    // Loading state
    container.innerHTML = `
        <div class="slot-loading">
            <div class="spinner-border text-primary mb-2" role="status"></div>
            <div class="text-muted">Uygun saatler yükleniyor...</div>
        </div>
    `;

    try {
        const params = { date };
        if (typeId) params.type_id = typeId;
        if (doctorId) params.doctor_id = doctorId;

        const res = await api.get('/api/appointments/available-slots', { params });
        const data = res.data;

        currentSlots = data.slots || [];

        // Update counts
        document.getElementById('availableSlotCount').textContent = `${data.available_count || 0} uygun`;
        document.getElementById('occupiedSlotCount').textContent = `${data.occupied_count || 0} dolu`;

        // Working hours info
        if (data.working_hours) {
            const dayNames = ['pazar', 'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi'];
            const dateObj = new Date(date);
            const dayName = dayNames[dateObj.getDay()];
            const daySchedule = data.working_hours[dayName];

            if (daySchedule && daySchedule.open) {
                document.getElementById('workingHoursText').textContent = `${daySchedule.start} - ${daySchedule.end}`;
                document.getElementById('workingHoursInfo').style.display = 'block';
            }
        }

        // Check if day is closed
        if (data.is_closed) {
            container.innerHTML = `
                <div class="slot-closed-day">
                    <i class="bi bi-calendar-x d-block"></i>
                    <strong>${data.closed_message || 'Bu gün klinik kapalıdır.'}</strong>
                    <p class="mb-0 mt-2 small">Lütfen başka bir gün seçin.</p>
                </div>
            `;
            return;
        }

        // Render slot grid
        renderSlotGrid();

    } catch (e) {
        console.error('Slot yükleme hatası:', e);
        container.innerHTML = `
            <div class="slot-grid-placeholder text-center text-danger py-5">
                <i class="bi bi-exclamation-circle fs-1 mb-3 d-block"></i>
                <p>Slotlar yüklenirken hata oluştu</p>
            </div>
        `;
    }
}

function renderSlotGrid() {
    const container = document.getElementById('slotGridContainer');

    if (!currentSlots.length) {
        container.innerHTML = `
            <div class="slot-grid-placeholder text-center text-muted py-5">
                <i class="bi bi-calendar-x fs-1 mb-3 d-block opacity-50"></i>
                <p>Bu gün için uygun slot bulunamadı</p>
            </div>
        `;
        return;
    }

    let html = '<div class="slot-grid">';

    currentSlots.forEach((slot, index) => {
        const statusClass = slot.available ? 'available' : 'occupied';
        const isSelected = selectedSlotData && selectedSlotData.time === slot.time;
        const selectedClass = isSelected ? ' selected' : '';
        const clickHandler = slot.available ? `onclick="selectSlot(${index})"` : '';
        const tooltip = slot.occupied_by
            ? `title="${slot.occupied_by.patient_name} - ${slot.occupied_by.type_name}"`
            : '';

        html += `
            <div class="slot-item ${statusClass}${selectedClass}" ${clickHandler} ${tooltip}>
                <span class="slot-time">${slot.time}</span>
                <span class="slot-end">- ${slot.end_time}</span>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function selectSlot(index) {
    const slot = currentSlots[index];
    if (!slot || !slot.available) return;

    selectedSlotData = slot;

    // Update hidden inputs
    document.getElementById('appTime').value = slot.time;
    document.getElementById('selectedSlot').value = slot.datetime;

    // Re-render grid to show selection
    renderSlotGrid();

    // Enable save button if all required fields are filled
    validateAppointmentForm();
}

function resetSlotGrid() {
    selectedSlotData = null;
    currentSlots = [];

    const container = document.getElementById('slotGridContainer');
    container.innerHTML = `
        <div class="slot-grid-placeholder text-center text-muted py-5">
            <i class="bi bi-calendar3 fs-1 mb-3 d-block opacity-50"></i>
            <p>Uygun slotları görmek için tarih seçin</p>
        </div>
    `;

    document.getElementById('availableSlotCount').textContent = '0 uygun';
    document.getElementById('occupiedSlotCount').textContent = '0 dolu';
    document.getElementById('workingHoursInfo').style.display = 'none';
}

function validateAppointmentForm() {
    const patientId = patientTomSelect ? patientTomSelect.getValue() : document.getElementById('patientSelect').value;
    const typeId = document.getElementById('typeSelect').value;
    const time = document.getElementById('appTime').value;
    const date = document.getElementById('appDate').value;

    const isValid = patientId && typeId && time && date;
    document.getElementById('saveAppointmentBtn').disabled = !isValid;
}

// Expose to global scope
window.selectSlot = selectSlot;
window.viewDetail = viewDetail;
window.removeBillingItem = removeBillingItem;
window.editType = editType;
window.deleteType = deleteType;
window.resetTypeForm = resetTypeForm;
