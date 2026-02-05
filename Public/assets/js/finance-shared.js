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

        // Print listener
        const btnPrint = document.getElementById('btnSaveAndPrintReceipt');
        if (btnPrint) {
            btnPrint.addEventListener('click', (e) => this.handleSubmit(e, true));
        }

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

        // Handle inconsistent key names from different sources
        const totalAmount = data.total_debt !== undefined ? data.total_debt : (data.total_amount || 0);
        const remainingAmount = data.remaining_debt !== undefined ? data.remaining_debt : (data.remaining_amount || 0);

        // Show summary if debt info provided
        const summary = document.getElementById('paymentSummaryAlert');
        if (totalAmount !== undefined) {
            document.getElementById('summaryTotalDebt').textContent = this.formatCurrency(totalAmount);
            document.getElementById('summaryRemainingDebt').textContent = this.formatCurrency(remainingAmount);
            summary.classList.remove('d-none');
        } else {
            summary.classList.add('d-none');
        }

        // Populate discount fields if data exists
        const generalDiscount = parseFloat(data.general_discount_amount || 0);
        const discountInput = document.getElementById('paymentGeneralDiscount');
        const discountNoteInput = document.getElementById('paymentDiscountNote');

        if (discountInput) discountInput.value = generalDiscount > 0 ? generalDiscount.toFixed(2) : '';
        if (discountNoteInput) discountNoteInput.value = data.general_discount_note || '';

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
        window._currentPaymentData = data; // Store for access in sub-renders
        this.renderItems(data.items || [], data.general_discount_amount, data.general_discount_note);

        // Reset rows
        this.rowsContainer.innerHTML = '';
        this.addPaymentRow(remainingAmount > 0 ? remainingAmount : 0);

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
            // Even if no items, we must render payments (history)
            this.renderPayments(window._currentPaymentData?.payments || []);
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

        // Render Existing Payments (History)
        this.renderPayments(window._currentPaymentData?.payments || []);
    },

    renderPayments(payments) {
        const container = document.getElementById('paymentSavedRowsContainer');
        if (!container) return;

        container.innerHTML = '';
        if (!payments || payments.length === 0) return;

        payments.forEach(p => {
            const isCancelled = p.status === 'cancelled';

            const row = document.createElement('div');
            row.className = `payment-row mb-2 ${isCancelled ? 'opacity-50' : ''}`;

            // Yöntem Seçimi (Disabled)
            const typeOptions = Object.entries(this.config.types).map(([val, label]) =>
                `<option value="${val}" ${p.payment_type === val ? 'selected' : ''}>${label}</option>`
            ).join('');

            row.innerHTML = `
                <div class="input-group input-group-sm">
                     <span class="input-group-text bg-success-subtle border-success-subtle text-success">
                        <i class="bi bi-check-circle-fill"></i>
                     </span>
                    <select class="form-select w-40 bg-white" disabled>
                        ${typeOptions}
                    </select>
                    <input type="text" class="form-select w-40 bg-white fw-bold text-dark text-end" 
                           value="${parseFloat(p.amount).toFixed(2)} ₺" disabled>
                    ${!isCancelled ? `
                    <button type="button" class="btn btn-outline-danger" onclick="PaymentModule.deletePayment(${p.id})" title="Tahsilatı İptal Et">
                        <i class="bi bi-trash"></i>
                    </button>` :
                    `<button type="button" class="btn btn-secondary disabled" title="İptal Edildi">İptal</button>`
                }
                </div>
                ${!isCancelled ? `<div class="text-end text-muted fst-italic pe-1" style="font-size: 0.65rem;">${p.payment_date}</div>` : ''}
             `;
            container.appendChild(row);
        });
    },

    async deletePayment(id) {
        const res = await Swal.fire({
            title: 'Ödemeyi İptal Et?',
            text: 'Bu tahsilat kaydı silinecek ve bakiye güncellenecektir.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Evet, Sil',
            cancelButtonText: 'Vazgeç'
        });

        if (res.isConfirmed) {
            try {
                await api.delete(`/api/payments/${id}`);
                const appId = document.getElementById('paymentAppointmentId').value;
                await this.refresh(appId);
                window.dispatchEvent(new CustomEvent('payment-saved', { detail: { appointmentId: appId } }));
                if (typeof Utils !== 'undefined') Utils.showSuccess('Ödeme iptal edildi.');
            } catch (e) {
                console.error(e);
                if (typeof Utils !== 'undefined') Utils.showError('Ödeme iptal edilemedi.');
            }
        }
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

    async handleSubmit(e, shouldPrint = false) {
        if (e) e.preventDefault();
        const saveBtn = document.getElementById('btnSavePayment');
        const printBtn = document.getElementById('btnSaveAndPrintReceipt');
        const originalHtml = saveBtn.innerHTML;

        try {
            saveBtn.disabled = true;
            if (printBtn) printBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Kaydediliyor...';

            const formData = new FormData(this.form);
            const patientId = formData.get('patient_id');
            const appointmentId = formData.get('appointment_id');
            const notes = formData.get('notes');

            // Parse payments array
            const payments = [];
            const rows = this.rowsContainer.querySelectorAll('.payment-row');
            rows.forEach((row) => {
                const type = row.querySelector(`select`).value;
                const amount = row.querySelector(`input`).value;
                if (parseFloat(amount) > 0) {
                    payments.push({
                        patient_id: patientId,
                        appointment_id: appointmentId || null,
                        payment_type: type,
                        amount: parseFloat(amount),
                        notes: notes,
                        payment_date: new Date().toLocaleString('sv-SE').slice(0, 19).replace('T', ' ')
                    });
                }
            });

            if (payments.length === 0) {
                throw new Error('Lütfen en az bir geçerli tutar girin.');
            }

            // Overpayment Warning
            const totalPayment = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            const remaining = window._currentPaymentData?.remaining_debt || window._currentPaymentData?.remaining_amount || 0;

            if (totalPayment > remaining + 0.5) { // 0.5 kuruş tolerans
                const confirmRes = await Swal.fire({
                    title: 'Fazla Ödeme Uyarısı',
                    text: `Toplam ödeme (${this.formatCurrency(totalPayment)}), kalan borçtan (${this.formatCurrency(remaining)}) fazla. Devam etmek istiyor musunuz?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Evet, Kaydet',
                    cancelButtonText: 'Hayır, Düzelt'
                });

                if (!confirmRes.isConfirmed) {
                    saveBtn.disabled = false;
                    if (printBtn) printBtn.disabled = false;
                    saveBtn.innerHTML = originalHtml;
                    return;
                }
            }

            const response = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payments })
            });

            const result = await response.json();

            if (result.status) {
                // Determine print info before closing
                const printInfo = shouldPrint ? {
                    patient_name: document.getElementById('detailPatientName')?.textContent || 'Hasta',
                    payments: payments,
                    date: new Date().toLocaleDateString('tr-TR'),
                    clinic_name: 'Pozitif Klinik'
                } : null;

                this.modal.hide();
                // Trigger global event for pages to refresh
                window.dispatchEvent(new CustomEvent('payment-saved', { detail: { appointmentId } }));

                if (typeof Utils !== 'undefined') {
                    Utils.showSuccess(result.message || 'Tahsilat başarıyla kaydedildi.');
                } else if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Başarılı',
                        text: result.message || 'Tahsilat başarıyla kaydedildi.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }

                if (shouldPrint && printInfo) {
                    this.printReceipt(printInfo);
                }
            } else {
                throw new Error(result.message || 'Bir hata oluştu.');
            }

        } catch (error) {
            console.error('Submit Error:', error);
            if (typeof Utils !== 'undefined') {
                Utils.showError(error.message);
            } else if (typeof Swal !== 'undefined') {
                Swal.fire('Hata', error.message, 'error');
            }
        } finally {
            saveBtn.disabled = false;
            if (printBtn) printBtn.disabled = false;
            saveBtn.innerHTML = originalHtml;
        }
    },

    printReceipt(info) {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        const paymentsHtml = info.payments.map(p => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${this.config.types[p.payment_type] || p.payment_type}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${this.formatCurrency(p.amount)}</td>
            </tr>
        `).join('');

        const total = info.payments.reduce((sum, p) => sum + p.amount, 0);

        printWindow.document.write(`
            <html>
                <head>
                    <title>Tahsilat Makbuzu</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; color: #333; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                        .info { margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; }
                        .total { margin-top: 20px; text-align: right; font-size: 1.2em; font-weight: bold; }
                        .footer { margin-top: 50px; text-align: center; font-size: 0.8em; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${info.clinic_name}</h1>
                        <h3>TAHSİLAT MAKBUZU</h3>
                    </div>
                    <div class="info">
                        <p><strong>Hasta:</strong> ${info.patient_name}</p>
                        <p><strong>Tarih:</strong> ${info.date}</p>
                    </div>
                    <table>
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Ödeme Türü</th>
                                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Tutar</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paymentsHtml}
                        </tbody>
                    </table>
                    <div class="total">
                        Toplam: ${this.formatCurrency(total)}
                    </div>
                    <div class="footer">
                        Bu bir bilgi makbuzudur. Mali değeri yoktur.
                    </div>
                    <script>
                        window.onload = function() { window.print(); window.close(); };
                    </scrip` + `t>
                </body>
            </html>
        `);
        printWindow.document.close();
    },

    async handleApplyDiscount() {
        const appointmentId = document.getElementById('paymentAppointmentId').value;
        if (!appointmentId) {
            if (typeof Utils !== 'undefined') Utils.showError('Randevu ID bulunamadı, indirim uygulanamaz.');
            else if (typeof Swal !== 'undefined') Swal.fire('Hata', 'Randevu ID bulunamadı', 'error');
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
            const msg = 'İndirim uygulanamadı: ' + (e.message || 'Bilinmeyen hata');
            if (typeof Utils !== 'undefined') Utils.showError(msg);
            else if (typeof Swal !== 'undefined') Swal.fire('Hata', msg, 'error');
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
