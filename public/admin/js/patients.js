/**
 * Pozitif Klinik - Hasta Yönetimi Scripts
 */

// Token & Yetki Kontrolü
const token = localStorage.getItem('platform_token');
const userType = localStorage.getItem('user_type');

if (!token || userType !== 'clinic_user') {
    window.location.href = 'index.html';
}

// Global State
let allPatients = [];
let patientModal;
let detailModal;

// DOM Elements
const patientsTableBody = document.getElementById('patientsTableBody');
const patientForm = document.getElementById('patientForm');
const btnSavePatient = document.getElementById('btnSavePatient');
const btnAddPatient = document.getElementById('btnAddPatient');
const patientSearch = document.getElementById('patientSearch');
const logoutBtn = document.getElementById('logoutBtn');

// Detail Modal Elements
const vitalsTableBody = document.getElementById('vitalsTableBody');
const btnAddVital = document.getElementById('btnAddVital');

// Stats Elements
const totalPatientsCountEl = document.getElementById('totalPatientsCount');
const malePatientsCountEl = document.getElementById('malePatientsCount');
const femalePatientsCountEl = document.getElementById('femalePatientsCount');

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    patientModal = new bootstrap.Modal(document.getElementById('patientModal'));
    detailModal = new bootstrap.Modal(document.getElementById('detailModal'));

    // Kullanıcı bilgilerini göster
    document.getElementById('userName').textContent = 'Klinik Personeli';
    document.getElementById('userRole').textContent = 'Yetkili';

    loadPatients();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Yeni Hasta Modalını Aç
    btnAddPatient.addEventListener('click', () => {
        resetPatientForm();
        document.getElementById('patientModalLabel').innerHTML = '<i class="bi bi-person-plus me-2"></i>Yeni Hasta Ekle';
        patientModal.show();
    });

    // Filtreleme (Arama)
    patientSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        renderPatients(query);
    });

    // Hasta Kaydet
    btnSavePatient.addEventListener('click', handleSavePatient);

    // Çıkış Yap
    logoutBtn.addEventListener('click', handleLogout);
}

// Hastaları API'den Yükle
async function loadPatients() {
    try {
        const response = await api.get('/api/patients');
        allPatients = response.data?.patients || [];

        updateStats();
        renderPatients();
    } catch (error) {
        console.error('Hastalar yüklenirken hata:', error);
        Utils.showError('Hasta listesi yüklenemedi.');
        renderErrorState();
    }
}

// Hastaları Tabloya Bas (Filtreleme dahil)
function renderPatients(searchQuery = '') {
    patientsTableBody.innerHTML = '';

    const filtered = allPatients.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(searchQuery);
        const tcMatch = p.tc_no.includes(searchQuery);
        return nameMatch || tcMatch;
    });

    if (filtered.length === 0) {
        renderEmptyState(searchQuery ? 'Arama sonucu bulunamadı.' : 'Henüz kayıtlı hasta bulunmuyor.');
        return;
    }

    filtered.forEach(patient => {
        const row = document.createElement('tr');

        // Cinsiyet Formatlama
        const genderMap = { 'M': 'Erkek', 'F': 'Kadın', 'U': 'Belirtilmemiş' };
        const genderText = genderMap[patient.gender] || 'Belirtilmemiş';
        const genderBadge = patient.gender === 'M' ? 'bg-info' : (patient.gender === 'F' ? 'bg-danger' : 'bg-secondary');

        row.innerHTML = `
            <td><code>${escapeHtml(patient.tc_no)}</code></td>
            <td><div class="fw-bold text-dark">${escapeHtml(patient.name)}</div></td>
            <td>${escapeHtml(patient.phone)}</td>
            <td><span class="badge ${genderBadge}-subtle text-${genderBadge.split('-')[1]} rounded-pill">${genderText}</span></td>
            <td><small class="text-muted">${Utils.formatDate(patient.updated_at || patient.created_at)}</small></td>
            <td class="text-end">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="showPatientDetails(${patient.id})" title="Detay / Vitals">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-warning" onclick="editPatient(${patient.id})" title="Düzenle">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="handleArchivePatient(${patient.id})" title="Arşivle">
                        <i class="bi bi-archive"></i>
                    </button>
                </div>
            </td>
        `;
        patientsTableBody.appendChild(row);
    });
}

// Stats Güncelle
function updateStats() {
    totalPatientsCountEl.textContent = allPatients.length;
    malePatientsCountEl.textContent = allPatients.filter(p => p.gender === 'M').length;
    femalePatientsCountEl.textContent = allPatients.filter(p => p.gender === 'F').length;
}

