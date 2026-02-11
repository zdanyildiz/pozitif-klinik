const LabEntry = {
    modal: null,

    init: function () {
        if (document.getElementById('labEntryModal')) {
            this.modal = new bootstrap.Modal(document.getElementById('labEntryModal'));
        }
    },

    openModal: async function () {
        if (!this.modal) this.init();
        if (!this.modal) return;

        // Reset form
        document.getElementById('labEntryForm').reset();
        document.getElementById('labItemsTable').getElementsByTagName('tbody')[0].innerHTML = '';

        // Add one empty row
        this.addRow();

        // Set default date
        const dateInput = document.querySelector('input[name="result_date"]');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Load Doctors & Templates
        await Promise.all([
            this.loadDoctors(),
            this.loadTemplates()
        ]);

        this.modal.show();
    },

    loadDoctors: async function () {
        const doctorSelect = document.getElementById('labDoctorSelect');
        if (doctorSelect && doctorSelect.options.length <= 1) {
            try {
                const res = await api.get('/api/users');
                if (res.data && res.data.users) {
                    const doctors = res.data.users.filter(u =>
                        (u.role === 'doctor' || u.role === 'admin') && (u.is_active == 1)
                    );
                    doctors.forEach(doc => {
                        const opt = document.createElement('option');
                        opt.value = doc.id;
                        opt.textContent = doc.name || doc.username;
                        doctorSelect.appendChild(opt);
                    });
                }
            } catch (e) { console.error("Doktor listesi yüklenemedi", e); }
        }
    },

    loadTemplates: async function () {
        const templateSelect = document.getElementById('labTemplateSelect');
        if (templateSelect && templateSelect.options.length <= 1) {
            try {
                const res = await api.get('/api/lab/panels');
                if (res.data && Array.isArray(res.data)) {
                    res.data.forEach(panel => {
                        const opt = document.createElement('option');
                        opt.value = panel.id;
                        opt.textContent = panel.name;
                        templateSelect.appendChild(opt);
                    });
                }
            } catch (e) { console.error("Şablon listesi yüklenemedi", e); }
        }
    },

    loadTemplate: async function (panelId) {
        if (!panelId) return;

        try {
            Swal.showLoading();
            const res = await api.get(`/api/lab/panels/${panelId}/items`);
            if (res.data && Array.isArray(res.data)) {
                // Clear existing rows if they are empty
                const tbody = document.getElementById('labItemsTable').getElementsByTagName('tbody')[0];
                const rows = tbody.querySelectorAll('tr');
                let isEmpty = true;
                rows.forEach(r => {
                    if (r.querySelector('input[name="result_value[]"]').value) isEmpty = false;
                });

                if (isEmpty) tbody.innerHTML = '';

                res.data.forEach(item => {
                    let refRange = '';
                    let min = '';
                    let max = '';

                    if (item.normals && item.normals.length > 0) {
                        const normal = item.normals[0]; // Şimdilik ilkini alıyoruz
                        refRange = normal.reference_text || `${normal.min_value} - ${normal.max_value}`;
                        min = normal.min_value;
                        max = normal.max_value;
                    }

                    this.addRow({
                        test_name: item.test_name,
                        unit: item.default_unit || (item.normals && item.normals[0] ? item.normals[0].unit : ''),
                        reference_range: refRange,
                        min: min,
                        max: max
                    });
                });
            }
            Swal.close();
        } catch (e) {
            console.error("Şablon yüklenemedi", e);
            Swal.fire('Hata', 'Şablon içeriği yüklenemedi', 'error');
        }
    },

    addRow: function (data = {}) {
        const tbody = document.getElementById('labItemsTable').getElementsByTagName('tbody')[0];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="position-relative">
                <input type="text" class="form-control form-control-sm test-autocomplete" 
                       name="test_name[]" placeholder="Test Adı" required value="${data.test_name || ''}" autocomplete="off">
                <div class="autocomplete-suggestions list-group position-absolute w-100 shadow-sm d-none" style="z-index: 1050;"></div>
            </td>
            <td><input type="text" class="form-control form-control-sm result-input" name="result_value[]" placeholder="Değer" required></td>
            <td><input type="text" class="form-control form-control-sm unit-input" name="unit[]" placeholder="Birim" value="${data.unit || ''}"></td>
            <td><input type="text" class="form-control form-control-sm ref-input" name="reference_range[]" placeholder="Ref. Aralığı" value="${data.reference_range || ''}"></td>
            <td class="text-center">
                <div class="form-check form-switch d-flex justify-content-center">
                    <input class="form-check-input abnormal-check" type="checkbox" name="is_abnormal_check[]">
                    <input type="hidden" name="is_abnormal[]" value="0">
                </div>
            </td>
            <td>
                <button type="button" class="btn btn-sm btn-link text-danger p-0" onclick="LabEntry.removeRow(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;

        if (data.min) row.dataset.min = data.min;
        if (data.max) row.dataset.max = data.max;

        this.initRowEvents(row);
        tbody.appendChild(row);
    },

    initRowEvents: function (row) {
        const testInput = row.querySelector('.test-autocomplete');
        const suggestions = row.querySelector('.autocomplete-suggestions');
        const resultInput = row.querySelector('.result-input');
        const checkbox = row.querySelector('.abnormal-check');
        const hidden = row.querySelector('input[type="hidden"]');

        // Autocomplete
        let debounceTimer;
        testInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value;
            if (query.length < 2) {
                suggestions.classList.add('d-none');
                return;
            }

            debounceTimer = setTimeout(async () => {
                try {
                    const res = await api.get(`/api/lab/definitions/search?q=${encodeURIComponent(query)}`);
                    if (res.data && res.data.length > 0) {
                        suggestions.innerHTML = '';
                        res.data.forEach(def => {
                            const item = document.createElement('button');
                            item.type = 'button';
                            item.className = 'list-group-item list-group-item-action small py-1';
                            item.textContent = `${def.test_name} (${def.test_code || 'N/A'})`;
                            item.onclick = () => this.selectDefinition(row, def);
                            suggestions.appendChild(item);
                        });
                        suggestions.classList.remove('d-none');
                    } else {
                        suggestions.classList.add('d-none');
                    }
                } catch (e) { console.error(e); }
            }, 300);
        });

        // Hide suggestions on blur (with delay for click)
        testInput.addEventListener('blur', () => {
            setTimeout(() => suggestions.classList.add('d-none'), 200);
        });

        // Anormal checking
        resultInput.addEventListener('input', () => this.checkAbnormal(row));

        checkbox.addEventListener('change', (e) => {
            hidden.value = e.target.checked ? "1" : "0";
        });
    },

    selectDefinition: async function (row, def) {
        row.querySelector('.test-autocomplete').value = def.test_name;
        row.querySelector('.unit-input').value = def.default_unit || '';
        row.querySelector('.autocomplete-suggestions').classList.add('d-none');

        // Fetch details for reference ranges
        try {
            const res = await api.get(`/api/lab/definitions/${def.id}`);
            if (res.data && res.data.normals) {
                // For simplicity, take the first reference if multiple exist (age/gender logic can be refined later)
                const normal = res.data.normals[0];
                if (normal) {
                    row.querySelector('.ref-input').value = normal.reference_text || `${normal.min_value} - ${normal.max_value}`;
                    row.dataset.min = normal.min_value;
                    row.dataset.max = normal.max_value;

                    // If unit is still empty, take it from normals
                    if (!row.querySelector('.unit-input').value && normal.unit) {
                        row.querySelector('.unit-input').value = normal.unit;
                    }
                }
            }
        } catch (e) { console.error(e); }
    },

    checkAbnormal: function (row) {
        const val = parseFloat(row.querySelector('.result-input').value);
        const min = parseFloat(row.dataset.min);
        const max = parseFloat(row.dataset.max);
        const checkbox = row.querySelector('.abnormal-check');
        const hidden = row.querySelector('input[type="hidden"][name="is_abnormal[]"]');

        if (!isNaN(val)) {
            let isAbnormal = false;
            if (!isNaN(min) && val < min) isAbnormal = true;
            if (!isNaN(max) && val > max) isAbnormal = true;

            checkbox.checked = isAbnormal;
            hidden.value = isAbnormal ? "1" : "0";
        }
    },

    removeRow: function (btn) {
        const row = btn.closest('tr');
        const tbody = row.parentElement;
        if (tbody.children.length > 1) {
            row.remove();
        } else {
            row.querySelectorAll('input').forEach(i => {
                if (i.type === 'checkbox') i.checked = false;
                else if (i.type !== 'hidden') i.value = '';
                if (i.type === 'hidden' && i.name === 'is_abnormal[]') i.value = '0';
            });
            delete row.dataset.min;
            delete row.dataset.max;
        }
    },

    save: async function () {
        const form = document.getElementById('labEntryForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const formData = new FormData(form);
        const payload = {
            patient_id: formData.get('patient_id'),
            result_date: formData.get('result_date'),
            doctor_id: formData.get('doctor_id'),
            appointment_id: formData.get('appointment_id') ? formData.get('appointment_id') : null,
            items: []
        };

        const tbody = document.getElementById('labItemsTable').getElementsByTagName('tbody')[0];
        const rows = tbody.querySelectorAll('tr');

        rows.forEach(row => {
            const testName = row.querySelector('input[name="test_name[]"]').value;
            const resultValue = row.querySelector('input[name="result_value[]"]').value;

            if (testName && resultValue) {
                payload.items.push({
                    test_name: testName,
                    result_value: resultValue,
                    unit: row.querySelector('input[name="unit[]"]').value,
                    reference_range: row.querySelector('input[name="reference_range[]"]').value,
                    is_abnormal: row.querySelector('input[name="is_abnormal[]"]').value === "1"
                });
            }
        });

        if (payload.items.length === 0) {
            Swal.fire('Uyarı', 'En az bir test sonucu girmelisiniz.', 'warning');
            return;
        }

        try {
            Swal.fire({ title: 'Kaydediliyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await api.post('/api/lab', payload);
            Swal.fire({ icon: 'success', title: 'Başarılı', text: 'Laboratuvar sonucu başarıyla kaydedildi.', timer: 1500, showConfirmButton: false })
                .then(() => window.location.reload());
        } catch (error) {
            console.error(error);
            Swal.fire('Hata', error.response?.data?.message || 'Bir hata oluştu.', 'error');
        }
    },

    deleteResult: async function (id) {
        const result = await Swal.fire({
            title: 'Emin misiniz?',
            text: "Bu laboratuvar sonucu silinecek. İşlem geri alınamaz!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Evet, Sil',
            cancelButtonText: 'İptal'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/api/lab/${id}`);
                Swal.fire('Silindi!', 'Laboratuvar sonucu silindi.', 'success').then(() => window.location.reload());
            } catch (error) {
                console.error(error);
                Swal.fire('Hata', 'Silme işlemi başarısız.', 'error');
            }
        }
    }
};
