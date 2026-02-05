/**
 * FileManager
 * 
 * Pozitif Klinik Dosya Yönetimi Modülü
 * Gelişmiş upload modalı, sürükle-bırak, çoklu dosya ve kategori desteği sunar.
 */
class FileManager {
    constructor(config) {
        this.module = config.module;
        this.relatedId = config.relatedId;
        this.containerId = config.containerId;
        this.uploadBtnId = config.uploadBtnId;
        this.csrfToken = config.csrfToken;
        this.listUrl = config.customListUrl || `/api/files/list/${this.module}/${this.relatedId}`;

        this.container = document.getElementById(this.containerId);
        this.uploadInput = document.getElementById(this.uploadBtnId);

        this.pendingFiles = []; // Madalda bekleyen dosyalar
        this.categories = {
            'other': { name: 'Diğer / Döküman', icon: 'bi-file-earmark', color: 'secondary' },
            'radiology': { name: 'Röntgen / Görüntüleme', icon: 'bi-x-ray', color: 'primary' },
            'lab': { name: 'Laboratuvar Sonucu', icon: 'bi-eyedropper', color: 'info' },
            'report': { name: 'Epikriz / Rapor', icon: 'bi-file-earmark-medical', color: 'success' },
            'prescription': { name: 'Reçete', icon: 'bi-capsule', color: 'warning' }
        };

        this.init();
    }

    init() {
        if (this.uploadInput) {
            this.uploadInput.setAttribute('multiple', 'multiple');
            this.uploadInput.addEventListener('change', (e) => this.prepareUpload(e.target.files));
        }

        this.initUploadModal();
        this.initLightbox();
        this.bindEvents();
        this.bindDragDrop();

        this.loadFiles();
    }

    bindEvents() {
        if (this.container) {
            this.container.addEventListener('click', (e) => {
                const btnDelete = e.target.closest('.btn-delete-file');
                if (btnDelete) {
                    this.deleteFile(btnDelete.dataset.uuid);
                    return;
                }

                const btnPreview = e.target.closest('.preview-file');
                if (btnPreview) {
                    e.preventDefault();
                    this.openLightbox(btnPreview.href, btnPreview.dataset.title);
                }
            });
        }
    }

