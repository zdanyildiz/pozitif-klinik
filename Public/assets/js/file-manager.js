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
        this.uploadTrigger = document.getElementById(this.uploadBtnId); // Label or Button

        this.pendingFiles = [];
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
        // Create hidden file input if not exists
        let hiddenInput = document.getElementById('global_file_input');
        if (!hiddenInput) {
            hiddenInput = document.createElement('input');
            hiddenInput.type = 'file';
            hiddenInput.id = 'global_file_input';
            hiddenInput.multiple = true;
            hiddenInput.style.display = 'none';
            document.body.appendChild(hiddenInput);
        }
        this.fileInput = hiddenInput;

        // Listen for input changes
        this.fileInput.addEventListener('change', (e) => this.prepareUpload(e.target.files));

        // If trigger is a label for an input, we might need to prevent default or change approach
        if (this.uploadTrigger) {
            this.uploadTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                this.openUploadModal();
            });
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

    initUploadModal() {
        const modalId = 'fileUploadModal';
        if (!document.getElementById(modalId)) {
            const html = `
                <div class="modal fade" id="${modalId}" data-bs-backdrop="static" tabindex="-1">
                    <div class="modal-dialog modal-lg modal-dialog-centered">
                        <div class="modal-content border-0 shadow-lg" style="border-radius: 1.25rem;">
                            <div class="modal-header bg-white border-0 pt-4 px-4 pb-0">
                                <h5 class="modal-title fw-bold">
                                    <span class="p-2 bg-primary-subtle rounded-3 me-2 border border-primary-subtle">
                                        <i class="bi bi-cloud-arrow-up text-primary"></i>
                                    </span>
                                    Dosya Yükleme Paneli
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body p-4">
                                <div id="fileUploadList" class="mb-3">
                                    <!-- Files go here -->
                                </div>
                                <div class="drop-zone-modern p-5 border-dashed rounded-4 text-center bg-light cursor-pointer transition hover-bg-light-subtle" id="modalDropZone">
                                    <div class="mb-3">
                                        <i class="bi bi-files fs-1 text-primary-subtle"></i>
                                    </div>
                                    <h6 class="fw-bold mb-1">Dosyaları Buraya Sürükleyin</h6>
                                    <p class="text-muted small mb-3">Veya bilgisayarınızdan seçmek için aşağıdaki butona tıklayın</p>
                                    <button type="button" class="btn btn-primary rounded-pill px-4 shadow-sm" id="modalAddFilesBtn">
                                        <i class="bi bi-plus-lg me-1"></i> Dosya Seçin
                                    </button>
                                </div>
                            </div>
                            <div class="modal-footer bg-light border-0 py-3 px-4" id="uploadModalFooter" style="display: none;">
                                <button type="button" class="btn btn-link text-secondary text-decoration-none" data-bs-dismiss="modal">İptal</button>
                                <button type="button" class="btn btn-primary px-5 rounded-pill shadow" id="startUploadBtn">
                                    <i class="bi bi-upload me-2"></i>Yüklemeyi Başlat (<span id="pendingCount">0</span>)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }

        this.uploadModalEl = document.getElementById(modalId);
        this.uploadModal = new bootstrap.Modal(this.uploadModalEl);
        this.uploadListContainer = document.getElementById('fileUploadList');
        this.pendingCountSpan = document.getElementById('pendingCount');
        this.modalFooter = document.getElementById('uploadModalFooter');
        this.dropZone = document.getElementById('modalDropZone');

        if (!this.initializedEvents) {
            document.getElementById('startUploadBtn').addEventListener('click', () => this.processQueue());
            document.getElementById('modalAddFilesBtn').addEventListener('click', () => this.fileInput.click());
            this.dropZone.addEventListener('click', (e) => {
                if (e.target.id === 'modalDropZone' || (e.target.closest('#modalDropZone') && e.target.tagName !== 'BUTTON')) {
                    this.fileInput.click();
                }
            });

            // Event delegation for upload list
            this.uploadListContainer.addEventListener('input', (e) => {
                const row = e.target.closest('[data-id]');
                if (!row) return;
                const id = row.dataset.id;
                const item = this.pendingFiles.find(f => f.id === id);
                if (!item) return;

                if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
                    item.displayName = e.target.value;
                }
                if (e.target.tagName === 'INPUT' && e.target.type === 'radio') {
                    item.category = e.target.value;
                }
            });

            this.uploadListContainer.addEventListener('click', (e) => {
                const btnRemove = e.target.closest('.btn-remove-pending');
                if (btnRemove) {
                    const id = btnRemove.dataset.id;
                    this.pendingFiles = this.pendingFiles.filter(f => f.id !== id);
                    this.renderUploadList();
                }
            });
            this.initializedEvents = true;
        }
    }

    openUploadModal() {
        this.pendingFiles = [];
        this.renderUploadList();
        this.uploadModal.show();
    }

    prepareUpload(files) {
        if (!files || files.length === 0) return;

        for (let file of files) {
            if (file.size > 20 * 1024 * 1024) {
                if (typeof Utils !== 'undefined' && Utils.showToast) Utils.showToast(`${file.name} çok büyük (Max 20MB)`, 'error');
                continue;
            }

            this.pendingFiles.push({
                id: Math.random().toString(36).substr(2, 9),
                file: file,
                displayName: file.name.split('.').slice(0, -1).join('.'),
                category: 'other'
            });
        }

        this.renderUploadList();
        this.fileInput.value = '';
    }

    renderUploadList() {
        this.uploadListContainer.innerHTML = '';
        const count = this.pendingFiles.length;
        this.pendingCountSpan.textContent = count;
        this.modalFooter.style.display = count > 0 ? 'flex' : 'none';

        if (count > 0) {
            this.dropZone.style.display = 'none';
            // Show a small 'add more' handle if needed, or just let them use the modal footer
        } else {
            this.dropZone.style.display = 'block';
        }

        this.pendingFiles.forEach(item => {
            const div = document.createElement('div');
            div.className = 'upload-item-card p-3 border rounded-3 bg-white shadow-sm mb-3 position-relative animate__animated animate__fadeInUp';
            div.setAttribute('data-id', item.id);
            div.innerHTML = `
                <div class="row g-3 align-items-center">
                    <div class="col-auto">
                        <div class="file-icon-box rounded bg-primary-subtle p-2">
                             <i class="bi bi-file-earmark-text text-primary fs-4"></i>
                        </div>
                    </div>
                    <div class="col">
                        <div class="mb-2">
                            <label class="small text-muted fw-bold mb-1">Dosya Görünüm Adı</label>
                            <input type="text" class="form-control form-control-sm border shadow-none rounded-2 fw-bold" 
                                   placeholder="Dosya Adı" value="${item.displayName}">
                        </div>
                        <div class="d-flex flex-wrap gap-2 mt-2">
                            ${Object.keys(this.categories).map(catKey => `
                                <div class="cat-pill">
                                    <input type="radio" class="btn-check" name="cat_${item.id}" id="cat_${item.id}_${catKey}" 
                                           value="${catKey}" ${item.category === catKey ? 'checked' : ''}>
                                    <label class="btn btn-outline-primary btn-xs py-1 px-2 border rounded-pill shadow-xs" for="cat_${item.id}_${catKey}">
                                        <i class="bi ${this.categories[catKey].icon} me-1"></i>${this.categories[catKey].name.split(' ')[0]}
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="col-auto">
                        <button type="button" class="btn btn-outline-danger btn-sm border-0 rounded-circle btn-remove-pending" data-id="${item.id}">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>
            `;
            this.uploadListContainer.appendChild(div);
        });

        if (count > 0) {
            const addMore = document.createElement('div');
            addMore.className = 'text-center mt-3';
            addMore.innerHTML = `
                <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill border-dashed px-4" onclick="document.getElementById('global_file_input').click()">
                    <i class="bi bi-plus-lg me-1"></i> Başka Dosya Ekle
                </button>
            `;
            this.uploadListContainer.appendChild(addMore);
        }
    }

    async processQueue() {
        const btn = document.getElementById('startUploadBtn');
        const originalContent = btn.innerHTML;
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
                console.error('File Upload Error:', error);
            }
        }

        this.pendingFiles = [];
        this.renderUploadList();
        this.uploadModal.hide();
        btn.disabled = false;
        btn.innerHTML = originalContent;

        if (typeof Utils !== 'undefined' && Utils.showToast) Utils.showToast('Dosyalar başarıyla yüklendi.');
        this.loadFiles();
    }

    async loadFiles() {
        if (!this.container) return;
        this.container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary opacity-50"></div></div>';

        try {
            // Using global 'api' if available, else fetch
            let data;
            if (window.api) {
                const res = await api.get(this.listUrl);
                data = res.data;
            } else {
                const res = await fetch(this.listUrl);
                const json = await res.json();
                data = json.data;
            }
            this.renderList(data);
        } catch (error) {
            console.error('Load Error:', error);
            this.container.innerHTML = '<div class="alert alert-danger mx-3">Hata oluştu.</div>';
        }
    }

    renderList(files) {
        if (!files || files.length === 0) {
            this.container.innerHTML = '<div class="text-center p-5 text-muted"><i class="bi bi-folder2-open fs-1 opacity-25"></i><p>Dosya yok</p></div>';
            return;
        }

        let html = '<div class="row g-3 p-2">';
        files.forEach(file => {
            const size = (file.size_kb / 1024).toFixed(2);
            const date = new Date(file.created_at).toLocaleDateString('tr-TR');
            const cat = this.categories[file.file_category] || this.categories['other'];
            const displayName = file.display_name || file.original_name;

            let icon = 'bi-file-earmark';
            if (file.mime_type.includes('image')) icon = 'bi-file-earmark-image';
            if (file.mime_type.includes('pdf')) icon = 'bi-file-earmark-pdf';

            html += `
                <div class="col-md-12 col-xl-6">
                    <div class="file-card p-3 rounded-3 bg-white border h-100 shadow-sm transition">
                        <div class="d-flex align-items-center gap-3">
                            <div class="file-thumb flex-shrink-0 bg-${cat.color}-subtle rounded-3 d-flex align-items-center justify-content-center" style="width: 48px; height: 48px;">
                                <i class="bi ${icon} fs-4 text-${cat.color}"></i>
                            </div>
                            <div class="flex-grow-1 min-w-0">
                                <h6 class="mb-1 file-card-title fw-bold">
                                    <a href="/api/files/view/${file.uuid}" target="_blank" class="text-decoration-none text-dark ${file.mime_type.includes('image') ? 'preview-file' : ''}" data-title="${displayName}">
                                        ${displayName}
                                    </a>
                                </h6>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="badge cat-badge bg-${cat.color}-subtle">
                                        <i class="bi ${cat.icon} me-1"></i>${cat.name}
                                    </span>
                                    <span class="text-muted" style="font-size: 0.7rem;">${size} MB</span>
                                </div>
                            </div>
                            <div class="actions">
                                <button class="btn btn-outline-danger btn-sm border-0 rounded-circle btn-delete-file" data-uuid="${file.uuid}">
                                    <i class="bi bi-trash"></i>
                                </button>
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
        if (!confirm('Silmek istediğinize emin misiniz?')) return;
        try {
            const res = await api.delete(`/api/files/${uuid}`);
            if (res.status) this.loadFiles();
        } catch (e) {
            alert('Hata!');
        }
    }

    bindDragDrop() {
        if (!this.container) return;
        ['dragenter', 'dragover'].forEach(n => {
            this.container.addEventListener(n, (e) => { e.preventDefault(); this.container.classList.add('drag-active'); });
        });
        ['dragleave', 'drop'].forEach(n => {
            this.container.addEventListener(n, (e) => { e.preventDefault(); this.container.classList.remove('drag-active'); if (n === 'drop') this.prepareUpload(e.dataTransfer.files); });
        });
    }

    initLightbox() {
        if (!document.getElementById('fileManagerLightbox')) {
            const h = `
                <div class="modal fade" id="fileManagerLightbox" tabindex="-1" aria-hidden="true" role="dialog">
                    <div class="modal-dialog modal-xl modal-dialog-centered">
                        <div class="modal-content bg-transparent border-0">
                            <div class="modal-header border-0"><button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="modal" aria-label="Close"></button></div>
                            <div class="modal-body p-0 text-center">
                                <img src="" id="lightboxImage" class="img-fluid rounded" style="max-height: 85vh;">
                                <div id="lightboxCaption" class="text-white mt-3 fw-bold"></div>
                            </div>
                        </div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', h);
        }
        this.lightboxModal = new bootstrap.Modal(document.getElementById('fileManagerLightbox'));
    }

    openLightbox(u, t) {
        const i = document.getElementById('lightboxImage');
        const c = document.getElementById('lightboxCaption');
        i.src = u;
        c.textContent = t;
        this.lightboxModal.show();
    }
}
