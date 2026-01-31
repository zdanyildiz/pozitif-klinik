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
        this.listUrl = config.customListUrl || `/api/files/list/${this.module}/${this.relatedId}`;

        this.container = document.getElementById(this.containerId);
        this.uploadInput = document.getElementById(this.uploadBtnId); // Input type=file elem

        this.init();
    }

    init() {
        if (this.uploadInput) {
            this.uploadInput.addEventListener('change', (e) => this.handleUpload(e));
        }

        // Initialize features
        this.bindDragDrop();
        this.initLightbox();

        // Event Delegation for Delete Buttons & Preview
        if (this.container) {
            this.container.addEventListener('click', (e) => {
                const btnDelete = e.target.closest('.btn-delete-file');
                if (btnDelete) {
                    const uuid = btnDelete.dataset.uuid;
                    this.deleteFile(uuid);
                    return;
                }

                const btnPreview = e.target.closest('.preview-file');
                if (btnPreview) {
                    e.preventDefault();
                    const url = btnPreview.href;
                    const title = btnPreview.dataset.title;
                    this.openLightbox(url, title);
                }
            });
        }

        // İlk yüklemede listeyi getir (Eğer SSR ile gelmediyse)
        const hasSSRData = this.container && (
            this.container.querySelector('ul') ||
            document.getElementById(`empty_file_list_${this.relatedId}`)
        );

        if (!hasSSRData) {
            this.loadFiles();
        }
    }

    /**
     * Dosya Yükleme İşlemi
     */
    /**
     * Dosya Yükleme İşlemi (Input Event)
     */
    async handleUpload(event) {
        const file = event.target.files[0];
        if (file) {
            await this.uploadFile(file);
        }
    }

    /**
     * Dosyaları Listeleme
     */
    async loadFiles() {
        if (!this.container) return;

        this.container.innerHTML = '<div class="text-center p-3">Yükleniyor...</div>';

        try {
            const response = await fetch(this.listUrl, {
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
            // Dosya ikonunu ve link yapısını belirle
            let icon = 'bi-file-earmark';
            let linkHtml = '';

            if (file.mime_type.includes('image')) {
                icon = 'bi-file-earmark-image';
                linkHtml = `
                    <a href="/api/files/view/${file.uuid}" class="preview-file text-decoration-none fw-bold text-dark" data-title="${file.original_name}">
                        ${file.original_name}
                    </a>`;
            } else if (file.mime_type.includes('pdf')) {
                icon = 'bi-file-earmark-pdf';
                linkHtml = `
                    <a href="/api/files/view/${file.uuid}" target="_blank" class="text-decoration-none fw-bold text-dark">
                        ${file.original_name}
                    </a>`;
            } else {
                linkHtml = `
                    <a href="/api/files/view/${file.uuid}" target="_blank" class="text-decoration-none fw-bold text-dark">
                        ${file.original_name}
                    </a>`;
            }

            html += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <i class="bi ${icon} fs-4 me-3 text-primary"></i>
                        <div>
                            ${linkHtml}
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

    /**
     * Drag & Drop Events
     */
    bindDragDrop() {
        if (!this.container) return;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.container.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Highlight drop area
        ['dragenter', 'dragover'].forEach(eventName => {
            this.container.addEventListener(eventName, () => {
                this.container.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.container.addEventListener(eventName, () => {
                this.container.classList.remove('drag-over');
            }, false);
        });

        // Handle dropped files
        this.container.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                // Mock an event object for handleUpload or call uploaded logic directly
                // handleUpload expects an event with target.files
                // We'll create a synthetic object or refactor handleUpload
                this.uploadFile(files[0]);
            }
        }, false);
    }

    /**
     * Refactored Upload Logic
     */
    async uploadFile(file) {
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
                this.loadFiles();
                if (this.uploadInput) this.uploadInput.value = '';
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
     * Initialize Lightbox
     */
    initLightbox() {
        // Create modal if not exists
        if (!document.getElementById('fileManagerLightbox')) {
            const modalHtml = `
                <div class="modal fade" id="fileManagerLightbox" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-xl modal-dialog-centered">
                        <div class="modal-content bg-transparent border-0 shadow-none">
                            <div class="modal-header border-0 p-0 mb-2">
                                <button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body p-0 text-center">
                                <img src="" id="lightboxImage" class="img-fluid rounded shadow-lg" style="max-height: 85vh;">
                                <div id="lightboxCaption" class="text-white mt-2 fw-bold"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        this.lightboxModal = new bootstrap.Modal(document.getElementById('fileManagerLightbox'));
    }

    openLightbox(url, title) {
        const img = document.getElementById('lightboxImage');
        const caption = document.getElementById('lightboxCaption');

        img.src = url;
        caption.textContent = title || '';
        this.lightboxModal.show();
    }
}