    /**
     * Upload Modalı Başlatma
     */
    initUploadModal() {
        const modalId = 'fileUploadModal';
        if (!document.getElementById(modalId)) {
            const html = `
                <div class="modal fade" id="${modalId}" data-bs-backdrop="static" tabindex="-1">
                    <div class="modal-dialog modal-lg modal-dialog-centered">
                        <div class="modal-content border-0 shadow-lg">
                            <div class="modal-header bg-light border-0">
                                <h5 class="modal-title fw-bold text-dark">
                                    <i class="bi bi-cloud-arrow-up me-2 text-primary"></i>Dosya Yükleme Paneli
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body p-4">
                                <div id="fileUploadList" class="mb-3">
                                    <!-- Dosyalar buraya eklenecek -->
                                </div>
                                <div class="drop-zone-mini p-4 border-dashed rounded-3 text-center bg-light mb-0" id="modalDropZone">
                                    <i class="bi bi-plus-circle fs-3 text-muted"></i>
                                    <p class="small text-muted mb-0 mt-2">Daha fazla dosya sürükleyin veya ekleyin</p>
                                </div>
                            </div>
                            <div class="modal-footer bg-light border-0">
                                <button type="button" class="btn btn-link text-secondary text-decoration-none" data-bs-dismiss="modal">İptal</button>
                                <button type="button" class="btn btn-primary px-4 rounded-pill" id="startUploadBtn">
                                    <i class="bi bi-check2-circle me-2"></i>Seçilenleri Yükle
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }

        this.uploadModal = new bootstrap.Modal(document.getElementById(modalId));
        this.uploadListContainer = document.getElementById('fileUploadList');

        document.getElementById('startUploadBtn').addEventListener('click', () => this.processQueue());
    }

    /**
     * Dosyaları Yükleme İçin Hazırla (Modal Aç)
     */
    prepareUpload(files) {
        if (!files || files.length === 0) return;

        for (let file of files) {
            // Basit boyut kontrolü
            if (file.size > 20 * 1024 * 1024) {
                Utils.showToast(`${file.name} çok büyük (Max 20MB)`, 'error');
                continue;
            }

            this.pendingFiles.push({
                id: Math.random().toString(36).substr(2, 9),
                file: file,
                displayName: file.name.split('.').slice(0, -1).join('.'), // Uzantısız isim
                category: 'other'
            });
        }

        this.renderUploadList();
        this.uploadModal.show();

        if (this.uploadInput) this.uploadInput.value = '';
    }

    renderUploadList() {
        this.uploadListContainer.innerHTML = '';

        this.pendingFiles.forEach(item => {
            const div = document.createElement('div');
            div.className = 'upload-item-card p-3 border rounded-3 bg-white shadow-sm mb-3 position-relative animate__animated animate__fadeIn';
            div.innerHTML = `
                <div class="row g-3 align-items-center">
                    <div class="col-auto">
                        <div class="file-icon-box rounded bg-primary-subtle p-2">
                             <i class="bi bi-file-earmark-text text-primary fs-4"></i>
                        </div>
                    </div>
                    <div class="col">
                        <div class="mb-2">
                            <input type="text" class="form-control form-control-sm border-0 bg-light fw-bold" 
                                   placeholder="Dosya Adı" value="${item.displayName}" 
                                   onchange="Utils.updatePendingFileName('${item.id}', this.value)">
                        </div>
                        <div class="d-flex gap-2">
                            ${Object.keys(this.categories).map(catKey => `
                                <input type="radio" class="btn-check" name="cat_${item.id}" id="cat_${item.id}_${catKey}" 
                                       value="${catKey}" ${item.category === catKey ? 'checked' : ''}
                                       onchange="Utils.updatePendingFileCat('${item.id}', '${catKey}')">
                                <label class="btn btn-outline-secondary btn-xs py-1 px-2 border-0 rounded-pill" for="cat_${item.id}_${catKey}" title="${this.categories[catKey].name}">
                                    <i class="bi ${this.categories[catKey].icon}"></i>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div class="col-auto">
                        <button class="btn btn-link text-danger p-1" onclick="Utils.removePendingFile('${item.id}')">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>
            `;
            this.uploadListContainer.appendChild(div);
        });

        // Global Utils helper'ları (FileManager içinden erişim zor olduğu için veya daha temiz olması için)
        window.Utils = window.Utils || {};
        window.Utils.updatePendingFileName = (id, val) => {
            const item = this.pendingFiles.find(f => f.id === id);
            if (item) item.displayName = val;
        };
        window.Utils.updatePendingFileCat = (id, cat) => {
            const item = this.pendingFiles.find(f => f.id === id);
            if (item) item.category = cat;
        };
        window.Utils.removePendingFile = (id) => {
            this.pendingFiles = this.pendingFiles.filter(f => f.id !== id);
            this.renderUploadList();
            if (this.pendingFiles.length === 0) this.uploadModal.hide();
        };
    }

    /**
     * Kuyruğu İşle (Yükle)
     */
    async processQueue() {
        const btn = document.getElementById('startUploadBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Yükleniyor...';

        for (let item of this.pendingFiles) {
            const formData = new FormData();
            formData.append('file', item.file);
            formData.append('module', this.module);
            formData.append('related_id', this.relatedId);
            formData.append('display_name', item.displayName);
            formData.append('file_category', item.category);

            try {
                const response = await fetch('/api/files/upload', {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': this.csrfToken },
                    body: formData
                });
                const result = await response.json();
                if (!result.status) throw new Error(result.message);
            } catch (error) {
                Utils.showToast(`${item.file.name} yüklenemedi: ${error.message}`, 'error');
            }
        }

        this.pendingFiles = [];
        this.renderUploadList();
        this.uploadModal.hide();
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check2-circle me-2"></i>Seçilenleri Yükle';

        Utils.showToast('Dosyalar başarıyla yüklendi.');
        this.loadFiles();
    }

    /**
     * Dosyaları Listeleme
     */
    async loadFiles() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-primary opacity-50"></div>
                <p class="text-muted mt-2 small">Dosyalar getiriliyor...</p>
            </div>
        `;

        try {
            const response = await api.get(this.listUrl); // 'api' helper is assumed global
            if (response.data) {
                this.renderList(response.data);
            }
        } catch (error) {
            console.error('List Error:', error);
            this.container.innerHTML = '<div class="alert alert-danger mx-3 mt-3">Dosyalar yüklenemedi.</div>';
        }
    }

    /**
     * Liste Görünümü (Premium Tasarım)
     */
    renderList(files) {
        if (!files || files.length === 0) {
            this.container.innerHTML = `
                <div class="text-center p-5 text-muted opacity-50">
                    <i class="bi bi-folder-x fs-1"></i>
                    <p class="mt-2">Henüz döküman eklenmemiş.</p>
                </div>
            `;
            return;
        }

        let html = '<div class="row g-3 p-3">';

        files.forEach(file => {
            const size = (file.size_kb / 1024).toFixed(2);
            const date = Utils.formatDate(file.created_at);
            const cat = this.categories[file.file_category] || this.categories['other'];
            const displayName = file.display_name || file.original_name;

            let icon = 'bi-file-earmark';
            if (file.mime_type.includes('image')) icon = 'bi-file-earmark-image';
            if (file.mime_type.includes('pdf')) icon = 'bi-file-earmark-pdf';

            html += `
                <div class="col-md-6 col-xl-4">
                    <div class="file-card p-3 rounded-4 bg-white border shadow-sm h-100 position-relative hover-shadow transition">
                        <div class="d-flex align-items-start gap-3">
                            <div class="file-thumb rounded-3 bg-light d-flex align-items-center justify-content-center" style="width: 48px; height: 48px;">
                                <i class="bi ${icon} fs-4 text-${cat.color}"></i>
                            </div>
                            <div class="flex-grow-1 min-w-0">
                                <h6 class="mb-1 text-truncate fw-bold text-dark" title="${displayName}">
                                    <a href="/api/files/view/${file.uuid}" target="_blank" class="text-decoration-none text-dark ${file.mime_type.includes('image') ? 'preview-file' : ''}" data-title="${displayName}">
                                        ${displayName}
                                    </a>
                                </h6>
                                <div class="d-flex align-items-center gap-2 mb-2">
                                    <span class="badge bg-${cat.color}-subtle text-${cat.color} border-0 rounded-pill small px-2">
                                        <i class="bi ${cat.icon} me-1"></i>${cat.name}
                                    </span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <small class="text-muted" style="font-size: 0.75rem;">${size} MB • ${date}</small>
                                    <button class="btn btn-link btn-sm text-danger p-0 border-0 btn-delete-file" data-uuid="${file.uuid}">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        this.container.innerHTML = html;
    }

    async deleteFile(uuid) {
        if (!confirm('Bu dökümanı kalıcı olarak silmek istediğinize emin misiniz?')) return;

        try {
            const res = await api.delete(`/api/files/${uuid}`);
            if (res.status) this.loadFiles();
        } catch (e) {
            Utils.showToast('Silme işlemi başarısız', 'error');
        }
    }

    bindDragDrop() {
        if (!this.container) return;

        const handleDrag = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        ['dragenter', 'dragover'].forEach(name => {
            this.container.addEventListener(name, (e) => {
                handleDrag(e);
                this.container.classList.add('drag-active');
            });
        });

        ['dragleave', 'drop'].forEach(name => {
            this.container.addEventListener(name, (e) => {
                handleDrag(e);
                this.container.classList.remove('drag-active');
                if (name === 'drop' && e.dataTransfer.files.length > 0) {
                    this.prepareUpload(e.dataTransfer.files);
                }
            });
        });
    }

    initLightbox() {
        if (!document.getElementById('fileManagerLightbox')) {
            const html = `
                <div class="modal fade" id="fileManagerLightbox" tabindex="-1">
                    <div class="modal-dialog modal-xl modal-dialog-centered">
                        <div class="modal-content bg-transparent border-0">
                            <div class="modal-header border-0"><button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="modal"></button></div>
                            <div class="modal-body p-0 text-center">
                                <img src="" id="lightboxImage" class="img-fluid rounded shadow-lg" style="max-height: 85vh;">
                                <div id="lightboxCaption" class="text-white mt-3 fw-bold fs-5"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
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
