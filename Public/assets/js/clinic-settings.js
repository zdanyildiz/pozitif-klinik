/**
 * Pozitif Klinik - Clinic Settings Scripts
 */

// Token Kontrolü
const token = localStorage.getItem('platform_token');
const userType = localStorage.getItem('user_type');

if (!token || userType !== 'platform_admin') {
    window.location.href = API_URL + '/platform/login';
}

// URL'den clinic_id parametresini al
const urlParams = new URLSearchParams(window.location.search);
const clinicId = urlParams.get('id');

if (!clinicId) {
    window.location.href = API_URL + '/platform/dashboard';
}

// DOM Elements
const clinicTitle = document.getElementById('clinicTitle');
const clinicDomain = document.getElementById('clinicDomain');
const clinicNameBreadcrumb = document.getElementById('clinicNameBreadcrumb');
const clinicStatusBadge = document.getElementById('clinicStatusBadge');
const emailConfigBadge = document.getElementById('emailConfigBadge');
const personnelTableBody = document.getElementById('personnelTableBody');

// Form Elements
const emailSettingsForm = document.getElementById('emailSettingsForm');
const smtpHost = document.getElementById('smtpHost');
const smtpPort = document.getElementById('smtpPort');
const smtpUsername = document.getElementById('smtpUsername');
const smtpPassword = document.getElementById('smtpPassword');
const smtpEncryption = document.getElementById('smtpEncryption');
const smtpActive = document.getElementById('smtpActive');
const fromEmail = document.getElementById('fromEmail');
const fromName = document.getElementById('fromName');
const passwordHint = document.getElementById('passwordHint');

// Buttons
const saveEmailSettingsBtn = document.getElementById('saveEmailSettingsBtn');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const sendTestEmailBtn = document.getElementById('sendTestEmailBtn');
const resetToFallbackBtn = document.getElementById('resetToFallbackBtn');
const togglePassword = document.getElementById('togglePassword');
const logoutBtn = document.getElementById('logoutBtn');

// Modal
let testEmailModal;
let personnelModal;

// State
let currentEmailConfig = null;
let hasExistingPassword = false;
let currentPersonnelEditId = null;

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    testEmailModal = new bootstrap.Modal(document.getElementById('testEmailModal'));
    personnelModal = new bootstrap.Modal(document.getElementById('personnelModal'));
    loadClinicData();
    loadPlatformMedicalSpecialties();
    setupEventListeners();
    setupTabs();
});

let medicalSpecialties = [];
async function loadPlatformMedicalSpecialties() {
    try {
        const result = await api.get('/platform-api/specialties');
        medicalSpecialties = result.data || [];
        const select = document.getElementById('personnelSpecialty');
        if (select) {
            select.innerHTML = '<option value="">Seçiniz</option>';
            medicalSpecialties.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.code;
                opt.textContent = s.name;
                select.appendChild(opt);
            });
        }
    } catch (error) {
        console.error('Branşlar yüklenirken hata:', error);
    }
}

// Event Listeners
function setupEventListeners() {
    // Form Submit
    emailSettingsForm.addEventListener('submit', handleSaveEmailSettings);
    const smsForm = document.getElementById('smsSettingsForm');
    if (smsForm) smsForm.addEventListener('submit', handleSaveSmsSettings);

    // Buttons
    testConnectionBtn.addEventListener('click', handleTestConnection);
    const testSmsBtn = document.getElementById('testSmsBtn');
    if (testSmsBtn) testSmsBtn.addEventListener('click', handleTestSms);
    sendTestEmailBtn.addEventListener('click', () => testEmailModal.show());
    resetToFallbackBtn.addEventListener('click', handleResetToFallback);

    // Test email modal confirm
    document.getElementById('confirmSendTestBtn').addEventListener('click', handleSendTestEmail);

    // Toggle password visibility
    togglePassword.addEventListener('click', () => {
        const type = smtpPassword.type === 'password' ? 'text' : 'password';
        smtpPassword.type = type;
        togglePassword.innerHTML = type === 'password'
            ? '<i class="bi bi-eye"></i>'
            : '<i class="bi bi-eye-slash"></i>';
    });


    // Personnel Events
    document.getElementById('btnAddNewPersonnel').addEventListener('click', () => openPersonnelModal());
    document.getElementById('savePersonnelBtn').addEventListener('click', handleSavePersonnel);

    // Role change listener for specialty visibility
    const roleSelect = document.getElementById('personnelRole');
    if (roleSelect) {
        roleSelect.addEventListener('change', () => {
            const specialtyContainer = document.getElementById('specialtyContainer');
            if (specialtyContainer) {
                specialtyContainer.style.display = roleSelect.value === 'doctor' ? 'block' : 'none';
            }
        });
    }
}