// Hasta Kaydet/Güncelle
async function handleSavePatient() {
    const formData = new FormData(patientForm);
    const data = Object.fromEntries(formData.entries());
    const id = data.id;

    // Temel Validasyon
    if (!data.tc_no || !data.name || !data.phone) {
        Utils.showError('TC No, Ad Soyad ve Telefon alanları zorunludur.');
        return;
    }

    if (data.tc_no.length !== 11) {
        Utils.showError('TC Kimlik No 11 haneli olmalıdır.');
        return;
    }

    if (!validateTCKN(data.tc_no)) {
        Utils.showError('Geçersiz TC Kimlik No! Lütfen kontrol ediniz.');
        return;
    }

    btnSavePatient.disabled = true;
    btnSavePatient.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>İşleniyor...';

    try {
        if (id) {
            await api.put(`/api/patients/${id}`, data);
            Utils.showSuccess('Hasta bilgileri güncellendi.');
        } else {
            await api.post('/api/patients', data);
            Utils.showSuccess('Yeni hasta başarıyla oluşturuldu.');
        }

        patientModal.hide();
        loadPatients();
    } catch (error) {
        console.error('Hasta kaydedilirken hata:', error);
        Utils.showError(typeof error === 'string' ? error : 'İşlem başarısız.');
    } finally {
        btnSavePatient.disabled = false;
        btnSavePatient.innerHTML = '<i class="bi bi-check2-circle me-1"></i>Kaydet';
    }
}

// Hasta Düzenleme Modu
window.editPatient = function (id) {
    const patient = allPatients.find(p => p.id == id);
    if (!patient) return;

    resetPatientForm();
    document.getElementById('patientId').value = patient.id;
    document.getElementById('tc_no').value = patient.tc_no;
    document.getElementById('name').value = patient.name;
    document.getElementById('phone').value = patient.phone;
    document.getElementById('email').value = patient.email || '';
    document.getElementById('birth_date').value = patient.birth_date || '';
    document.getElementById('gender').value = patient.gender || 'U';
    document.getElementById('blood_type').value = patient.blood_type || '';
    document.getElementById('address').value = patient.address || '';
    document.getElementById('notes').value = patient.notes || '';

    document.getElementById('patientModalLabel').innerHTML = '<i class="bi bi-pencil me-2"></i>Hasta Düzenle';
    patientModal.show();
};

// Hasta Detay & Vitals Göster
window.showPatientDetails = async function (id) {
    Utils.showLoading('Hasta detayları getiriliyor...');
    try {
        const response = await api.get(`/api/patients/${id}`);
        const patient = response.data;

        // Sol Panel (Bio)
        document.getElementById('detailName').textContent = patient.name;
        document.getElementById('detailTc').textContent = patient.tc_no;
        document.getElementById('detailPhone').textContent = patient.phone;
        document.getElementById('detailBirth').textContent = patient.birth_date || '-';
        document.getElementById('detailBlood').textContent = patient.blood_type || '-';
        document.getElementById('detailAddress').textContent = patient.address || 'Adres bilgisi yok.';
        document.getElementById('detailNotes').textContent = patient.notes || 'Not bulunmuyor.';

        const genderMap = { 'M': 'Erkek', 'F': 'Kadın', 'U': 'Bilinmiyor' };
        document.getElementById('detailGender').textContent = genderMap[patient.gender] || 'Bilinmiyor';

        // Sağ Panel (Vitals)
        renderVitalsTable(patient.vitals_history || []);

        // Add Vital Button'ı ID ile bağla
        btnAddVital.onclick = () => handleAddVital(patient.id);

        Utils.closeLoading();
        detailModal.show();
    } catch (error) {
        Utils.closeLoading();
        Utils.showError('Hasta detayı yüklenemedi.');
    }
};

