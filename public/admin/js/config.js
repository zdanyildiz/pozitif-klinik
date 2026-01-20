/**
 * Pozitif Klinik - Admin Panel API Konfigürasyonu
 */

// API Base URL'i mevcut sayfa yoluna göre dinamik olarak hesapla
// Örn: /pozitif-klinik/public/admin/index.html -> /pozitif-klinik/public
const getBasePath = () => {
    const path = window.location.pathname;
    if (path.includes('/admin/')) {
        return path.split('/admin/')[0];
    }
    if (path.endsWith('/admin')) {
        return path.substring(0, path.length - 6);
    }
    return '';
};

const API_URL = window.location.origin + getBasePath();

// Axios instance oluştur
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    timeout: 10000
});

// Her istekte Token ekle (Request Interceptor)
api.interceptors.request.use(
    config => {
        const token = localStorage.getItem('platform_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// Yanıtı Karşılama (Response Interceptor)
api.interceptors.response.use(
    (response) => {
        // Backend'den "status: true" geldiyse, tüm zarfı dön (status, message, data)
        if (response.data && response.data.status === true) {
            return response.data;
        } else {
            // Backend "status: false" dediyse (ama HTTP 200 döndüyse bile) hata fırlat
            const message = response.data?.message || "İşlem başarısız";
            return Promise.reject(message);
        }
    },
    (error) => {
        // HTTP hatası olduysa (401, 500 vb.)
        if (error.response && error.response.status === 401) {
            // Sadece login sayfasında değilsek yönlendir
            const isLoginPage = window.location.pathname.endsWith('index.html') ||
                window.location.pathname.endsWith('/admin/') ||
                window.location.pathname.endsWith('/admin');

            if (!isLoginPage) {
                localStorage.removeItem('platform_token');
                window.location.href = 'index.html';
            }
        }

        // Backend'in gönderdiği standart mesajı yakala
        let message = "Bilinmeyen hata";
        if (error.response && error.response.data && error.response.data.message) {
            message = error.response.data.message;
        } else if (error.message) {
            message = error.message;
        }

        return Promise.reject(message);
    }
);

/**
 * Yardımcı Fonksiyonlar
 */
const Utils = {
    // Tarih formatlama
    formatDate: (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Durum badge'i oluştur
    getStatusBadge: (isActive) => {
        if (isActive === 1 || isActive === true || isActive === '1') {
            return '<span class="badge bg-success">Aktif</span>';
        }
        return '<span class="badge bg-danger">Pasif</span>';
    },

    // Hata mesajı göster
    showError: (message, title = 'Hata!') => {
        Swal.fire({
            icon: 'error',
            title: title,
            text: message,
            confirmButtonColor: '#dc3545'
        });
    },

    // Başarı mesajı göster
    showSuccess: (message, title = 'Başarılı!') => {
        Swal.fire({
            icon: 'success',
            title: title,
            text: message,
            confirmButtonColor: '#198754',
            timer: 2000,
            showConfirmButton: false
        });
    },

    // Loading göster
    showLoading: (message = 'Yükleniyor...') => {
        Swal.fire({
            title: message,
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    },

    // Loading kapat
    closeLoading: () => {
        Swal.close();
    }
};
