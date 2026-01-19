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

    // Şifre göster/gizle
    passwordToggle.addEventListener('click', function () {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        const icon = this.querySelector('i');
        icon.classList.toggle('bi-eye');
        icon.classList.toggle('bi-eye-slash');
    });

    // Form submit
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            Utils.showError('Lütfen kullanıcı adı ve şifre giriniz.');
            return;
        }

        // Butonu devre dışı bırak
        btnLogin.disabled = true;
        btnLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Giriş Yapılıyor...';

        try {
            const result = await api.post('/admin/login', {
                username: username,
                password: password
            });

            if (result.status && result.data && result.data.access_token) {
                // Token'ı kaydet
                localStorage.setItem('platform_token', result.data.access_token);

                // Başarı animasyonu
                await Swal.fire({
                    icon: 'success',
                    title: result.message || 'Hoş Geldiniz!',
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
            // Interceptor hatayı string olarak fırlatıyor olabilir veya Axios hatası olabilir
            const errorMessage = typeof error === 'string' ? error : (error.message || 'Giriş yapılırken bir hata oluştu');
            Utils.showError(errorMessage);
        } finally {
            // Butonu tekrar aktif et
            btnLogin.disabled = false;
            btnLogin.innerHTML = '<span class="btn-text">Giriş Yap</span>';
        }
    });
});
