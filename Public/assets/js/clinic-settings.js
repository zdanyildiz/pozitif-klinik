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

// State
let currentEmailConfig = null;
let hasExistingPassword = false;

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    testEmailModal = new bootstrap.Modal(document.getElementById('testEmailModal'));
    loadClinicData();
    setupEventListeners();
    setupTabs();
});

// Event Listeners
function setupEventListeners() {
    // Form Submit
    emailSettingsForm.addEventListener('submit', handleSaveEmailSettings);

    // Buttons
    testConnectionBtn.addEventListener('click', handleTestConnection);
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

    // Logout
    logoutBtn.addEventListener('click', handleLogout);
}

// Tab Navigasyonu
function setupTabs() {
    const tabs = document.querySelectorAll('.settings-tab');
    const panels = document.querySelectorAll('.settings-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.tab + 'Panel';

            // Tüm tab ve panel'leri deaktif et
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            // Seçili tab ve panel'i aktif et
            tab.classList.add('active');
            document.getElementById(targetId).classList.add('active');
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