// Tab Navigasyonu
function setupTabs() {
    const tabs = document.querySelectorAll('.settings-tab');
    const panels = document.querySelectorAll('.settings-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            const targetId = targetTab + 'Panel';

            // Tüm tab ve panel'leri deaktif et
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            // Seçili tab ve panel'i aktif et
            tab.classList.add('active');
            document.getElementById(targetId).classList.add('active');

            // Eğer kullanıcılar sekmesi ise veriyi yükle
            if (targetTab === 'users') {
                loadPersonnel();
            }
            // Genel Ayarlar sekmesi
            if (targetTab === 'general') {
                loadBasicInfo();
            }
            // SMS Ayarları sekmesi
            if (targetTab === 'sms') {
                loadSmsSettings();
            }
        });
    });
}

// Klinik Verilerini Yükle
async function loadClinicData() {
    try {
        // Klinik detayları
        const clinicResult = await api.get(`/platform-admin/tenants/${clinicId}`);
        const clinic = clinicResult.data;

        // Header'ı güncelle
        clinicTitle.textContent = clinic.name;
        clinicDomain.textContent = clinic.domain_prefix;
        clinicNameBreadcrumb.textContent = clinic.name;

        const isActive = clinic.is_active === 1 || clinic.is_active === '1';
        clinicStatusBadge.className = `clinic-meta-item ${isActive ? 'active' : 'inactive'}`;
        clinicStatusBadge.innerHTML = `
            <i class="bi bi-circle-fill"></i>
            <span>${isActive ? 'Aktif' : 'Pasif'}</span>
        `;

        // E-posta ayarlarını yükle
        await loadEmailSettings();

    } catch (error) {
        console.error('Klinik verileri yüklenirken hata:', error);
        Utils.showError('Klinik bilgileri yüklenemedi');
    }
}

// E-posta Ayarlarını Yükle
async function loadEmailSettings() {
    try {
        const result = await api.get(`/platform-admin/tenants/${clinicId}/settings/email`);
        currentEmailConfig = result.data;

        // Form'u doldur
        smtpHost.value = currentEmailConfig.smtp_host || '';
        smtpPort.value = currentEmailConfig.smtp_port || 587;
        smtpUsername.value = currentEmailConfig.smtp_username || '';
        smtpEncryption.value = currentEmailConfig.smtp_encryption || 'tls';
        smtpActive.value = currentEmailConfig.is_active ? '1' : '0';
        fromEmail.value = currentEmailConfig.from_email || '';
        fromName.value = currentEmailConfig.from_name || '';

        // Şifre durumu
        hasExistingPassword = currentEmailConfig.has_password;
        if (hasExistingPassword && !currentEmailConfig.is_fallback) {
            passwordHint.textContent = 'Mevcut şifreyi korumak için boş bırakın';
            passwordHint.style.display = 'block';
        } else {
            passwordHint.style.display = 'none';
        }

        // Badge güncelle
        updateConfigBadge(currentEmailConfig.is_fallback);

    } catch (error) {
        console.error('E-posta ayarları yüklenirken hata:', error);
    }
}

// Config Badge Güncelle
function updateConfigBadge(isFallback) {
    if (isFallback) {
        emailConfigBadge.innerHTML = `
            <span class="badge-fallback">
                <i class="bi bi-info-circle"></i>
                Sistem Varsayılanı
            </span>
        `;
        resetToFallbackBtn.style.display = 'none';
    } else {
        emailConfigBadge.innerHTML = `
            <span class="badge-custom">
                <i class="bi bi-check-circle"></i>
                Özel Yapılandırma
            </span>
        `;
        resetToFallbackBtn.style.display = 'inline-flex';
    }
}

