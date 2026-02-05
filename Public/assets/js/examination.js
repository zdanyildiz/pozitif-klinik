/**
 * Pozitif Klinik - Muayene Ekranı JS
 */

let currentAppointmentId = null;
let currentPatientId = null;
let currentExaminationId = null;
let diagnosisTomSelect = null;
let billingModal = null;
let allServices = [];
let examFileManager = null;

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
    setupEventListeners();

    // Start loading process
    await initPageData();
});

async function initPageData() {
    Utils.showLoading('Veriler yükleniyor...');

    try {
        // 1. Critical: Load appointment & patient info first
        const appRes = await api.get(`/api/appointments/${currentAppointmentId}`);
        const appointment = appRes.data;
        currentPatientId = appointment.patient_id;
        renderPatientInfo(appointment);
    } catch (e) {
        Utils.showError('Randevu detayları yüklenemedi. Lütfen sayfayı yenileyin.');
        console.error('Critical load error:', e);
        Utils.closeLoading();
        return; // Stop execution if critical data is missing
    }

    // 2. Load other data in parallel (independent of each other)
    // Even if history fails, services should load
    const promises = [
        loadServices(),
        loadCurrentExamination(),
        loadHistory()
    ];

    await Promise.allSettled(promises);

    Utils.closeLoading();
}

async function loadCurrentExamination() {
    try {
        const examRes = await api.get(`/api/examinations/appointment/${currentAppointmentId}`);
        if (examRes.data) {
            fillExaminationForm(examRes.data);
            currentExaminationId = examRes.data.id;
            initExamFileManager(currentExaminationId);
        }
    } catch (e) {
        console.error('Examination load error:', e);
        // Silent fail is acceptable here, maybe it's a new examination
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

            let filesHtml = '';
            if (exam.files && exam.files.length > 0) {
                filesHtml = `<div class="mt-2 d-flex gap-1 flex-wrap">`;
                exam.files.forEach(f => {
                    const catIcons = { radiology: 'bi-x-ray', lab: 'bi-eyedropper', report: 'bi-file-earmark-medical', prescription: 'bi-capsule', other: 'bi-file-earmark' };
                    filesHtml += `<span class="badge bg-light text-primary border px-1" title="${f.display_name || f.original_name}"><i class="bi ${catIcons[f.file_category] || 'bi-file-earmark'}"></i></span>`;
                });
                filesHtml += `</div>`;
            }

            item.innerHTML = `
                <div class="history-date">${date}</div>
                <div class="small text-primary mb-1">${exam.doctor_name || 'Doktor'}</div>
                <div class="history-summary">${summary}</div>
                ${filesHtml}
            `;

            item.onclick = () => viewHistoricalExam(exam);
            historyList.appendChild(item);
        });
    } catch (e) {
        console.error('History error', e);
    }
}

