/**
 * Pozitif Klinik - Muayene Ekranı JS
 */

let currentAppointmentId = null;
let currentPatientId = null;
let currentExaminationId = null;
let diagnosisTomSelect = null;
let billingModal = null;
let allServices = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Get appointment ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentAppointmentId = urlParams.get('appointment_id');
    billingModal = new bootstrap.Modal(document.getElementById('billingModal'));

    if (!currentAppointmentId) {
        Utils.showError('Randevu bilgisi bulunamadı!');
        return;
    }

    setupDiagnosisSearch();
    await loadInitialData();
    setupEventListeners();
});

async function loadInitialData() {
    try {
        Utils.showLoading('Bilgiler yükleniyor...');

        // 1. Load appointment & patient info
        const appRes = await api.get(`/api/appointments/${currentAppointmentId}`);
        const appointment = appRes.data;
        currentPatientId = appointment.patient_id;

        renderPatientInfo(appointment);

        // 2. Load current examination for this appointment (if exists)
        const examRes = await api.get(`/api/examinations/appointment/${currentAppointmentId}`);
        if (examRes.data) {
            fillExaminationForm(examRes.data);
            currentExaminationId = examRes.data.id;
        }

        // 3. Load previous examinations
        await loadHistory();

        // 4. Load all available services for billing
        await loadServices();

        Utils.closeLoading();
    } catch (e) {
        Utils.showError('Veriler yüklenirken bir hata oluştu');
        console.error(e);
    }
}

function renderPatientInfo(app) {
    document.getElementById('patientNameDisplay').textContent = app.patient_name;
    document.getElementById('patientInitial').textContent = app.patient_name.charAt(0).toUpperCase();
    document.getElementById('patientSubInfo').textContent = `ID: ${app.patient_id} | Protocol: ${app.protocol_no || '-'} | Randevu: ${app.appointment_date}`;
    document.getElementById('patientIdInput').value = app.patient_id;
}

async function loadHistory() {
    try {
        const res = await api.get(`/api/examinations/patient/${currentPatientId}`);
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';

        if (res.data.length === 0) {
            historyList.innerHTML = '<div class="text-center py-4 text-muted small">Önceki muayene kaydı bulunamadı</div>';
            return;
        }

        res.data.forEach(exam => {
            const item = document.createElement('div');
            item.className = 'history-item';
            if (exam.id == currentExaminationId) item.classList.add('active');

            const date = Utils.formatDate(exam.created_at);
            const summary = exam.diagnosis || exam.complaint || 'Detay belirtilmemiş';

            item.innerHTML = `
                <div class="history-date">${date}</div>
                <div class="small text-primary mb-1">${exam.doctor_name || 'Doktor'}</div>
                <div class="history-summary">${summary}</div>
            `;

            item.onclick = () => viewHistoricalExam(exam);
            historyList.appendChild(item);
        });
    } catch (e) {
        console.error('History error', e);
    }
}

async function loadServices() {
    console.log('[EXAM] Loading services from /api/services...');
    try {
        const res = await api.get('/api/services');
        console.log('[EXAM] API Response Status:', res.status, 'Message:', res.message);
        console.log('[EXAM] Raw Data Received:', res.data);

        // Standardize the response data access
        allServices = res.data || [];
        console.log('[EXAM] Final allServices array length:', allServices.length);

        if (allServices.length === 0) {
            console.warn('[EXAM] WARNING: allServices is empty!');
        }
    } catch (e) {
        console.error('[EXAM] Services load error:', e);
        allServices = [];
    }
}

async function handleShowBilling() {
    billingModal.show();
    await refreshBilling();
}

async function refreshBilling() {
    const tbody = document.getElementById('billingItemsBody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Yükleniyor...</td></tr>';

    try {
        const res = await api.get(`/api/appointments/${currentAppointmentId}`);
        const app = res.data;
        renderBillingItems(app.items || [], app.total_amount || 0);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Yüklenemedi!</td></tr>';
    }
}

function renderBillingItems(items, total) {
    const tbody = document.getElementById('billingItemsBody');
    tbody.innerHTML = '';

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Henüz hizmet eklenmemiş</td></tr>';
    } else {
        items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.item_name}</td>
                <td class="text-center">${item.quantity}</td>
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
    }

    document.getElementById('billingGrandTotal').textContent = parseFloat(total).toFixed(2) + ' ₺';
}

