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

    // Tür seçildiğinde slotları yeniden yükle ve ücreti getir
    document.getElementById('typeSelect').addEventListener('change', (e) => {
        loadAvailableSlots();
        const typeId = e.target.value;
        const type = appointmentTypes.find(t => t.id == typeId);
        if (type) {
            const price = (type.service_id && type.service_price) ? type.service_price : type.default_price;
            document.getElementById('appTypePrice').value = parseFloat(price || 0).toFixed(2);
        } else {
            document.getElementById('appTypePrice').value = '0.00';
        }
        validateAppointmentForm();
    });

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

    // Ödeme sonrası tabloyu yenile
    window.addEventListener('payment-saved', () => {
        loadAppointments();
        loadStats();
    });
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
    try {
        // İlk yüklemede hastaları GETİRME, sadece TomSelect'i başlat
        // renderPatientOptions(); // Kaldırıldı

        // Tom Select Başlat (Remote Search ile güçlendirildi)
        if (!patientTomSelect) {
            patientTomSelect = new TomSelect('#patientSelect', {
                valueField: 'id',
                labelField: 'text',
                searchField: ['text'],
                placeholder: 'Hasta Ara (En az 2 karakter)...',
                allowEmptyOption: true,
                preload: false, // Preload disabled
                loadThrottle: 500,

                // Başlangıçta seçenek yok
                options: [],

                onChange: function (value) {
                    validateAppointmentForm();
                },

                load: function (query, callback) {
                    if (query.length < 2) return callback();

                    // Uzak Arama: Tüm veritabanında blind index ile arama
                    api.get(`/api/patients/search?q=${encodeURIComponent(query)}`)
                        .then(res => {
                            const results = (res.data || []).map(p => ({
                                id: p.id,
                                text: `${p.name} (${p.tc_no || '-'})`
                            }));
                            callback(results);
                        })
                        .catch(() => callback());
                },
                render: {
                    option: function (data, escape) {
                        return `<div class="py-1 px-2 border-bottom">
                            <div class="fw-bold">${escape(data.text)}</div>
                            <small class="text-muted">Klinik Kaydı</small>
                        </div>`;
                    },
                    item: function (data, escape) {
                        return `<div>${escape(data.text)}</div>`;
                    },
                    no_results: (data, escape) => `<div class="no-results p-2">"${escape(data.input)}" için tam eşleşme bulunamadı</div>`,
                    loading: (data, escape) => `<div class="spinner-border spinner-border-sm text-primary m-2" role="status"></div> Aranıyor...`
                }
            });
        }
    } catch (e) {
        console.error('Hastalar yüklenemedi:', e);
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
        const statusWrapper = document.createElement('div');
        statusWrapper.className = 'd-flex align-items-center gap-2 flex-wrap';

        // Randevu Durumu Badge (Küçük versiyon)
        const statusBadge = document.createElement('span');
        if (app.status_name) {
            statusBadge.className = 'badge';
            statusBadge.style.backgroundColor = `${app.status_color}20`;
            statusBadge.style.color = app.status_color;
            statusBadge.style.border = `1px solid ${app.status_color}40`;
            statusBadge.style.fontSize = '0.75rem';
            statusBadge.innerHTML = `<i class="bi ${app.status_icon}"></i> ${app.status_name}`;
        } else {
            statusBadge.className = `badge appointment-status-${app.status}`;
            statusBadge.style.fontSize = '0.75rem';
            statusBadge.textContent = getStatusLabel(app.status);
        }
        statusWrapper.appendChild(statusBadge);

        // Ödeme Durumu Badge (Icon-only veya çok kısa)
        const paymentBadge = document.createElement('span');
        paymentBadge.className = 'badge rounded-pill';
        paymentBadge.style.fontSize = '0.7rem';
        if (app.payment_status === 'paid') {
            paymentBadge.className += ' bg-success';
            paymentBadge.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
            paymentBadge.title = 'Ödendi';
        } else if (app.payment_status === 'partially_paid') {
            paymentBadge.className += ' bg-warning text-dark';
            paymentBadge.innerHTML = '<i class="bi bi-clock-history"></i>';
            paymentBadge.title = 'Parçalı Ödeme';
        } else {
            paymentBadge.className += ' bg-light text-muted border';
            paymentBadge.innerHTML = '<i class="bi bi-wallet2"></i>';
            paymentBadge.title = 'Ödenmedi';
        }
        statusWrapper.appendChild(paymentBadge);

        tdStatus.appendChild(statusWrapper);
        row.appendChild(tdStatus);

        // Actions Column
        const tdActions = document.createElement('td');
        const actionWrapper = document.createElement('div');
        actionWrapper.className = 'd-flex justify-content-end align-items-center gap-2';

        // 1. Tahsilat Butonu (Daha şık ve küçük)
        if (app.payment_status !== 'paid') {
            const btnPay = document.createElement('button');
            btnPay.className = 'btn btn-sm btn-outline-success shadow-none';
            btnPay.style.fontSize = '0.75rem';
            btnPay.innerHTML = '<i class="bi bi-wallet2"></i> Tahsil';
            btnPay.onclick = async (e) => {
                e.stopPropagation();
                const originalHtml = btnPay.innerHTML;
                try {
                    btnPay.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                    btnPay.disabled = true;

                    const res = await api.get(`/api/appointments/${app.id}`);
                    if (res.data) {
                        openPaymentModal(res.data);
                    }
                } catch (err) {
                    console.error(err);
                    Utils.showError('Randevu bilgileri yüklenemedi.');
                } finally {
                    btnPay.innerHTML = originalHtml;
                    btnPay.disabled = false;
                }
            };
            actionWrapper.appendChild(btnPay);
        }

        // 2. Muayene Butonu
        const btnExam = document.createElement('button');
        btnExam.className = 'btn btn-sm btn-exam-action shadow-none';
        btnExam.style.fontSize = '0.75rem';
        btnExam.innerHTML = '<i class="bi bi-person-pulse"></i> Muayene';
        btnExam.onclick = (e) => {
            e.stopPropagation();
            window.location.href = `${API_URL}/admin/examination?appointment_id=${app.id}`;
        };
        actionWrapper.appendChild(btnExam);

        // 3. Diğer İşlemler (Secondary Actions)
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
            // Seçenek listesinde yoksa ekle (Remote search olduğu için gerekli)
            if (app.patient_id) {
                patientTomSelect.addOption({
                    id: app.patient_id,
                    text: app.patient_name || 'Hasta'
                });
            }
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

        // Fiyatı doldur (Varsa muayene kalemi)
        const examItem = app.items.find(i => i.item_name.includes('(Muayene)'));
        if (examItem) {
            document.getElementById('appTypePrice').value = parseFloat(examItem.unit_price).toFixed(2);
        } else {
            // Yoksa boş bırak ki kullanıcı girmek isterse girsin (veya default kalsın)
            document.getElementById('appTypePrice').value = '';
        }

        // Buton durumunu güncelle
        validateAppointmentForm();

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
        document.getElementById('detailNotes').value = app.notes || 'Not yok';
        document.getElementById('detailStatusSelect').value = app.status;
        // Render Billing
        renderBillingItems(
            app.items,
            app.total_amount,
            app.total_paid,
            app.remaining_amount,
            app.general_discount_amount,
            app.items_subtotal,
            app.items_discount_total,
            app.general_discount_note || ''
        );

        detailModal.show();
    } catch (e) {
        Utils.showError('Detay yüklenemedi');
    }
}

