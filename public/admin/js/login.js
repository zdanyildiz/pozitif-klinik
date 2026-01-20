/**
 * Pozitif Klinik - Admin Login Scripts
 */

document.addEventListener('DOMContentLoaded', function () {
    // Eğer zaten token varsa dashboard'a yönlendir
    const existingToken = localStorage.getItem('platform_token');
    if (existingToken) {
        window.location.href = 'dashboard.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const btnLogin = document.getElementById('btnLogin');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.querySelector('.password-toggle');
    const toggleLink = document.getElementById('toggleLoginMode');
    const clinicInputDiv = document.getElementById('clinic_code').closest('.form-floating');
    const clinicInput = document.getElementById('clinic_code');
    const pageTitle = document.querySelector('.login-header h1');
    const pageSubtitle = document.querySelector('.login-header p');

    let isPlatformMode = false;

    // Şifre göster/gizle
    passwordToggle.addEventListener('click', function () {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        const icon = this.querySelector('i');
        icon.classList.toggle('bi-eye');
        icon.classList.toggle('bi-eye-slash');
    });

    // Login Modu Değiştirme (Klinik <-> Platform)
    toggleLink.addEventListener('click', function (e) {
        e.preventDefault();
        isPlatformMode = !isPlatformMode;

        if (isPlatformMode) {
            // Platform Moduna Geç
            clinicInputDiv.style.display = 'none';
            clinicInput.required = false;
            pageTitle.textContent = 'Platform Admin';
            pageSubtitle.textContent = 'Süper Yönetici Girişi';
            toggleLink.innerHTML = '<i class="bi bi-hospital me-1"></i>Klinik Personel Girişi';
            loginForm.reset();
        } else {
            // Klinik Moduna Geç (Varsayılan)
            clinicInputDiv.style.display = 'block';
            clinicInput.required = true;
            pageTitle.textContent = 'Klinik Yönetimi';
            pageSubtitle.textContent = 'Personel hesabınızla giriş yapın';
            toggleLink.innerHTML = '<i class="bi bi-shield-lock me-1"></i>Platform Yöneticisi Girişi';
            loginForm.reset();
        }
    });

    // Form submit
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const clinicCode = clinicInput.value.trim().toLowerCase();

        // Validasyon
        if (isPlatformMode) {
            if (!username || !password) {
                Utils.showError('Lütfen kullanıcı adı ve şifre giriniz.');
                return;
            }
        } else {
            if (!clinicCode || !username || !password) {
                Utils.showError('Lütfen kurum kodu, kullanıcı adı ve şifre giriniz.');
                return;
            }
        }

        // Butonu devre dışı bırak
        btnLogin.disabled = true;
        btnLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Giriş Yapılıyor...';

        try {
            let endpoint, payload;

            if (isPlatformMode) {
                // Platform Admin Girişi
                endpoint = '/admin/login';
                payload = { username, password };
            } else {
                // Klinik Kullanıcı Girişi
                endpoint = '/auth/login';
                payload = { clinic_code: clinicCode, username, password };
            }

            const result = await api.post(endpoint, payload);

            // Token kontrolü (Platform: access_token, Klinik: token)
            const token = result.data?.token || result.data?.access_token;

            if (result.status && token) {
                // Token'ı kaydet
                localStorage.setItem('platform_token', token);

                // Kullanıcı Tipi (Opsiyonel: Dashboard'da ayrım için)
                localStorage.setItem('user_type', isPlatformMode ? 'platform_admin' : 'clinic_user');

                // Başarı animasyonu
                await Swal.fire({
                    icon: 'success',
                    title: isPlatformMode ? 'Platform Girişi Başarılı' : 'Giriş Başarılı',
                    text: 'Yönetim paneline yönlendiriliyorsunuz...',
                    timer: 1500,
                    showConfirmButton: false,
                    timerProgressBar: true
                });

                // Dashboard'a yönlendir
                window.location.href = 'dashboard.html';
            } else {
                throw new Error(result.message || 'Giriş başarısız');
            }
        } catch (error) {
            console.error('Login error:', error);
            const errorMessage = typeof error === 'string' ? error : (error.message || 'Giriş yapılırken bir hata oluştu');
            Utils.showError(errorMessage);
        } finally {
            // Butonu tekrar aktif et
            btnLogin.disabled = false;
            btnLogin.innerHTML = '<span class="btn-text">Giriş Yap</span>';
        }
    });
});