// E-posta Ayarlarını Kaydet
async function handleSaveEmailSettings(e) {
    e.preventDefault();

    // Validasyon
    if (!smtpHost.value.trim()) {
        Utils.showError('SMTP sunucu adresi zorunludur');
        smtpHost.focus();
        return;
    }

    if (!smtpUsername.value.trim()) {
        Utils.showError('SMTP kullanıcı adı zorunludur');
        smtpUsername.focus();
        return;
    }

    // Yeni kayıt için şifre zorunlu
    if (currentEmailConfig?.is_fallback && !smtpPassword.value) {
        Utils.showError('SMTP şifresi zorunludur');
        smtpPassword.focus();
        return;
    }

    if (!fromEmail.value.trim()) {
        Utils.showError('Gönderen e-posta adresi zorunludur');
        fromEmail.focus();
        return;
    }

    // Butonu devre dışı bırak
    saveEmailSettingsBtn.disabled = true;
    saveEmailSettingsBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Kaydediliyor...';

    const payload = {
        smtp_host: smtpHost.value.trim(),
        smtp_port: parseInt(smtpPort.value),
        smtp_username: smtpUsername.value.trim(),
        smtp_password: smtpPassword.value,
        smtp_encryption: smtpEncryption.value,
        from_email: fromEmail.value.trim(),
        from_name: fromName.value.trim(),
        is_active: smtpActive.value === '1'
    };

    try {
        await api.post(`/platform-admin/tenants/${clinicId}/settings/email`, payload);

        await Swal.fire({
            icon: 'success',
            title: 'Başarılı!',
            text: 'E-posta ayarları kaydedildi.',
            timer: 2000,
            showConfirmButton: false,
            timerProgressBar: true
        });

        // Şifre alanını temizle ve ayarları yeniden yükle
        smtpPassword.value = '';
        await loadEmailSettings();

    } catch (error) {
        console.error('Kaydetme hatası:', error);
        Utils.showError(typeof error === 'string' ? error : 'Ayarlar kaydedilemedi');
    } finally {
        saveEmailSettingsBtn.disabled = false;
        saveEmailSettingsBtn.innerHTML = '<i class="bi bi-check-lg"></i> Kaydet';
    }
}