function openPaymentModal(app) {
    if (typeof PaymentModule !== 'undefined') {
        PaymentModule.open({
            patient_id: app.patient_id,
            appointment_id: app.id,
            total_debt: app.total_amount || 0,
            remaining_debt: app.remaining_amount !== undefined ? app.remaining_amount : (app.total_amount || 0),
            items: app.items || [],
            general_discount_amount: app.general_discount_amount || 0,
            general_discount_note: app.general_discount_note || ''
        });
    } else {
        console.error('PaymentModule not loaded');
    }
}

// item -> {id, item_name, quantity, unit_price, total_price (gross), discount_amount}
function renderBillingItems(items, netTotal, totalPaid = 0, remaining = 0, generalDiscount = 0, itemsSubtotal = 0, itemsDiscountTotal = 0, generalDiscountNote = '') {
    const tbody = document.getElementById('billingItemsBody');
    tbody.innerHTML = '';

    // Header'ı güncelle (İndirim kolonları eklendiği için)
    // Bunu JS ile yapmak yerine HTML'i güncellemem lazım ama burada dinamik tablo başlığı yok.
    // clinic_appointments.twig dosyasında statik <thead> var. Onu da güncellemeliyim.
    // Hızlı çözüm: Tablo başlığını burada JS ile kontrol edebiliriz veya sadece body'i doldururuz.
    // Twig tarafında başlığı güncelleyeceğim.

    items.forEach(item => {
        const row = document.createElement('tr');
        const unitPrice = parseFloat(item.unit_price);
        const quantity = parseInt(item.quantity);
        const grossTotal = unitPrice * quantity;
        const discount = parseFloat(item.discount_amount || 0);
        const netLineTotal = grossTotal - discount;

        row.innerHTML = `
            <td>
                <div class="fw-bold">${item.item_name}</div>
                ${item.description ? `<small class="text-muted fst-italic">${item.description}</small>` : ''}
            </td>
            <td class="text-center">${quantity}</td>
            <td class="text-end fw-semibold text-nowrap">${unitPrice.toFixed(2)} ₺</td>
            <td class="text-center">
                <button class="btn btn-sm ${discount > 0 ? 'btn-warning' : 'btn-outline-secondary'} py-0 px-2 small" 
                        onclick="showItemDiscountPrompt(${item.id}, ${discount})"
                        title="İndirim Uygula">
                    <i class="bi bi-tag"></i> ${discount > 0 ? discount.toFixed(2) + ' ₺' : ''}
                </button>
            </td>
            <td class="text-end fw-bold text-primary text-nowrap">${netLineTotal.toFixed(2)} ₺</td>
            <td class="text-end">
                <button class="btn btn-sm btn-link text-danger p-0" onclick="removeBillingItem(${item.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Özet Bilgileri Güncelle
    let summaryHtml = `
        <div class="row mt-4 g-3">
            <div class="col-md-6">
                <!-- Sol Taraf Boş veya Ek Bilgiler İçin -->
            </div>
            <div class="col-md-6">
                <div class="billing-summary-box p-3 bg-light rounded shadow-sm border">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="text-muted small">Ara Toplam:</span>
                        <span class="fw-bold fs-6">${parseFloat(itemsSubtotal).toFixed(2)} ₺</span>
                    </div>
                    
                    ${itemsDiscountTotal > 0 ? `
                    <div class="d-flex justify-content-between align-items-center mb-1 text-danger small">
                        <span class="text-muted">Kalem İndirimleri:</span>
                        <span>-${parseFloat(itemsDiscountTotal).toFixed(2)} ₺</span>
                    </div>` : ''}

                    <div class="d-flex justify-content-between align-items-baseline mb-2 border-bottom pb-2">
                        <span class="text-muted small">Genel İndirim:</span>
                        <div class="text-end">
                            <button class="btn btn-sm ${generalDiscount > 0 ? 'btn-danger' : 'btn-outline-danger'} py-0 px-2 mb-1" 
                                    onclick="toggleGeneralDiscountAreaInDetail()">
                                <i class="bi ${generalDiscount > 0 ? 'bi-pencil-square' : 'bi-plus-circle'}"></i> 
                                ${generalDiscount > 0 ? parseFloat(generalDiscount).toFixed(2) + ' ₺' : 'İndirim Tanımla'}
                            </button>
                            <div id="detailGeneralDiscountArea" class="mt-2 text-start d-none">
                                <div class="input-group input-group-sm mb-1">
                                    <input type="number" id="generalDiscountInput" class="form-control text-end" 
                                           value="${parseFloat(generalDiscount) > 0 ? parseFloat(generalDiscount).toFixed(2) : ''}" 
                                           step="0.01" min="0" placeholder="0.00">
                                    <span class="input-group-text">₺</span>
                                </div>
                                <input type="text" id="generalDiscountNoteInput" class="form-control form-control-sm mb-2" 
                                       value="${generalDiscountNote}" placeholder="İndirim notu...">
                                <button class="btn btn-sm btn-dark w-100" onclick="applyDetailGeneralDiscount()">Uygula</button>
                            </div>
                        </div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold fs-5">Genel Toplam:</span>
                        <span class="fw-bold fs-5 text-primary">${parseFloat(netTotal).toFixed(2)} ₺</span>
                    </div>

                    <div class="d-flex justify-content-between align-items-center text-success mb-2 border-bottom pb-2">
                        <span class="text-muted small">Tahsil Edilen:</span>
                        <span class="fw-bold">${parseFloat(totalPaid).toFixed(2)} ₺</span>
                    </div>

                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold fs-4">Kalan Borç:</span>
                        <span class="fw-bold fs-4 text-danger">${parseFloat(remaining).toFixed(2)} ₺</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    if (remaining <= 0 && netTotal > 0) {
        summaryHtml += `
            <div class="mt-3">
                <div class="alert alert-success py-2 mb-0 border-0 text-center small">
                    <i class="bi bi-check-circle-fill me-1"></i> Borç tamamen ödenmiştir.
                </div>
            </div>
        `;
    }

    summaryHtml += `</div>`;

    // Özeti hedeflenen container'a yerleştir
    const summaryContainer = document.getElementById('billingSummaryContainer');
    if (summaryContainer) {
        summaryContainer.innerHTML = summaryHtml;
    }
}

async function updateItemDiscount(itemId, value) {
    const discount = parseFloat(value) || 0;
    // Backend updateItem endpointine ihtiyacımız var ama şu an sadece PUT /{id}/items/{itemId} var
    // ve bu endpoint miktar (quantity) vs de bekliyor olabilir.
    // İdealde item'ı önce bulup sonra full update yapmak lazım ama bu yavaş.
    // AppointmentController updateItem methodu sadece gönderilen fieldları güncellemeli veya biz hepsini göndermeliyiz.
    // Şu anki item verisine ihtiyacımız var. `currentAppointmentId` ile cache'den veya DOM'dan alabiliriz.
    // DOM'dan almak riskli.

    // Hızlı çözüm: API'den veriyi al, update et.
    try {
        const res = await api.get(`/api/appointments/${currentAppointmentId}`);
        const item = res.data.items.find(i => i.id == itemId);
        if (!item) return;

        await api.put(`/api/appointments/${currentAppointmentId}/items/${itemId}`, {
            item_name: item.item_name,
            unit_price: item.unit_price,
            quantity: item.quantity,
            description: item.description,
            discount_amount: discount
        });

        refreshDetail(); // Recalculate everything
    } catch (e) {
        console.error(e);
        Utils.showError('İndirim güncellenemedi');
    }
}

async function updateGeneralDiscount(value, note = null) {
    const discount = parseFloat(value) || 0;
    try {
        await api.put(`/api/appointments/${currentAppointmentId}/discount`, {
            amount: discount,
            note: note
        });
        refreshDetail();
    } catch (e) {
        console.error(e);
        Utils.showError('Genel indirim güncellenemedi');
    }
}

function handleCollectPaymentFromModal() {
    // 1. Detay modalını kapat (Mimari kural: Modal içinde modal yasak)
    detailModal.hide();

    // 2. Güncel veriyi çek ve ödeme modalını aç
    // Global appointments listesi eski kalmış olabilir, her zaman sunucudan taze veri çekiyoruz.
    api.get(`/api/appointments/${currentAppointmentId}`)
        .then(res => {
            const app = res.data;
            if (app) {
                openPaymentModal(app);
            } else {
                Utils.showError('Randevu verilerine ulaşılamadı.');
            }
        })
        .catch(err => {
            console.error('Payment data fetch error:', err);
            Utils.showError('Ödeme ekranı açılırken hata oluştu.');
        });
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

        // Eğer durum "Tamamlandı" (completed) seçildiyse ve borç varsa ödeme ekranını aç
        if (status === 'completed') {
            const res = await api.get(`/api/appointments/${currentAppointmentId}`);
            const app = res.data;
            if (app.remaining_amount > 0) {
                detailModal.hide();
                openPaymentModal(app);
            } else {
                detailModal.hide();
            }
        } else {
            detailModal.hide();
        }

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
    const app = res.data;
    renderBillingItems(
        app.items,
        app.total_amount,
        app.total_paid,
        app.remaining_amount,
        app.general_discount_amount,
        app.items_subtotal || 0,
        app.items_discount_total || 0,
        app.general_discount_note || ''
    );
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

async function showItemDiscountPrompt(itemId, currentDiscount) {
    // SweetAlert'i doğrudan modal içine hedefleyerek odaklanma (focus) sorununu çözüyoruz
    const { value: discount } = await Swal.fire({
        target: document.getElementById('detailModal'),
        title: 'Kalem İndirimi',
        input: 'number',
        inputLabel: 'İndirim Tutarı (₺)',
        inputValue: currentDiscount || '',
        showCancelButton: true,
        confirmButtonText: 'Uygula',
        cancelButtonText: 'İptal',
        buttonsStyling: true,
        customClass: {
            container: 'position-absolute' // Modal içinde düzgün konumlanması için
        },
        didOpen: () => {
            const input = Swal.getInput();
            if (input) {
                input.focus();
                input.select();
            }
        },
        inputValidator: (value) => {
            if (value < 0) return 'Negatif indirim giremezsiniz!';
        }
    });

    if (discount !== undefined && discount !== null) {
        updateItemDiscount(itemId, discount);
    }
}

function toggleGeneralDiscountAreaInDetail() {
    const area = document.getElementById('detailGeneralDiscountArea');
    if (area) area.classList.toggle('d-none');
}

function applyDetailGeneralDiscount() {
    const val = document.getElementById('generalDiscountInput').value;
    const note = document.getElementById('generalDiscountNoteInput').value;
    updateGeneralDiscount(val, note);
}

// Expose to global scope
window.selectSlot = selectSlot;
window.viewDetail = viewDetail;
window.removeBillingItem = removeBillingItem;
window.editType = editType;
window.deleteType = deleteType;
window.resetTypeForm = resetTypeForm;
window.showItemDiscountPrompt = showItemDiscountPrompt;
window.toggleGeneralDiscountAreaInDetail = toggleGeneralDiscountAreaInDetail;
window.applyDetailGeneralDiscount = applyDetailGeneralDiscount;