async function handleAddService() {
    console.log('[EXAM] handleAddService clicked. Current allServices count:', allServices.length);
    // List boşsa tekrar yüklemeyi dene
    if (allServices.length === 0) {
        console.log('[EXAM] allServices is empty, re-loading...');
        await loadServices();
    }
    console.log('[EXAM] Final list for TomSelect:', allServices);

    const { value: serviceId } = await Swal.fire({
        title: 'Hizmet Seçin',
        html: '<select id="swalServiceSelect" class="form-select"></select>',
        showCancelButton: true,
        confirmButtonText: 'Ekle',
        cancelButtonText: 'İptal',
        didOpen: () => {
            console.log('[EXAM] Initializing TomSelect with', allServices.length, 'services');
            try {
                const tsOptions = allServices.map(s => ({
                    id: s.id,
                    name: s.name || 'İsimsiz',
                    price: parseFloat(s.price || 0),
                    code: s.code || s.legacy_code || '',
                    category: s.category || ''
                }));

                new TomSelect('#swalServiceSelect', {
                    options: tsOptions,
                    valueField: 'id',
                    labelField: 'name',
                    searchField: ['name', 'code', 'category'],
                    placeholder: 'Hizmet veya kod ara...',
                    maxOptions: 100, // Varsayılan 50'yi artırıyoruz
                    render: {
                        option: (d, e) => `
                            <div class="py-2 border-bottom">
                                <div class="fw-bold text-primary">${e(d.name)}</div>
                                <div class="d-flex justify-content-between align-items-center mt-1">
                                    <div class="small">
                                        ${d.category ? `<span class="badge bg-secondary-subtle text-secondary me-1">${e(d.category)}</span>` : ''}
                                        ${d.code ? `<span class="badge bg-light text-dark border me-1">${e(d.code)}</span>` : ''}
                                    </div>
                                    <div class="fw-bold text-success">${d.price.toFixed(2)} ₺</div>
                                </div>
                            </div>`,
                        item: (d, e) => `<div>${e(d.name)}</div>`,
                        no_results: (data, escape) => `<div class="no-results">"${escape(data.input)}" için sonuç bulunamadı</div>`
                    }
                });
                console.log('[EXAM] TomSelect initialized successfully');
            } catch (tsError) {
                console.error('[EXAM] TomSelect initialization failed:', tsError);
            }
        },
        preConfirm: () => document.getElementById('swalServiceSelect').value
    });

    if (serviceId) {
        const s = allServices.find(x => x.id == serviceId);
        try {
            await api.post(`/api/appointments/${currentAppointmentId}/items`, {
                service_id: s.id,
                item_name: s.name,
                unit_price: s.price,
                quantity: 1
            });
            refreshBilling();
        } catch (e) {
            Utils.showError('Hizmet eklenemedi');
        }
    }
}

window.removeBillingItem = async (itemId) => {
    const confirmed = await Utils.showConfirm('Emin misiniz?', 'Bu hizmet kaydı silinecek.');
    if (confirmed) {
        try {
            await api.delete(`/api/appointments/${currentAppointmentId}/items/${itemId}`);
            refreshBilling();
        } catch (e) {
            Utils.showError('Silinemedi');
        }
    }
};

function fillExaminationForm(exam) {
    document.getElementById('examinationIdInput').value = exam.id;
    document.getElementById('complaint').value = exam.complaint || '';
    document.getElementById('anamnez').value = exam.anamnez || '';
    document.getElementById('bulgular').value = exam.bulgular || '';
    document.getElementById('diagnosis').value = exam.diagnosis || '';
    document.getElementById('treatment').value = exam.treatment || '';
    document.getElementById('result_note').value = exam.result_note || '';

    if (exam.created_at) {
        document.getElementById('lastSavedTime').textContent = Utils.formatDate(exam.created_at);
    }
}

function viewHistoricalExam(exam) {
    Swal.fire({
        title: `Muayene Detayı - ${Utils.formatDate(exam.created_at)}`,
        html: `
            <div class="text-start small">
                <p><strong>Şikayet:</strong> ${exam.complaint || '-'}</p>
                <p><strong>Anamnez:</strong> ${exam.anamnez || '-'}</p>
                <p><strong>Bulgular:</strong> ${exam.bulgular || '-'}</p>
                <p><strong>Tanı:</strong> ${exam.diagnosis || '-'}</p>
                <p><strong>Tedavi:</strong> ${exam.treatment || '-'}</p>
                <p><strong>Not:</strong> ${exam.result_note || '-'}</p>
            </div>
        `,
        confirmButtonText: 'Kapat',
        width: '600px'
    });
}

function setupDiagnosisSearch() {
    // ICD-10 Search with TomSelect (Backend linked)
    diagnosisTomSelect = new TomSelect('#diagnosisSelect', {
        valueField: 'code',
        labelField: 'name',
        searchField: ['name', 'code'],
        load: function (query, callback) {
            const url = `/api/general/diagnoses?q=${encodeURIComponent(query)}`;
            api.get(url)
                .then(res => callback(res.data))
                .catch(() => callback());
        },
        render: {
            option: function (item, escape) {
                return `<div>
                    <span class="badge bg-light text-dark me-2">${escape(item.code)}</span>
                    <span>${escape(item.name)}</span>
                </div>`;
            }
        },
        placeholder: 'Tanı ara (Örn: Hipertansiyon)...',
        onChange: function (value) {
            if (value) {
                const item = this.options[value];
                addText('diagnosis', `${item.code} - ${item.name}`);
                this.clear();
            }
        }
    });

    // İlk açılışta sık kullanılanları yükle
    diagnosisTomSelect.load('');
}

function setupEventListeners() {
    document.getElementById('btnSaveExamination').addEventListener('click', handleSave);
    document.getElementById('btnShowBilling').addEventListener('click', handleShowBilling);
    document.getElementById('btnAddServiceDirect').addEventListener('click', handleAddService);
}

async function handleSave() {
    const form = document.getElementById('examinationForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
        Utils.showLoading('Kaydediliyor...');

        let res;
        if (currentExaminationId) {
            res = await api.put(`/api/examinations/${currentExaminationId}`, data);
        } else {
            res = await api.post('/api/examinations', data);
            if (res.id) currentExaminationId = res.id;
        }

        Utils.showToast('Muayene başarıyla kaydedildi');
        document.getElementById('lastSavedTime').textContent = Utils.formatDate(new Date());

        // If it was a first save, update the status to completed if needed? 
        // User didn't ask for automatic status change but usually it helps.

        await loadHistory();
        Utils.closeLoading();
    } catch (e) {
        Utils.showError(typeof e === 'string' ? e : 'Kaydedilirken hata oluştu');
    }
}

// Global helper for quick text append
window.addText = (targetId, text) => {
    const el = document.getElementById(targetId);
    if (!el) return;

    if (el.value) {
        el.value += '\n' + text;
    } else {
        el.value = text;
    }
    el.focus();
};