// Vitals Tablosunu Render Et
function renderVitalsTable(history) {
    vitalsTableBody.innerHTML = '';

    if (history.length === 0) {
        vitalsTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Ölçüm kaydı bulunamadı.</td></tr>';
        return;
    }

    history.forEach(v => {
        const bmi = (v.weight && v.height) ? (v.weight / ((v.height / 100) * (v.height / 100))).toFixed(1) : '-';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${Utils.formatDate(v.created_at)}</td>
            <td>${v.height || '-'}</td>
            <td>${v.weight || '-'}</td>
            <td>${v.systolic_bp || '-'}/${v.diastolic_bp || '-'}</td>
            <td>${v.heart_rate || '-'}</td>
            <td><span class="badge bg-secondary">${bmi}</span></td>
        `;
        vitalsTableBody.appendChild(row);
    });
}

// Yaşam Bulgusu Ekle (SweetAlert2 ile)
async function handleAddVital(patientId) {
    const { value: formValues } = await Swal.fire({
        target: document.getElementById('detailModal'),
        title: 'Yaşam Bulgusu Ekle',
        html:
            '<div class="row g-3 text-start">' +
            '  <div class="col-6"><label class="small fw-bold">Boy (cm)</label><input id="swal-height" type="number" class="form-control" placeholder="175"></div>' +
            '  <div class="col-6"><label class="small fw-bold">Kilo (kg)</label><input id="swal-weight" type="number" step="0.1" class="form-control" placeholder="70.5"></div>' +
            '  <div class="col-6"><label class="small fw-bold">Tansiyon (Büyük)</label><input id="swal-sys" type="number" class="form-control" placeholder="120"></div>' +
            '  <div class="col-6"><label class="small fw-bold">Tansiyon (Küçük)</label><input id="swal-dia" type="number" class="form-control" placeholder="80"></div>' +
            '  <div class="col-12"><label class="small fw-bold">Nabız (bpm)</label><input id="swal-hr" type="number" class="form-control" placeholder="72"></div>' +
            '</div>',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Kaydet',
        cancelButtonText: 'İptal',
        didOpen: () => {
            const firstInput = document.getElementById('swal-height');
            if (firstInput) firstInput.focus();
        },
        preConfirm: () => {
            return {
                height: document.getElementById('swal-height').value,
                weight: document.getElementById('swal-weight').value,
                systolic_bp: document.getElementById('swal-sys').value,
                diastolic_bp: document.getElementById('swal-dia').value,
                heart_rate: document.getElementById('swal-hr').value
            }
        }
    });

    if (formValues) {
        try {
            Utils.showLoading('Kaydediliyor...');
            const response = await api.post(`/api/patients/${patientId}/vitals`, formValues);

            // Başarılıysa tabloyu güncelle
            // backend tüm listeyi dönmüyor, sadece ID dönüyor. 
            // Bu yüzden güncel listeyi çekmek için detay fonksiyonunu tekrar çağırıyoruz.
            const detailRes = await api.get(`/api/patients/${patientId}`);
            renderVitalsTable(detailRes.data.vitals_history || []);

            Utils.closeLoading();
            Utils.showSuccess('Ölçüm başarıyla kaydedildi.');
        } catch (error) {
            Utils.closeLoading();
            Utils.showError(typeof error === 'string' ? error : 'Ölçüm kaydedilemedi.');
        }
    }
}

// Hastayı Arşivle
window.handleArchivePatient = async function (id) {
    const result = await Swal.fire({
        title: 'Emin misiniz?',
        text: "Hata kaydı arşive taşınacak.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Evet, Arşivle',
        cancelButtonText: 'Vazgeç'
    });

    if (result.isConfirmed) {
        try {
            await api.patch(`/api/patients/${id}/archive`);
            Utils.showSuccess('Hasta arşivlendi.');
            loadPatients();
        } catch (error) {
            Utils.showError('Arşivleme işlemi başarısız.');
        }
    }
};

// Çıkış Yap
async function handleLogout() {
    const result = await Swal.fire({
        title: 'Çıkış Yapılıyor',
        text: "Oturumunuzu kapatmak istediğinize emin misiniz?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Evet, Çıkış Yap',
        cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
        localStorage.removeItem('platform_token');
        localStorage.removeItem('user_type');
        window.location.href = 'index.html';
    }
}

// Form Sıfırlama
function resetPatientForm() {
    patientForm.reset();
    document.getElementById('patientId').value = '';
}

// Boş Durum Render
function renderEmptyState(message) {
    patientsTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-5">
                <i class="bi bi-person-exclamation fs-1 text-muted"></i>
                <p class="mt-3 text-secondary">${message}</p>
            </td>
        </tr>
    `;
}

// Hata Durumu Render
function renderErrorState() {
    patientsTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-5 text-danger">
                <i class="bi bi-exclamation-triangle fs-1"></i>
                <p class="mt-3">Hastalar yüklenirken bir sorun oluştu. Lütfen sayfayı yenileyiniz.</p>
            </td>
        </tr>
    `;
}

// HTML Escape
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * TC Kimlik Numarası Doğrulayıcı
 * Algoritma: 
 * 1. 11 haneli olmalı
 * 2. İlk hane 0 olamaz
 * 3. 1,3,5,7,9. haneler toplamı * 7 - 2,4,6,8. haneler toplamı % 10 = 10. haneyi vermeli
 * 4. 1..10 haneler toplamı % 10 = 11. haneyi vermeli
 * Özel: "11111111111" yabancı hastalar için kabul edilir.
 */
function validateTCKN(tckn) {
    if (!tckn || tckn.length !== 11 || isNaN(tckn)) return false;

    // Yabancı hasta istisnası
    if (tckn === "11111111111") return true;

    // String -> Array
    const digits = tckn.split('').map(Number);

    // İlk hane 0 olamaz
    if (digits[0] === 0) return false;

    // 10. Hane Kontrolü
    const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
    const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
    let tenthDigit = ((oddSum * 7) - evenSum) % 10;
    if (tenthDigit < 0) tenthDigit += 10;

    if (tenthDigit !== digits[9]) return false;

    // 11. Hane Kontrolü
    const totalSum = digits.slice(0, 10).reduce((acc, curr) => acc + curr, 0);
    const eleventhDigit = totalSum % 10;

    if (eleventhDigit !== digits[10]) return false;

    return true;
}
