/**
 * Pozitif Klinik - Paymnet Shared Logic
 * Handles the payment modal and split payment calculations
 */

const PaymentModule = {
    modal: null,
    form: null,
    rowsContainer: null,
    config: {
        types: {
            'cash': 'Nakit',
            'credit_card': 'Kredi Kartı',
            'bank_transfer': 'Havale/EFT',
            'other': 'Diğer'
        }
    },

    init() {
        this.modal = new bootstrap.Modal(document.getElementById('paymentModal'));
        this.form = document.getElementById('paymentForm');
        this.rowsContainer = document.getElementById('paymentRowsContainer');

        document.getElementById('btnAddPaymentRow').addEventListener('click', () => this.addPaymentRow());
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Discount listeners
        const btnApply = document.getElementById('btnApplyDiscount');
        if (btnApply) btnApply.addEventListener('click', () => this.handleApplyDiscount());

        // Event delegation for deleting rows
        this.rowsContainer.addEventListener('click', (e) => {
            if (e.target.closest('.btn-remove-row')) {
                const row = e.target.closest('.payment-row');
                if (this.rowsContainer.querySelectorAll('.payment-row').length > 1) {
                    row.remove();
                }
            }
        });

        // Global exposing for onclick
        window.toggleDiscountArea = () => {
            const area = document.getElementById('paymentDiscountArea');
            if (area) area.classList.toggle('d-none');
        };
    },

    /**
     * Opens the payment modal for an appointment or patient
     * @param {Object} data { patient_id, appointment_id, total_debt, remaining_debt }
     */
    open(data) {
        document.getElementById('paymentPatientId').value = data.patient_id;
        document.getElementById('paymentAppointmentId').value = data.appointment_id || '';
        document.getElementById('paymentNotes').value = '';

        // Show summary if debt info provided
        const summary = document.getElementById('paymentSummaryAlert');
        if (data.total_debt !== undefined) {
            document.getElementById('summaryTotalDebt').textContent = this.formatCurrency(data.total_debt);
            document.getElementById('summaryRemainingDebt').textContent = this.formatCurrency(data.remaining_debt);
            summary.classList.remove('d-none');
        } else {
            summary.classList.add('d-none');
        }

        // Populate discount fields if data exists
        const generalDiscount = parseFloat(data.general_discount_amount || 0);
        document.getElementById('paymentGeneralDiscount').value = generalDiscount > 0 ? generalDiscount.toFixed(2) : '';
        document.getElementById('paymentDiscountNote').value = data.general_discount_note || '';

        // Buton yazısını güncelle (Uygula vs Düzenle)
        const btnToggle = document.getElementById('btnToggleDiscount');
        if (btnToggle) {
            btnToggle.innerHTML = generalDiscount > 0
                ? '<i class="bi bi-pencil-square me-1"></i> İndirimi Düzenle'
                : '<i class="bi bi-percent me-1"></i> İndirim Uygula';
        }

        // Her zaman kapalı başlat
        const discountArea = document.getElementById('paymentDiscountArea');
        if (discountArea) discountArea.classList.add('d-none');

        // Pass extra data to renderItems for general discount display
        this.renderItems(data.items || [], data.general_discount_amount, data.general_discount_note);

        // Reset rows
        this.rowsContainer.innerHTML = '';
        this.addPaymentRow(data.remaining_debt || 0);

        this.modal.show();
    },

    async refresh(appointmentId) {
        if (!appointmentId) return;
        try {
            const res = await api.get(`/api/appointments/${appointmentId}`);
            if (res.data) {
                this.open(res.data);
            }
        } catch (e) {
            console.error('Refresh error', e);
        }
    },

    renderItems(items, generalDiscountAmount = 0, generalDiscountNote = '') {
        const container = document.getElementById('paymentItemsContainer');
        if (!container) return; // If container doesn't exist in DOM yet

        container.innerHTML = '';
        if ((!items || items.length === 0) && generalDiscountAmount <= 0) {
            container.innerHTML = '<div class="text-muted text-center py-3">Hizmet bulunamadı.</div>';
            return;
        }

        container.classList.remove('d-none');
        const appointmentId = document.getElementById('paymentAppointmentId').value;

        let html = '<div class="table-responsive"><table class="table table-hover table-sm align-middle mb-0">';
        html += '<thead class="table-light"><tr><th>Hizmet</th><th class="text-center">Adet</th><th class="text-end">Birim</th><th class="text-center">İndirim</th><th class="text-end">Tutar</th></tr></thead><tbody>';

        items.forEach(item => {
            const unitPrice = parseFloat(item.unit_price);
            const quantity = parseInt(item.quantity) || 1;
            const discount = parseFloat(item.discount_amount || 0);
            const total = (unitPrice * quantity) - discount;

            html += `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${item.item_name}</div>
                    </td>
                    <td class="text-center">${quantity}</td>
                    <td class="text-end text-muted small">${this.formatCurrency(unitPrice)}</td>
                    <td class="text-center">
                        <button type="button" class="btn btn-sm ${discount > 0 ? 'btn-warning text-dark' : 'btn-outline-secondary'} py-0 px-2" 
                                onclick="PaymentModule.handleItemDiscount('${item.id}', ${discount}, '${appointmentId}')"
                                title="İndirim Düzenle">
                            <i class="bi bi-tag-fill me-1"></i>${discount > 0 ? this.formatCurrency(discount) : 'Ekle'}
                        </button>
                    </td>
                    <td class="text-end fw-bold text-primary">${this.formatCurrency(total)}</td>
                </tr>
            `;
        });

        // Genel İndirim Satırı
        if (generalDiscountAmount > 0) {
            html += `
                <tr class="bg-warning-subtle text-danger">
                    <td colspan="4">
                        <div class="fw-bold"><i class="bi bi-percent"></i> Genel İndirim</div>
                        ${generalDiscountNote ? `<small class="text-muted fst-italic ms-2">${generalDiscountNote}</small>` : ''}
                    </td>
                    <td class="text-end fw-bold">-${this.formatCurrency(generalDiscountAmount)}</td>
                </tr>
            `;
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    async handleItemDiscount(itemId, currentDiscount, appointmentId) {
        if (!appointmentId) {
            if (typeof Toast !== 'undefined') Toast.error('Randevu bilgisi eksik!');
            return;
        }

        // Swal ile input al
        const { value: discount } = await Swal.fire({
            target: document.getElementById('paymentModal'),
            title: 'Kalem İndirimi',
            input: 'number',
            inputLabel: 'İndirim Tutarı (₺)',
            inputValue: currentDiscount || '',
            showCancelButton: true,
            confirmButtonText: 'Kaydet',
            cancelButtonText: 'İptal',
            customClass: {
                container: 'position-absolute' // Make sure it stays on top of modal
            },
            inputValidator: (value) => {
                if (value < 0) return 'Negatif indirim giremezsiniz!';
            }
        });

        if (discount !== undefined && discount !== null) {
            try {
                // Item datasını çekmemiz lazım çünkü API full object istiyor olabilir.
                // Burada güvenli yol olarak önce item'ı bulup sonra update ediyoruz.

                const res = await api.get(`/api/appointments/${appointmentId}`);
                const app = res.data;
                const item = app.items.find(i => i.id == itemId);

                if (!item) throw new Error('Hizmet bulunamadı.');

                await api.put(`/api/appointments/${appointmentId}/items/${itemId}`, {
                    item_name: item.item_name,
                    unit_price: item.unit_price,
                    quantity: item.quantity,
                    description: item.description,
                    discount_amount: parseFloat(discount)
                });

                // Refresh modal
                await this.refresh(appointmentId);

                // Notify main page
                window.dispatchEvent(new CustomEvent('payment-saved', { detail: { appointmentId } }));

                if (typeof Toast !== 'undefined') Toast.success('İndirim güncellendi.');

            } catch (e) {
                console.error(e);
                if (typeof Toast !== 'undefined') Toast.error('İndirim güncellenemedi.');
            }
        }
    },

    addPaymentRow(amount = 0) {
        const index = this.rowsContainer.querySelectorAll('.payment-row').length;
        const row = document.createElement('div');
        row.className = 'payment-row mb-2';
        row.innerHTML = `
            <div class="input-group">
                <select class="form-select w-40" name="payments[${index}][payment_type]" required>
                    ${Object.entries(this.config.types).map(([val, label]) => `<option value="${val}">${label}</option>`).join('')}
                </select>
                <input type="number" class="form-select w-40" name="payments[${index}][amount]" 
                       step="0.01" min="0.01" value="${amount > 0 ? amount.toFixed(2) : ''}" required placeholder="Tutar">
                <button type="button" class="btn btn-outline-danger btn-remove-row">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        this.rowsContainer.appendChild(row);
    },

    formatCurrency(val) {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
    },

    async handleSubmit(e) {
        e.preventDefault();
        const btn = document.getElementById('btnSavePayment');
        const originalHtml = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Kaydediliyor...';

            const formData = new FormData(this.form);
            const patientId = formData.get('patient_id');
            const appointmentId = formData.get('appointment_id');
            const notes = formData.get('notes');

            // Parse payments array
            const payments = [];
            const rows = this.rowsContainer.querySelectorAll('.payment-row');
            rows.forEach((row, i) => {
                const type = row.querySelector(`select`).value;
                const amount = row.querySelector(`input`).value;
                if (amount > 0) {
                    payments.push({
                        patient_id: patientId,
                        appointment_id: appointmentId || null,
                        payment_type: type,
                        amount: amount,
                        notes: notes,
                        payment_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
                    });
                }
            });

            if (payments.length === 0) {
                throw new Error('Lütfen en az bir geçerli tutar girin.');
            }

            const response = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payments })
            });

            const result = await response.json();

            if (result.success) {
                this.modal.hide();
                // Trigger global event for pages to refresh
                window.dispatchEvent(new CustomEvent('payment-saved', { detail: { appointmentId } }));

                if (typeof Toast !== 'undefined') {
                    Toast.success('Tahsilat başarıyla kaydedildi.');
                } else {
                    alert('Tahsilat başarıyla kaydedildi.');
                }
            } else {
                throw new Error(result.message || 'Bir hata oluştu.');
            }

        } catch (error) {
            alert(error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    },

    async handleApplyDiscount() {
        const appointmentId = document.getElementById('paymentAppointmentId').value;
        if (!appointmentId) {
            alert('Randevu ID bulunamadı, indirim uygulanamaz.');
            return;
        }

        const amount = parseFloat(document.getElementById('paymentGeneralDiscount').value) || 0;
        const note = document.getElementById('paymentDiscountNote').value || '';
        const btn = document.getElementById('btnApplyDiscount');

        try {
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Uygulanıyor...';

            await api.put(`/api/appointments/${appointmentId}/discount`, {
                amount: amount,
                note: note
            });

            // Refresh modal data
            await this.refresh(appointmentId);

            // Notify other components if needed
            window.dispatchEvent(new CustomEvent('payment-saved', { detail: { appointmentId } }));

            // Hide discount area after success
            document.getElementById('paymentDiscountArea').classList.add('d-none');

            if (typeof Toast !== 'undefined') {
                Toast.success('İndirim uygulandı.');
            }

        } catch (e) {
            console.error(e);
            alert('İndirim uygulanamadı: ' + (e.message || 'Bilinmeyen hata'));
        } finally {
            btn.disabled = false;
            btn.textContent = 'Uygula';
        }
    },

    async removeGeneralDiscount() {
        if (!confirm('Genel indirimi kaldırmak istediğinize emin misiniz?')) return;

        document.getElementById('paymentGeneralDiscount').value = 0;
        document.getElementById('paymentDiscountNote').value = '';
        await this.handleApplyDiscount();
    }
};

// Initialize if the element exists
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('paymentModal')) {
        PaymentModule.init();
    }
});

// Make it globally available
window.PaymentModule = PaymentModule;
