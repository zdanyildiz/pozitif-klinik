/**
 * Pozitif Klinik - Admin Login Scripts
 */

document.addEventListener('DOMContentLoaded', function () {
    // Eğer zaten token varsa dashboard'a yönlendir
    const existingToken = localStorage.getItem('platform_token');
    const userType = localStorage.getItem('user_type');
    if (existingToken) {
        if (userType === 'platform_admin') {
            window.location.href = API_URL + '/legacy/dashboard.html';
        } else {
            window.location.href = API_URL + '/admin/patients';
        }
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const btnLogin = document.getElementById('btnLogin');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.querySelector('.password-toggle');
    const toggleLink = document.getElementById('toggleLoginMode');

    // Check if elements exist before attaching listeners
    const clinicCodeInput = document.getElementById('clinic_code');
    const clinicInputDiv = clinicCodeInput ? clinicCodeInput.closest('.form-floating') : null;
    const pageTitle = document.querySelector('.login-header h1');
    const pageSubtitle = document.querySelector('.login-header p');

    let isPlatformMode = window.isPlatformModeOverride || false;

    // If we're on the dedicated platform page, ensure UI matches
    if (isPlatformMode && pageTitle && pageSubtitle && toggleLink) {
        if (clinicInputDiv) clinicInputDiv.style.display = 'none';
        if (clinicCodeInput) clinicCodeInput.required = false;
        pageTitle.textContent = 'Platform Admin';
        pageSubtitle.textContent = 'Süper Yönetici Girişi';
        toggleLink.innerHTML = '<i class="bi bi-hospital me-1"></i>Klinik Personel Girişi';
    }

    // Şifre göster/gizle
    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', function () {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            const icon = this.querySelector('i');
            if (icon) {
                icon.classList.toggle('bi-eye');
                icon.classList.toggle('bi-eye-slash');
            }
        });
    }

    // Login Modu Değiştirme (Klinik <-> Platform)
    if (toggleLink) {
        toggleLink.addEventListener('click', function (e) {
            e.preventDefault();
            isPlatformMode = !isPlatformMode;

            if (isPlatformMode) {
                // Platform Moduna Geç
                if (clinicInputDiv) clinicInputDiv.style.display = 'none';
                if (clinicCodeInput) clinicCodeInput.required = false;
                if (pageTitle) pageTitle.textContent = 'Platform Admin';
                if (pageSubtitle) pageSubtitle.textContent = 'Süper Yönetici Girişi';
                toggleLink.innerHTML = '<i class="bi bi-hospital me-1"></i>Klinik Personel Girişi';
            } else {
                // Klinik Moduna Geç (Varsayılan)
                if (clinicInputDiv) clinicInputDiv.style.display = 'block';
                if (clinicCodeInput) clinicCodeInput.required = true;
                if (pageTitle) pageTitle.textContent = 'Klinik Yönetimi';
                if (pageSubtitle) pageSubtitle.textContent = 'Personel hesabınızla giriş yapın';
                toggleLink.innerHTML = '<i class="bi bi-shield-lock me-1"></i>Platform Yöneticisi Girişi';
            }
            if (loginForm) loginForm.reset();
        });
    }

    // Form submit
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const usernameField = document.getElementById('username');
            const passwordField = document.getElementById('password');

            const username = usernameField ? usernameField.value.trim() : '';
            const password = passwordField ? passwordField.value : '';
            const clinicCode = clinicCodeInput ? clinicCodeInput.value.trim().toLowerCase() : '';

            // Validasyon
            if (isPlatformMode) {
                if (!username || !password) {
                    if (window.Utils) Utils.showError('Lütfen kullanıcı adı ve şifre giriniz.');
                    else alert('Lütfen kullanıcı adı ve şifre giriniz.');
                    return;
                }
            } else {
                if (!clinicCode || !username || !password) {
                    if (window.Utils) Utils.showError('Lütfen kurum kodu, kullanıcı adı ve şifre giriniz.');
                    else alert('Lütfen kurum kodu, kullanıcı adı ve şifre giriniz.');
                    return;
                }
            }

            // Butonu devre dışı bırak
            if (btnLogin) {
                btnLogin.disabled = true;
                btnLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Giriş Yapılıyor...';
            }

            try {
                let endpoint, payload;

                if (isPlatformMode) {
                    // Platform Admin Girişi
                    endpoint = '/platform-admin/login';
                    payload = { username, password };
                } else {
                    // Klinik Kullanıcı Girişi
                    endpoint = '/auth/login';
                    payload = { clinic_code: clinicCode, username, password };
                }

                if (!window.api) throw new Error('API client not found');

                const result = await api.post(endpoint, payload);

                // Token kontrolü (Platform: access_token, Klinik: token)
                const token = result.data?.token || result.data?.access_token;

                if (result.status && token) {
                    // Token'ı kaydet
                    localStorage.setItem('platform_token', token);

                    // Kullanıcı Tipi
                    localStorage.setItem('user_type', isPlatformMode ? 'platform_admin' : 'clinic_user');

                    // Kullanıcı Detayları (Klinik tarafında)
                    if (!isPlatformMode && result.data?.user) {
                        localStorage.setItem('user_role', result.data.user.role || '');
                        localStorage.setItem('user_full_name', result.data.user.name || result.data.user.username || '');
                    }

                    // Başarı animasyonu
                    if (window.Swal) {
                        await Swal.fire({
                            icon: 'success',
                            title: isPlatformMode ? 'Platform Girişi Başarılı' : 'Giriş Başarılı',
                            text: 'Yönetim paneline yönlendiriliyorsunuz...',
                            timer: 1500,
                            showConfirmButton: false,
                            timerProgressBar: true
                        });
                    }

                    if (isPlatformMode) {
                        window.location.href = API_URL + '/legacy/dashboard.html';
                    } else {
                        window.location.href = API_URL + '/admin/patients';
                    }
                } else {
                    throw new Error(result.message || 'Giriş başarısız');
                }
            } catch (error) {
                console.error('Login error:', error);
                const errorMessage = typeof error === 'string' ? error : (error.message || 'Giriş yapılırken bir hata oluştu');
                if (window.Utils) Utils.showError(errorMessage);
                else alert(errorMessage);
            } finally {
                // Butonu tekrar aktif et
                if (btnLogin) {
                    btnLogin.disabled = false;
                    btnLogin.innerHTML = '<span class="btn-text">Giriş Yap</span>';
                }
            }
        });
    }
});
