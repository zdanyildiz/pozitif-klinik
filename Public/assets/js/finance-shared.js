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

        // Eğer indirim varsa alanı açık göster
        const discountArea = document.getElementById('paymentDiscountArea');
        if (generalDiscount > 0 && discountArea) {
            discountArea.classList.remove('d-none');
        } else if (discountArea) {
            discountArea.classList.add('d-none');
        }

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
            container.classList.add('d-none');
            return;
        }

        container.classList.remove('d-none');
        let html = '<div class="list-group list-group-flush mb-3 small">';

        items.forEach(item => {
            const unitPrice = parseFloat(item.unit_price);
            const quantity = parseInt(item.quantity) || 1;
            const discount = parseFloat(item.discount_amount || 0);
            const total = (unitPrice * quantity) - discount;

            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center bg-transparent px-0 py-2">
                    <div>
                        <div class="fw-bold text-dark">${item.item_name}</div>
                        ${quantity > 1 ? `<span class="text-muted me-2">${quantity} x ${this.formatCurrency(unitPrice)}</span>` : ''}
                        ${discount > 0 ? `<span class="badge bg-danger-subtle text-danger">-${this.formatCurrency(discount)} İndirim</span>` : ''}
                    </div>
                    <span class="fw-bold">${this.formatCurrency(total)}</span>
                </div>
            `;
        });

        // Genel İndirim Satırı
        if (generalDiscountAmount > 0) {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center bg-warning-subtle px-2 py-2 rounded mt-1">
                    <div>
                        <div class="fw-bold text-dark"><i class="bi bi-percent"></i> Genel İndirim</div>
                        ${generalDiscountNote ? `<small class="text-muted fst-italic">Not: ${generalDiscountNote}</small>` : ''}
                    </div>
                    <span class="fw-bold text-danger">-${this.formatCurrency(generalDiscountAmount)}</span>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
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
    }
};

// Initialize if the element exists
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('paymentModal')) {
        PaymentModule.init();
    }
});
