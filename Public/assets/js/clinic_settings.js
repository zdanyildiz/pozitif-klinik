document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('settingsForm');
    const saveBtn = document.getElementById('saveBtn');
    const workingHoursContainer = document.getElementById('workingHoursContainer');

    // Gün Tanımları
    const days = ['pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar'];
    const dayLabels = {
        'pazartesi': 'Pazartesi',
        'sali': 'Salı',
        'carsamba': 'Çarşamba',
        'persembe': 'Perşembe',
        'cuma': 'Cuma',
        'cumartesi': 'Cumartesi',
        'pazar': 'Pazar'
    };

    // 1. İlleri Yükle
    async function loadProvinces() {
        try {
            const response = await axios.get('/api/general/provinces');
            if (response.data.status) {
                const select = document.getElementById('provinceId');
                response.data.data.forEach(p => {
                    const option = document.createElement('option');
                    option.value = p.id;
                    option.textContent = p.name;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('İller yüklenemedi', error);
        }
    }

    // 2. İlçeleri Yükle
    async function loadDistricts(provinceId, selectedDistrictId = null) {
        const select = document.getElementById('districtId');
        select.innerHTML = '<option value="">Seçiniz...</option>';
        select.disabled = true;

        if (!provinceId) return;

        try {
            const response = await axios.get(`/api/general/districts?province_id=${provinceId}`);
            if (response.data.status) {
                response.data.data.forEach(d => {
                    const option = document.createElement('option');
                    option.value = d.id;
                    option.textContent = d.name;
                    select.appendChild(option);
                });
                select.disabled = false;

                if (selectedDistrictId) {
                    select.value = selectedDistrictId;
                }
            }
        } catch (error) {
            console.error('İlçeler yüklenemedi', error);
        }
    }

    // 3. Mevcut Ayarları Yükle
    async function loadSettings() {
        try {
            const response = await axios.get('/api/clinic/settings');
            if (response.data.status) {
                const data = response.data.data;

                // Form alanlarını doldur
                document.getElementById('name').value = data.name || '';
                document.getElementById('description').value = data.description || '';
                document.getElementById('website').value = data.website || '';
                document.getElementById('phone').value = data.phone || '';
                document.getElementById('email').value = data.email || '';
                document.getElementById('address').value = data.address || '';
                document.getElementById('taxOffice').value = data.tax_office || '';
                document.getElementById('taxNumber').value = data.tax_number || '';

                // İl seçili ise ilçeleri yükle
                if (data.province_id) {
                    document.getElementById('provinceId').value = data.province_id;
                    await loadDistricts(data.province_id, data.district_id);
                }

                // Çalışma Saatlerini Oluştur
                renderWorkingHours(data.working_hours);
            }
        } catch (error) {
            console.error('Ayarlar yüklenemedi', error);
            Swal.fire('Hata', 'Ayarlar yüklenirken bir sorun oluştu.', 'error');
        }
    }

    // 4. Çalışma Saatlerini Render Et
    function renderWorkingHours(hoursData) {
        workingHoursContainer.innerHTML = '';

        days.forEach(day => {
            const dayData = hoursData && hoursData[day] ? hoursData[day] : { open: false, start: '09:00', end: '18:00' };
            const isOpen = dayData.open;

            const row = document.createElement('div');
            row.className = 'day-row';
            row.innerHTML = `
                <div class="day-label">${dayLabels[day]}</div>
                <div class="day-toggle">
                    <div class="form-check form-switch">
                        <input class="form-check-input day-switch" type="checkbox" id="check_${day}" ${isOpen ? 'checked' : ''}>
                        <label class="form-check-label" for="check_${day}">${isOpen ? 'Açık' : 'Kapalı'}</label>
                    </div>
                </div>
                <div class="day-times ${isOpen ? '' : 'd-none'}" id="times_${day}">
                    <input type="time" class="form-control form-control-sm" id="start_${day}" value="${dayData.start}">
                    <span>-</span>
                    <input type="time" class="form-control form-control-sm" id="end_${day}" value="${dayData.end}">
                </div>
            `;
            workingHoursContainer.appendChild(row);

            // Toggle Handler
            const checkbox = row.querySelector(`#check_${day}`);
            const timesDiv = row.querySelector(`#times_${day}`);
            const label = row.querySelector(`label[for="check_${day}"]`);

            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    timesDiv.classList.remove('d-none');
                    label.textContent = 'Açık';
                } else {
                    timesDiv.classList.add('d-none');
                    label.textContent = 'Kapalı';
                }
            });
        });
    }

    // 5. İl Değişikliği
    document.getElementById('provinceId').addEventListener('change', (e) => {
        loadDistricts(e.target.value);
    });

    // 6. Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Kaydediliyor...';

        try {
            // Çalışma saatlerini topla
            const workingHours = {};
            days.forEach(day => {
                const isOpen = document.getElementById(`check_${day}`).checked;
                workingHours[day] = {
                    open: isOpen,
                    start: document.getElementById(`start_${day}`).value,
                    end: document.getElementById(`end_${day}`).value
                };
            });

            const formData = {
                name: document.getElementById('name').value,
                description: document.getElementById('description').value,
                website: document.getElementById('website').value,
                phone: document.getElementById('phone').value,
                email: document.getElementById('email').value,
                address: document.getElementById('address').value,
                province_id: document.getElementById('provinceId').value || null,
                district_id: document.getElementById('districtId').value || null,
                tax_office: document.getElementById('taxOffice').value,
                tax_number: document.getElementById('taxNumber').value,
                working_hours: workingHours
            };

            const response = await axios.put('/api/clinic/settings', formData);

            if (response.data.status) {
                Swal.fire({
                    icon: 'success',
                    title: 'Başarılı',
                    text: 'Klinik ayarları güncellendi.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        } catch (error) {
            console.error('Kaydetme hatası', error);
            const msg = error.response?.data?.message || 'Bir hata oluştu.';
            Swal.fire('Hata', msg, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Ayarları Kaydet';
        }
    });

    // Başlangıç
    await loadProvinces();
    await loadSettings();
});