async function loadServices() {
    try {
        const res = await api.get('/api/services');

        // Backend pagination support: handle array or object response
        if (Array.isArray(res.data)) {
            allServices = res.data;
        } else if (res.data && res.data.items) {
            allServices = res.data.items;
        } else {
            allServices = [];
        }

    } catch (e) {
        console.error('[EXAM] Services load error:', e);
        const errorMsg = typeof e === 'string' ? e : (e.message || 'Bilinmeyen hata');
        Utils.showToast(`Hizmet listesi yüklenemedi: ${errorMsg}`, 'warning');
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
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><i class="bi bi-info-circle me-2"></i>Bu randevuya ait işlem kaydı bulunmuyor.</td></tr>';
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

// Global variable for Service TomSelect
let serviceSelectInstance = null;

async function toggleServicePanel() {
    const panel = document.getElementById('serviceSelectionPanel');
    const isHidden = panel.style.display === 'none';

    // Toggle visibility
    panel.style.display = isHidden ? 'block' : 'none';

    if (isHidden) {
        if (!serviceSelectInstance) {
            initServiceSelect();
        } else {
            serviceSelectInstance.clear();
            serviceSelectInstance.focus();
        }
    }
}

function initServiceSelect() {
    try {
        serviceSelectInstance = new TomSelect('#inlineServiceSelect', {
            valueField: 'id',
            labelField: 'name',
            searchField: ['name', 'code'],
            // Preload kapalı, sadece arama yapınca yükle
            preload: false,
            // Yazmaya başladıktan sonra bekleme süresi (debounce)
            loadThrottle: 500,
            placeholder: 'Hizmet veya kod arayın (min 2 karakter)...',
            maxOptions: 50,

            // Sunucu taraflı arama fonksiyonu
            load: function (query, callback) {
                if (query.length < 2) return callback();

                const url = `/api/services/search?q=${encodeURIComponent(query)}`;

                api.get(url)
                    .then(res => {
                        // API yanıt formatını kontrol et
                        if (res.data && Array.isArray(res.data)) {
                            // Fiyatları number'a çevir
                            const results = res.data.map(s => ({
                                id: s.id,
                                name: s.name,
                                price: parseFloat(s.price || 0),
                                code: s.code || '',
                                category: s.category || ''
                            }));
                            callback(results);
                        } else {
                            callback();
                        }
                    })
                    .catch((err) => {
                        console.error('Service search error:', err);
                        callback();
                    });
            },

            render: {
                option: (d, e) => `
                    <div class="py-2 border-bottom px-2">
                        <div class="fw-bold text-primary">${e(d.name)}</div>
                        <div class="d-flex justify-content-between align-items-center mt-1">
                            <div class="small">
                                ${d.category ? `<span class="badge bg-secondary-subtle text-secondary me-1">${e(d.category)}</span>` : ''}
                                ${d.code ? `<span class="badge bg-light text-dark border me-1">${e(d.code)}</span>` : ''}
                            </div>
                            <div class="fw-bold text-success">${d.price.toFixed(2)} ₺</div>
                        </div>
                    </div>`,
                item: (d, e) => `<div>${e(d.name)} <span class="text-muted ms-2">(${parseFloat(d.price).toFixed(2)} ₺)</span></div>`,
                no_results: (data, escape) => `<div class="no-results p-2">"${escape(data.input)}" için sonuç bulunamadı</div>`,
                loading: (data, escape) => `<div class="spinner-border spinner-border-sm text-primary m-2" role="status"></div> Aranıyor...`
            }
        });
    } catch (e) {
        console.error('TomSelect init error', e);
        Utils.showToast('Arama kutusu yüklenemedi', 'error');
    }
}

async function handleConfirmAddService() {
    if (!serviceSelectInstance) return;
    const serviceId = serviceSelectInstance.getValue();

    if (!serviceId) {
        Utils.showToast('Lütfen bir hizmet seçin', 'warning');
        return;
    }

    // Seçilen öğenin verisini TomSelect seçeneklerinden al
    const s = serviceSelectInstance.options[serviceId];
    if (!s) return;

    try {
        const btn = document.getElementById('btnConfirmAddService');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

        await api.post(`/api/appointments/${currentAppointmentId}/items`, {
            service_id: s.id,
            item_name: s.name,
            unit_price: s.price,
            quantity: 1
        });

        Utils.showToast('Hizmet eklendi', 'success');
        refreshBilling();

        // Reset selection but keep panel open for multiple additions
        serviceSelectInstance.clear();
        serviceSelectInstance.focus();

        btn.disabled = false;
        btn.innerHTML = originalHtml;
    } catch (e) {
        Utils.showError('Hizmet eklenemedi');
        document.getElementById('btnConfirmAddService').disabled = false;
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
                <hr>
                <h6>Dosyalar:</h6>
                <div class="d-flex gap-2 flex-wrap">
                    ${(exam.files || []).map(f => `
                        <a href="/api/files/view/${f.uuid}" target="_blank" class="btn btn-xs btn-outline-primary rounded-pill">
                            <i class="bi bi-file-earmark me-1"></i>${f.display_name || f.original_name}
                        </a>
                    `).join('') || '<span class="text-muted">Dosya yok</span>'}
                </div>
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

    // Updated listeners for inline panel
    const btnToggle = document.getElementById('btnToggleServicePanel');
    if (btnToggle) btnToggle.addEventListener('click', toggleServicePanel);

    const btnAdd = document.getElementById('btnConfirmAddService');
    if (btnAdd) btnAdd.addEventListener('click', handleConfirmAddService);
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
        }

        if (res.data && res.data.id) {
            const oldId = currentExaminationId;
            currentExaminationId = res.data.id;

            // Eğer ID değiştiyse veya ilk kez set ediliyorsa dosya yöneticisini tazele
            if (oldId !== currentExaminationId) {
                initExamFileManager(currentExaminationId);
            }
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

/**
 * Dosya Yöneticisini Başlat
 */
function initExamFileManager(examId) {
    if (!examId) return;

    // Arayüzü göster
    document.getElementById('examFilesSection').style.display = 'block';

    examFileManager = new FileManager({
        module: 'examination',
        relatedId: examId,
        containerId: 'exam_file_list',
        uploadBtnId: 'exam_file_upload',
        csrfToken: window.csrfToken || ''
    });
}
