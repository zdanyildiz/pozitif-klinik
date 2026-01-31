/**
 * FileManager
 * 
 * Pozitif Klinik Dosya Yönetimi Modülü
 * API ile iletişim kurarak dosya yükleme, listeleme ve silme işlemlerini yönetir.
 */
class FileManager {
    constructor(config) {
        this.module = config.module;
        this.relatedId = config.relatedId;
        this.containerId = config.containerId; // Liste kapsayıcısı ID
        this.uploadBtnId = config.uploadBtnId; // Yükleme butonu ID
        this.csrfToken = config.csrfToken;

        this.container = document.getElementById(this.containerId);
        this.uploadInput = document.getElementById(this.uploadBtnId); // Input type=file elem

        this.init();
    }

    init() {
        if (this.uploadInput) {
            this.uploadInput.addEventListener('change', (e) => this.handleUpload(e));
        }

        // Event Delegation for Delete Buttons
        if (this.container) {
            this.container.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-delete-file');
                if (btn) {
                    const uuid = btn.dataset.uuid;
                    this.deleteFile(uuid);
                }
            });
        }

        // İlk yüklemede listeyi getir
        this.loadFiles();
    }

    /**
     * Dosya Yükleme İşlemi
     */
    async handleUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Basit validasyon
        if (file.size > 10 * 1024 * 1024) { // 10MB
            alert('Dosya boyutu 10MB\'dan büyük olamaz.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('module', this.module);
        formData.append('related_id', this.relatedId);
        // CSRF Token ekle (Eğer header dışında body'de de isteniyorsa)
        // Genelde header yeterli: X-CSRF-Token

        this.setLoading(true);

        try {
            const response = await fetch('/api/files/upload', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': this.csrfToken
                },
                body: formData
            });

            const result = await response.json();

            if (result.status) {
                // Başarılı
                this.loadFiles(); // Listeyi yenile
                event.target.value = ''; // Input'u temizle
            } else {
                alert('Hata: ' + result.message);
            }
        } catch (error) {
            console.error('Upload Error:', error);
            alert('Bir hata oluştu.');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Dosyaları Listeleme
     */
    async loadFiles() {
        if (!this.container) return;

        this.container.innerHTML = '<div class="text-center p-3">Yükleniyor...</div>';

        try {
            const response = await fetch(`/api/files/list/${this.module}/${this.relatedId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            const result = await response.json();

            if (result.status) {
                this.renderList(result.data);
            } else {
                this.container.innerHTML = `<div class="alert alert-danger">${result.message}</div>`;
            }
        } catch (error) {
            console.error('List Error:', error);
            this.container.innerHTML = '<div class="alert alert-danger">Dosyalar yüklenemedi.</div>';
        }
    }

    /**
     * Listeyi Render Etme
     */
    renderList(files) {
        if (!files || files.length === 0) {
            this.container.innerHTML = '<div class="text-muted text-center p-3">Henüz dosya yüklenmemiş.</div>';
            return;
        }

        let html = '<ul class="list-group list-group-flush">';

        files.forEach(file => {
            const size = (file.size_kb / 1024).toFixed(2); // MB
            const date = new Date(file.created_at).toLocaleDateString('tr-TR');

            // Dosya ikonunu belirle
            let icon = 'bi-file-earmark';
            if (file.mime_type.includes('image')) icon = 'bi-file-earmark-image';
            else if (file.mime_type.includes('pdf')) icon = 'bi-file-earmark-pdf';

            html += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <i class="bi ${icon} fs-4 me-3 text-primary"></i>
                        <div>
                            <a href="/api/files/view/${file.uuid}" target="_blank" class="text-decoration-none fw-bold text-dark">
                                ${file.original_name}
                            </a>
                            <div class="small text-muted">
                                ${size} MB • ${date}
                            </div>
                        </div>
                    </div>
                    
                    <button class="btn btn-sm btn-outline-danger btn-delete-file" data-uuid="${file.uuid}">
                        <i class="bi bi-trash"></i>
                    </button>
                </li>
            `;
        });

        html += '</ul>';
        this.container.innerHTML = html;
    }

    /**
     * Dosya Silme
     */
    async deleteFile(uuid) {
        if (!confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;

        try {
            const response = await fetch(`/api/files/${uuid}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-Token': this.csrfToken,
                    'Accept': 'application/json'
                }
            });

            const result = await response.json();

            if (result.status) {
                this.loadFiles(); // Listeyi yenile
            } else {
                alert('Hata: ' + result.message);
            }
        } catch (error) {
            console.error('Delete Error:', error);
            alert('Silme işlemi başarısız.');
        }
    }

    setLoading(isLoading) {
        if (this.container) {
            this.container.style.opacity = isLoading ? '0.5' : '1';
        }
    }
}
