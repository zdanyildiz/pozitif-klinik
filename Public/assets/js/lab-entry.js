/* Public/assets/js/lab-entry.js */
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

        // Load Doctors if empty
        const doctorSelect = document.getElementById('labDoctorSelect');
        if (doctorSelect && doctorSelect.options.length <= 1) {
            try {
                // Load users list
                const res = await api.get('/api/users');
                if (res.data && res.data.users && Array.isArray(res.data.users)) {
                    const doctors = res.data.users.filter(u =>
                        (u.role === 'doctor' || u.role === 'admin') &&
                        (u.is_active == 1)
                    );

                    doctors.forEach(doc => {
                        const opt = document.createElement('option');
                        opt.value = doc.id;
                        opt.textContent = doc.name || doc.username;
                        doctorSelect.appendChild(opt);
                    });
                }
            } catch (e) {
                console.error("Doktor listesi yüklenemedi", e);
            }
        }

        this.modal.show();
    },

    addRow: function () {
        const tbody = document.getElementById('labItemsTable').getElementsByTagName('tbody')[0];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" class="form-control form-control-sm" name="test_name[]" placeholder="Örn: Glikoz" required></td>
            <td><input type="text" class="form-control form-control-sm" name="result_value[]" placeholder="Değer" required></td>
            <td><input type="text" class="form-control form-control-sm" name="unit[]" placeholder="mg/dL"></td>
            <td><input type="text" class="form-control form-control-sm" name="reference_range[]" placeholder="70-100"></td>
            <td class="text-center">
                <div class="form-check form-switch d-flex justify-content-center">
                    <input class="form-check-input" type="checkbox" name="is_abnormal_check[]">
                    <input type="hidden" name="is_abnormal[]" value="0">
                </div>
            </td>
            <td>
                <button type="button" class="btn btn-sm btn-link text-danger p-0" onclick="LabEntry.removeRow(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;

        // Handle checkbox value change
        const checkbox = row.querySelector('input[type="checkbox"]');
        const hidden = row.querySelector('input[type="hidden"]');
        checkbox.addEventListener('change', (e) => {
            hidden.value = e.target.checked ? "1" : "0";
        });

        tbody.appendChild(row);
    },

    removeRow: function (btn) {
        const row = btn.closest('tr');
        const tbody = row.parentElement;
        if (tbody.children.length > 1) {
            row.remove();
        } else {
            // Clear inputs if it's the last row
            row.querySelectorAll('input').forEach(i => {
                if (i.type === 'checkbox') i.checked = false;
                else if (i.type !== 'hidden') i.value = '';
                if (i.type === 'hidden' && i.name === 'is_abnormal[]') i.value = '0';
            });
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

        // Collect items
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
            Swal.fire({
                title: 'Kaydediliyor...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            await api.post('/api/lab', payload);

            Swal.fire({
                icon: 'success',
                title: 'Başarılı',
                text: 'Laboratuvar sonucu başarıyla kaydedildi.',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                window.location.reload();
            });

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
                Swal.fire('Silindi!', 'Laboratuvar sonucu silindi.', 'success').then(() => {
                    window.location.reload();
                });
            } catch (error) {
                console.error(error);
                Swal.fire('Hata', 'Silme işlemi başarısız.', 'error');
            }
        }
    }
};