// Bağlantı Testi
async function handleTestConnection() {
    testConnectionBtn.disabled = true;
    testConnectionBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Test Ediliyor...';

    try {
        await api.post(`/platform-admin/tenants/${clinicId}/settings/email/test`);

        await Swal.fire({
            icon: 'success',
            title: 'Bağlantı Başarılı!',
            text: 'SMTP sunucusuna bağlantı kuruldu.',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error('Bağlantı testi hatası:', error);
        Utils.showError(typeof error === 'string' ? error : 'SMTP bağlantısı kurulamadı');
    } finally {
        testConnectionBtn.disabled = false;
        testConnectionBtn.innerHTML = '<i class="bi bi-plug"></i> Bağlantı Testi';
    }
}

// Test E-postası Gönder
async function handleSendTestEmail() {
    const testEmail = document.getElementById('testEmailAddress').value.trim();

    if (!testEmail) {
        Utils.showError('E-posta adresi giriniz');
        return;
    }

    const confirmBtn = document.getElementById('confirmSendTestBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Gönderiliyor...';

    try {
        await api.post(`/platform-admin/tenants/${clinicId}/settings/email/send-test`, {
            to_email: testEmail
        });

        testEmailModal.hide();
        document.getElementById('testEmailAddress').value = '';

        await Swal.fire({
            icon: 'success',
            title: 'E-posta Gönderildi!',
            text: `Test e-postası ${testEmail} adresine gönderildi.`,
            timer: 3000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error('Test e-postası hatası:', error);
        Utils.showError(typeof error === 'string' ? error : 'Test e-postası gönderilemedi');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="bi bi-send me-1"></i> Gönder';
    }
}

// Varsayılana Dön
async function handleResetToFallback() {
    const result = await Swal.fire({
        icon: 'warning',
        title: 'Varsayılana Dön',
        text: 'Bu klinik için özel e-posta ayarları silinecek ve sistem varsayılan ayarları kullanılacak. Devam etmek istiyor musunuz?',
        showCancelButton: true,
        confirmButtonText: 'Evet, Sıfırla',
        cancelButtonText: 'İptal',
        confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) return;

    try {
        await api.delete(`/platform-admin/tenants/${clinicId}/settings/email`);

        await Swal.fire({
            icon: 'success',
            title: 'Sıfırlandı!',
            text: 'E-posta ayarları varsayılana döndürüldü.',
            timer: 2000,
            showConfirmButton: false
        });

        await loadEmailSettings();

    } catch (error) {
        console.error('Sıfırlama hatası:', error);
        Utils.showError('Ayarlar sıfırlanamadı');
    }
}

// Çıkış Yap
async function handleLogout() {
    const result = await Swal.fire({
        icon: 'question',
        title: 'Çıkış Yap',
        text: 'Oturumunuzu kapatmak istediğinize emin misiniz?',
        showCancelButton: true,
        confirmButtonText: 'Evet, Çıkış Yap',
        cancelButtonText: 'İptal',
        confirmButtonColor: '#dc2626'
    });

    if (result.isConfirmed) {
        localStorage.removeItem('platform_token');
        localStorage.removeItem('user_type');
        window.location.href = API_URL + '/platform/login';
    }
}

// --- Personel Yönetimi Fonksiyonları ---

async function loadPersonnel() {
    try {
        const result = await api.get(`/platform-admin/tenants/${clinicId}/users`);
        const users = result.data || [];

        personnelTableBody.innerHTML = '';

        if (users.length === 0) {
            personnelTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Kayıtlı personel bulunamadı.</td></tr>';
            return;
        }

        users.forEach(user => {
            const row = document.createElement('tr');
            const isActive = user.is_active == 1;
            row.innerHTML = `
                <td>#${user.id}</td>
                <td><span class="fw-medium">${escapeHtml(user.name || '-')}</span></td>
                <td><code>${escapeHtml(user.username)}</code></td>
                <td><span class="badge bg-light text-dark border">${translateRole(user.role)}</span></td>
                <td>
                    <span class="status-indicator ${isActive ? 'bg-success' : 'bg-danger'}"></span>
                    ${isActive ? 'Aktif' : 'Pasif'}
                </td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" onclick="openPersonnelModal(${user.id}, '${escapeHtml(user.username)}', '${escapeHtml(user.name || '')}', '${user.role}', ${user.is_active}, '${escapeHtml(user.specialty || '')}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deletePersonnel(${user.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            personnelTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Personel yükleme hatası:', error);
        personnelTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Veriler yüklenemedi.</td></tr>';
    }
}

window.openPersonnelModal = function (id = null, username = '', name = '', role = 'secretary', isActive = 1, specialty = '') {
    currentPersonnelEditId = id;
    document.getElementById('personnelModalTitle').textContent = id ? 'Personel Düzenle' : 'Yeni Personel Ekle';
    document.getElementById('personnelId').value = id || '';
    document.getElementById('personnelUsername').value = username;
    document.getElementById('personnelName').value = name;
    document.getElementById('personnelRole').value = role;
    document.getElementById('personnelStatus').value = isActive ? "1" : "0";
    document.getElementById('personnelPassword').value = '';

    const specialtySelect = document.getElementById('personnelSpecialty');
    const specialtyContainer = document.getElementById('specialtyContainer');

    if (specialtySelect) {
        specialtySelect.value = specialty;
    }

    if (specialtyContainer) {
        specialtyContainer.style.display = role === 'doctor' ? 'block' : 'none';
    }

    // Şifre ipucu
    const hint = document.getElementById('personnelPasswordHint');
    if (id) {
        hint.textContent = 'Değiştirmek istemiyorsanız boş bırakın.';
    } else {
        hint.textContent = 'Yeni kullanıcı için şifre zorunludur.';
    }

    personnelModal.show();
}

async function handleSavePersonnel() {
    const id = document.getElementById('personnelId').value;
    const username = document.getElementById('personnelUsername').value.trim();
    const name = document.getElementById('personnelName').value.trim();
    const role = document.getElementById('personnelRole').value;
    const specialty = document.getElementById('personnelSpecialty').value;
    const password = document.getElementById('personnelPassword').value;
    const isActive = document.getElementById('personnelStatus').value;

    if (!username || (!id && !password)) {
        Utils.showError('Lütfen gerekli alanları doldurun.');
        return;
    }

    if (role === 'doctor' && !specialty) {
        Utils.showError('Doktor için branş seçimi zorunludur.');
        return;
    }

    const saveBtn = document.getElementById('savePersonnelBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Kaydediliyor...';

    const payload = { username, name, role, is_active: isActive, specialty: role === 'doctor' ? specialty : null };
    if (password) payload.password = password;

    try {
        if (id) {
            await api.put(`/platform-admin/tenants/${clinicId}/users/${id}`, payload);
        } else {
            await api.post(`/platform-admin/tenants/${clinicId}/users`, payload);
        }

        personnelModal.hide();
        await Swal.fire({
            icon: 'success',
            title: 'Başarılı',
            text: 'Personel bilgileri kaydedildi.',
            timer: 1500,
            showConfirmButton: false
        });
        loadPersonnel();
    } catch (error) {
        Utils.showError(typeof error === 'string' ? error : 'Kaydedilemedi.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Kaydet';
    }
}

window.deletePersonnel = async function (id) {
    const result = await Swal.fire({
        title: 'Emin misiniz?',
        text: "Bu personeli silmek istediğinize emin misiniz?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Evet, Sil',
        cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
        try {
            await api.delete(`/platform-admin/tenants/${clinicId}/users/${id}`);
            Swal.fire('Silindi!', 'Kullanıcı silindi.', 'success');
            loadPersonnel();
        } catch (error) {
            Utils.showError('Silme işlemi başarısız.');
        }
    }
}

function translateRole(role) {
    const roles = {
        'admin': 'Yönetici',
        'doctor': 'Doktor',
        'secretary': 'Sekreter'
    };
    return roles[role] || role;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- Genel Ayarlar (Basic Info) Fonksiyonları ---

const DAYS_OF_WEEK = [
    { key: 'pazartesi', label: 'Pazartesi' },
    { key: 'sali', label: 'Salı' },
    { key: 'carsamba', label: 'Çarşamba' },
    { key: 'persembe', label: 'Perşembe' },
    { key: 'cuma', label: 'Cuma' },
    { key: 'cumartesi', label: 'Cumartesi' },
    { key: 'pazar', label: 'Pazar' }
];

let provincesLoaded = false;
let currentBasicInfo = null;

// Çalışma Saatleri Grid'ini Oluştur
function renderWorkingHoursGrid(workingHours = null) {
    const grid = document.getElementById('workingHoursGrid');
    if (!grid) return;

    grid.innerHTML = '';

    DAYS_OF_WEEK.forEach(day => {
        const dayData = workingHours?.[day.key] || { open: true, start: '09:00', end: '18:00' };
        const isOpen = dayData.open !== false;

        const row = document.createElement('div');
        row.className = `working-hours-row ${isOpen ? '' : 'closed'}`;
        row.id = `day-${day.key}`;

        row.innerHTML = `
            <div class="day-label">
                <input class="form-check-input" type="checkbox" id="check-${day.key}" ${isOpen ? 'checked' : ''}>
                <label for="check-${day.key}">${day.label}</label>
            </div>
            <div class="hours-inputs">
                ${isOpen ? `
                    <input type="time" id="start-${day.key}" value="${dayData.start || '09:00'}">
                    <span class="hours-separator">-</span>
                    <input type="time" id="end-${day.key}" value="${dayData.end || '18:00'}">
                ` : `
                    <span class="closed-text"><i class="bi bi-x-circle me-1"></i>Kapalı</span>
                `}
            </div>
        `;

        grid.appendChild(row);

        // Checkbox event listener
        const checkbox = row.querySelector(`#check-${day.key}`);
        checkbox.addEventListener('change', () => {
            const currentData = getWorkingHoursData();
            currentData[day.key].open = checkbox.checked;
            renderWorkingHoursGrid(currentData);
        });
    });
}

// Çalışma Saatlerini Form'dan Al
function getWorkingHoursData() {
    const data = {};

    DAYS_OF_WEEK.forEach(day => {
        const checkbox = document.getElementById(`check-${day.key}`);
        const startInput = document.getElementById(`start-${day.key}`);
        const endInput = document.getElementById(`end-${day.key}`);

        data[day.key] = {
            open: checkbox?.checked ?? true,
            start: startInput?.value || '09:00',
            end: endInput?.value || '18:00'
        };
    });

    return data;
}

// İlleri Yükle
async function loadProvinces() {
    if (provincesLoaded) return;

    try {
        const result = await api.get('/api/general/provinces');
        const provinces = result.data || [];
        const select = document.getElementById('clinicProvince');

        if (!select) return;

        select.innerHTML = '<option value="">Seçiniz</option>';
        provinces.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            select.appendChild(option);
        });

        provincesLoaded = true;

        // Province change event
        select.addEventListener('change', () => {
            loadDistricts(select.value);
        });

    } catch (error) {
        console.error('İller yüklenirken hata:', error);
    }
}

// İlçeleri Yükle
async function loadDistricts(provinceId, selectedDistrictId = null) {
    const districtSelect = document.getElementById('clinicDistrict');
    if (!districtSelect) return;

    if (!provinceId) {
        districtSelect.innerHTML = '<option value="">Önce il seçiniz</option>';
        districtSelect.disabled = true;
        return;
    }

    districtSelect.innerHTML = '<option value="">Yükleniyor...</option>';
    districtSelect.disabled = true;

    try {
        const result = await api.get(`/api/general/districts?province_id=${provinceId}`);
        const districts = result.data || [];

        districtSelect.innerHTML = '<option value="">Seçiniz</option>';
        districts.forEach(d => {
            const option = document.createElement('option');
            option.value = d.id;
            option.textContent = d.name;
            if (selectedDistrictId && d.id == selectedDistrictId) {
                option.selected = true;
            }
            districtSelect.appendChild(option);
        });

        districtSelect.disabled = false;

    } catch (error) {
        console.error('İlçeler yüklenirken hata:', error);
        districtSelect.innerHTML = '<option value="">Hata oluştu</option>';
    }
}

// Temel Bilgileri Yükle
async function loadBasicInfo() {
    try {
        // İlleri yükle
        await loadProvinces();

        // Klinik bilgilerini yükle
        const result = await api.get(`/platform-admin/tenants/${clinicId}/basic-info`);
        currentBasicInfo = result.data;

        // Form alanlarını doldur
        document.getElementById('clinicName').value = currentBasicInfo.name || '';
        document.getElementById('clinicWebsite').value = currentBasicInfo.website || '';
        document.getElementById('clinicDescription').value = currentBasicInfo.description || '';
        document.getElementById('clinicPhone').value = currentBasicInfo.phone || '';
        document.getElementById('clinicEmail').value = currentBasicInfo.email || '';
        document.getElementById('clinicAddress').value = currentBasicInfo.address || '';
        document.getElementById('clinicTaxOffice').value = currentBasicInfo.tax_office || '';
        document.getElementById('clinicTaxNumber').value = currentBasicInfo.tax_number || '';

        // İl/İlçe seçimi
        if (currentBasicInfo.province_id) {
            document.getElementById('clinicProvince').value = currentBasicInfo.province_id;
            await loadDistricts(currentBasicInfo.province_id, currentBasicInfo.district_id);
        }

        // Çalışma saatleri
        renderWorkingHoursGrid(currentBasicInfo.working_hours);

    } catch (error) {
        console.error('Temel bilgiler yüklenirken hata:', error);
        Utils.showError('Klinik bilgileri yüklenemedi');
    }
}

// Temel Bilgileri Kaydet
async function handleSaveBasicInfo(e) {
    e.preventDefault();

    const name = document.getElementById('clinicName').value.trim();
    if (!name) {
        Utils.showError('Klinik adı zorunludur');
        document.getElementById('clinicName').focus();
        return;
    }

    const saveBtn = document.getElementById('saveBasicInfoBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Kaydediliyor...';

    const payload = {
        name: name,
        website: document.getElementById('clinicWebsite').value.trim() || null,
        description: document.getElementById('clinicDescription').value.trim() || null,
        phone: document.getElementById('clinicPhone').value.trim() || null,
        email: document.getElementById('clinicEmail').value.trim() || null,
        address: document.getElementById('clinicAddress').value.trim() || null,
        province_id: document.getElementById('clinicProvince').value || null,
        district_id: document.getElementById('clinicDistrict').value || null,
        tax_office: document.getElementById('clinicTaxOffice').value.trim() || null,
        tax_number: document.getElementById('clinicTaxNumber').value.trim() || null,
        working_hours: getWorkingHoursData()
    };

    try {
        await api.put(`/platform-admin/tenants/${clinicId}/basic-info`, payload);

        // Header'ı güncelle
        document.getElementById('clinicTitle').textContent = name;
        document.getElementById('clinicNameBreadcrumb').textContent = name;

        await Swal.fire({
            icon: 'success',
            title: 'Başarılı!',
            text: 'Klinik bilgileri kaydedildi.',
            timer: 2000,
            showConfirmButton: false,
            timerProgressBar: true
        });

    } catch (error) {
        console.error('Kaydetme hatası:', error);
        Utils.showError(typeof error === 'string' ? error : 'Bilgiler kaydedilemedi');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-check-lg"></i> Kaydet';
    }
}

// Genel Ayarlar Form Event Listener
document.addEventListener('DOMContentLoaded', () => {
    const basicInfoForm = document.getElementById('basicInfoForm');
    if (basicInfoForm) {
        basicInfoForm.addEventListener('submit', handleSaveBasicInfo);
    }
});

// --- SMS Ayarları Fonksiyonları ---

let smsProviders = [];
let currentSmsConfig = {};

async function loadSmsSettings() {
    try {
        const result = await api.get(`/platform-admin/sms/settings/${clinicId}`);
        const { providers, active_settings } = result.data;
        smsProviders = providers;

        const select = document.getElementById('smsProviderSelect');
        select.innerHTML = '<option value="">Lütfen Seçiniz</option>';

        providers.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            select.appendChild(option);
        });

        // Event Listener: Provider değişince formu yeniden çiz
        select.onchange = () => {
            const selectedId = parseInt(select.value);
            const provider = smsProviders.find(p => p.id === selectedId);
            renderSmsConfigForm(provider ? provider.config_schema : null);
            document.getElementById('saveSmsSettingsBtn').disabled = !provider;
            document.getElementById('testSmsBtn').disabled = !provider;
        };

        // Eğer mevcut ayar varsa seç ve doldur
        if (active_settings) {
            select.value = active_settings.provider_id;
            // Config data encrypted olduğu için sunucudan gelmiyor.
            // UX için: Formun üzerine "Mevcut ayarlar kayıtlı. Değiştirmek için formu doldurun." notu düşülebilir.
            const provider = smsProviders.find(p => p.id == active_settings.provider_id);
            if (provider) {
                renderSmsConfigForm(provider.config_schema, true); // true: isUpdateMode
                document.getElementById('saveSmsSettingsBtn').disabled = false;
                document.getElementById('testSmsBtn').disabled = false;
            }
        }

    } catch (error) {
        console.error('SMS ayarları yüklenirken hata:', error);
        Utils.showError('SMS ayarları yüklenemedi');
    }
}

function renderSmsConfigForm(schema, isUpdateMode = false) {
    const container = document.getElementById('smsConfigContainer');
    container.innerHTML = '';

    if (!schema) {
        container.innerHTML = '<div class="text-center py-4 text-muted"><p>Lütfen bir sağlayıcı seçin.</p></div>';
        return;
    }

    if (isUpdateMode) {
        const infoAlert = document.createElement('div');
        infoAlert.className = 'alert alert-info';
        infoAlert.innerHTML = '<i class="bi bi-info-circle me-2"></i>Mevcut ayarlarınız kayıtlıdır ve GÜVENLİDİR. Değişiklik yapmak isterseniz formu doldurun, aksi takdirde dokunmanıza gerek yoktur.';
        container.appendChild(infoAlert);
    }

    const row = document.createElement('div');
    row.className = 'row g-3';

    // Global KV listesi için bir sayaç
    window.kvCount = window.kvCount || 0;

    schema.forEach(field => {
        const col = document.createElement('div');
        col.className = 'col-md-12'; // Varsayılan tam genişlik

        if (field.type === 'keyvalue') {
            col.innerHTML = `
                <label class="form-label d-flex justify-content-between">
                    <span>${field.label} ${field.required ? '<span class="text-danger">*</span>' : ''}</span>
                    <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2" onclick="addKvPair('${field.key}')">
                        <i class="bi bi-plus-circle me-1"></i>Ekle
                    </button>
                </label>
                <div id="kv-container-${field.key}" class="kv-list-container">
                    <!-- Key-Value Satırları Buraya Gelecek -->
                </div>
                ${field.help ? `<div class="form-text">${field.help}</div>` : ''}
            `;

            // Eğer varsayılan değerler varsa (veya empty state için bir tane boş satır)
            setTimeout(() => addKvPair(field.key), 0);
        }
        else if (field.type === 'text' || field.type === 'password' || field.type === 'url') {
            col.innerHTML = `
                <label class="form-label">${field.label} ${field.required ? '<span class="text-danger">*</span>' : ''}</label>
                <input type="${field.type}" class="form-control sms-config-input" 
                       name="${field.key}" 
                       placeholder="${field.placeholder || ''}" 
                       ${field.required && !isUpdateMode ? 'required' : ''}>
                ${field.help ? `<div class="form-text">${field.help}</div>` : ''}
            `;
        }
        else if (field.type === 'select') {
            const optionsHtml = (field.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join('');
            col.innerHTML = `
                <label class="form-label">${field.label}</label>
                <select class="form-select sms-config-input" name="${field.key}">
                    ${optionsHtml}
                </select>
            `;
            if (field.default) {
                setTimeout(() => {
                    const sel = col.querySelector('select');
                    if (sel) sel.value = field.default;
                }, 0);
            }
        }
        else if (field.type === 'code' || field.type === 'textarea') {
            col.innerHTML = `
                <label class="form-label">${field.label}</label>
                <textarea class="form-control sms-config-input font-monospace" 
                          name="${field.key}" rows="5" 
                          placeholder='${field.placeholder || ''}'></textarea>
                ${field.help ? `<div class="form-text">${field.help}</div>` : ''}
            `;
        }

        row.appendChild(col);
    });

    container.appendChild(row);
}

async function handleSaveSmsSettings(e) {
    e.preventDefault();

    const select = document.getElementById('smsProviderSelect');
    const providerId = select.value;

    if (!providerId) {
        Utils.showError('Lütfen sağlayıcı seçiniz');
        return;
    }

    // Inputları topla
    const inputs = document.querySelectorAll('.sms-config-input');
    const configData = {};
    let hasFilledField = false;

    inputs.forEach(input => {
        // KV inputları atla (Onları ayrıca toplayacağız)
        if (input.dataset.kvKey) return;

        const key = input.name;
        const val = input.value.trim();

        // Sadece dolu olanları gönder (veya şifre gibi alanlar boşsa)
        if (val) {
            configData[key] = val;
            hasFilledField = true;
        }
    });

    // Key-Value listelerini topla
    const kvContainers = document.querySelectorAll('.kv-list-container');
    kvContainers.forEach(container => {
        const fieldKey = container.id.replace('kv-container-', '');
        const kvData = {};

        const rows = container.querySelectorAll('.kv-row');
        rows.forEach(row => {
            const k = row.querySelector('.kv-input-key').value.trim();
            const v = row.querySelector('.kv-input-value').value.trim();
            if (k) {
                kvData[k] = v;
                hasFilledField = true;
            }
        });

        if (Object.keys(kvData).length > 0) {
            configData[fieldKey] = JSON.stringify(kvData);
        }
    });

    if (!hasFilledField) {
        Utils.showError('Ayarları değiştirmek için en az bir alanı doldurunuz.');
        return;
    }

    const saveBtn = document.getElementById('saveSmsSettingsBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Kaydediliyor...';

    const payload = {
        provider_id: providerId,
        config: configData
    };

    try {
        await api.put(`/platform-admin/sms/settings/${clinicId}`, payload);

        await Swal.fire({
            icon: 'success',
            title: 'Başarılı!',
            text: 'SMS ayarları kaydedildi.',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error('Kaydetme hatası:', error);
        Utils.showError(typeof error === 'string' ? error : 'Ayarlar kaydedilemedi');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> Ayarları Kaydet';
    }
}

async function handleTestSms() {
    const select = document.getElementById('smsProviderSelect');
    const providerId = select.value;

    if (!providerId) {
        Utils.showError('Lütfen önce bir sağlayıcı seçin.');
        return;
    }

    const { value: phone } = await Swal.fire({
        title: 'Test SMS Gönder',
        input: 'text',
        inputLabel: 'Alıcı Telefon Numarası',
        inputPlaceholder: 'Örn: 5051234567',
        showCancelButton: true,
        confirmButtonText: 'Gönder',
        cancelButtonText: 'İptal',
        inputValidator: (value) => {
            if (!value) return 'Telefon numarası girilmelidir!';
        }
    });

    if (!phone) return;

    // Formdaki güncel config'i topla
    const inputs = document.querySelectorAll('.sms-config-input');
    const configData = {};
    inputs.forEach(input => {
        if (input.dataset.kvKey) return;
        if (input.value.trim()) configData[input.name] = input.value.trim();
    });

    const kvContainers = document.querySelectorAll('.kv-list-container');
    kvContainers.forEach(container => {
        const fieldKey = container.id.replace('kv-container-', '');
        const kvData = {};
        container.querySelectorAll('.kv-row').forEach(row => {
            const k = row.querySelector('.kv-input-key').value.trim();
            const v = row.querySelector('.kv-input-value').value.trim();
            if (k) kvData[k] = v;
        });
        if (Object.keys(kvData).length > 0) configData[fieldKey] = JSON.stringify(kvData);
    });

    const testBtn = document.getElementById('testSmsBtn');
    testBtn.disabled = true;
    testBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Gönderiliyor...';

    try {
        await api.post(`/platform-admin/sms/test/${clinicId}`, {
            provider_id: providerId,
            config: configData,
            phone: phone
        });

        Swal.fire('Başarılı!', 'Test mesajı başarıyla gönderildi.', 'success');
    } catch (error) {
        console.error('Test SMS hatası:', error);
        Utils.showError(typeof error === 'string' ? error : 'Test SMS gönderimi başarısız.');
    } finally {
        testBtn.disabled = false;
        testBtn.innerHTML = '<i class="bi bi-chat-dots"></i> Test SMS';
    }
}

// --- KV Helper Functions ---
window.addKvPair = function (fieldKey, k = '', v = '') {
    const container = document.getElementById(`kv-container-${fieldKey}`);
    if (!container) return;

    const rowId = `kv-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const row = document.createElement('div');
    row.className = 'kv-row mb-2 d-flex gap-2';
    row.id = rowId;

    row.innerHTML = `
        <input type="text" class="form-control form-control-sm kv-input-key" placeholder="Key (örn: Authorization)" value="${k}">
        <input type="text" class="form-control form-control-sm kv-input-value" placeholder="Value" value="${v}">
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="document.getElementById('${rowId}').remove()">
            <i class="bi bi-trash"></i>
        </button>
    `;

    container.appendChild(row);
}
