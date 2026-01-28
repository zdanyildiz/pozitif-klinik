/**
 * Pozitif Klinik - Muayene Ekranı JS
 */

let currentAppointmentId = null;
let currentPatientId = null;
let currentExaminationId = null;
let diagnosisTomSelect = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Get appointment ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentAppointmentId = urlParams.get('appointment_id');

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
    document.getElementById('btnShowBilling').addEventListener('click', () => {
        window.location.href = `${window.location.origin}${getBasePath()}/admin/appointments?detail=${currentAppointmentId}`;
    });
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
