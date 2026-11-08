/**
 * Fees & Billing Module
 */
const Fees = {
  currentFees: [],
  selectedFeeForPayment: null,

  async load() {
    await this.fetchFees();
    await this.populateDropdowns();
  },

  async populateDropdowns() {
    try {
      const [classesRes, studentsRes] = await Promise.all([
        API.get('/classes'),
        API.get('/students')
      ]);

      const classSelect = document.getElementById('fee-class-select');
      const studentSelect = document.getElementById('fee-student-select');

      if (classSelect) {
        classSelect.innerHTML = (classesRes.data || []).map(c => `
          <option value="${c.CLASS_ID}">${c.CLASS_NAME} - Section ${c.SECTION}</option>
        `).join('');
      }

      if (studentSelect) {
        studentSelect.innerHTML = (studentsRes.data || []).map(s => `
          <option value="${s.STUDENT_ID}">${s.FULL_NAME} (${s.ADMISSION_NUMBER})</option>
        `).join('');
      }
    } catch (err) {
      console.error('[Fees Dropdowns Error]:', err);
    }
  },

  async fetchFees() {
    const status = document.getElementById('fee-status-filter')?.value;

    try {
      const data = await API.get('/fees', { status });
      this.currentFees = data.data || [];
      this.renderTable(this.currentFees);
    } catch (err) {
      UI.showToast('Failed to load fee invoices: ' + err.message, 'error');
    }
  },

  renderTable(fees) {
    const tbody = document.getElementById('fees-table-body');
    if (!tbody) return;

    if (!fees || fees.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4">No fee invoices found.</td></tr>`;
      return;
    }

    const isAdmin = Auth.currentUser?.role === 'ADMIN';

    tbody.innerHTML = fees.map(f => {
      const remaining = f.AMOUNT - (f.PAID_AMOUNT || 0);

      return `
        <tr>
          <td><code>#INV-${String(f.FEE_ID).padStart(4, '0')}</code></td>
          <td><strong>${f.STUDENT_NAME}</strong></td>
          <td>${f.CLASS_NAME ? `${f.CLASS_NAME} - ${f.SECTION}` : '—'}</td>
          <td>${f.TITLE}</td>
          <td><span class="badge badge-neutral">${f.FEE_TYPE}</span></td>
          <td><strong>${UI.formatCurrency(f.AMOUNT)}</strong></td>
          <td class="text-success">${UI.formatCurrency(f.PAID_AMOUNT)}</td>
          <td>${UI.formatDate(f.DUE_DATE)}</td>
          <td>${UI.renderStatusBadge(f.STATUS)}</td>
          <td class="text-right">
            <div style="display:inline-flex; gap:0.4rem;">
              ${f.STATUS !== 'PAID' && isAdmin ? `
                <button class="btn btn-sm btn-primary" title="Record Payment" onclick="Fees.openPayModal(${f.FEE_ID})">
                  <i class="fa-solid fa-money-bill-wave"></i> Pay
                </button>
              ` : ''}
              ${f.PAID_AMOUNT > 0 ? `
                <button class="btn btn-sm btn-outline" title="Print Receipt" onclick="Fees.openReceiptModal(${f.FEE_ID})">
                  <i class="fa-solid fa-receipt"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  handleFilter() {
    this.fetchFees();
  },

  openAddModal() {
    document.getElementById('form-fee').reset();
    this.toggleTargetSelection();
    UI.openModal('modal-add-fee');
  },

  toggleTargetSelection() {
    const type = document.getElementById('fee-target-type')?.value;
    const classGroup = document.getElementById('fee-group-class');
    const studentGroup = document.getElementById('fee-group-student');

    if (type === 'class') {
      classGroup.classList.remove('hidden');
      studentGroup.classList.add('hidden');
    } else {
      classGroup.classList.add('hidden');
      studentGroup.classList.remove('hidden');
    }
  },

  async handleSubmit() {
    const targetType = document.getElementById('fee-target-type').value;
    const classId = targetType === 'class' ? document.getElementById('fee-class-select').value : null;
    const studentId = targetType === 'student' ? document.getElementById('fee-student-select').value : null;

    const title = document.getElementById('fee-title').value.trim();
    const feeType = document.getElementById('fee-type').value;
    const amount = document.getElementById('fee-amount').value;
    const dueDate = document.getElementById('fee-due-date').value;

    try {
      await API.post('/fees', {
        classId,
        studentId,
        title,
        feeType,
        amount,
        dueDate
      });

      UI.showToast('Fee invoice created successfully!', 'success');
      UI.closeModal('modal-add-fee');
      this.fetchFees();
    } catch (err) {
      UI.showToast('Failed to create fee: ' + err.message, 'error');
    }
  },

  openPayModal(feeId) {
    const fee = this.currentFees.find(f => f.FEE_ID === feeId);
    if (!fee) return;

    this.selectedFeeForPayment = fee;
    const remaining = fee.AMOUNT - (fee.PAID_AMOUNT || 0);

    document.getElementById('pay-fee-id').value = fee.FEE_ID;
    document.getElementById('pay-total-due').textContent = UI.formatCurrency(fee.AMOUNT);
    document.getElementById('pay-already-paid').textContent = UI.formatCurrency(fee.PAID_AMOUNT);
    document.getElementById('pay-remaining').textContent = UI.formatCurrency(remaining);
    document.getElementById('pay-amount-input').value = remaining;
    document.getElementById('pay-amount-input').max = remaining;

    UI.openModal('modal-pay-fee');
  },

  async handlePaymentSubmit() {
    const feeId = document.getElementById('pay-fee-id').value;
    const paymentAmount = document.getElementById('pay-amount-input').value;
    const paymentMethod = document.getElementById('pay-method-select').value;
    const transactionRef = document.getElementById('pay-ref-input').value.trim();

    try {
      const res = await API.put(`/fees/${feeId}/pay`, {
        paymentAmount,
        paymentMethod,
        transactionRef
      });

      UI.showToast(`Payment of ${UI.formatCurrency(paymentAmount)} recorded!`, 'success');
      UI.closeModal('modal-pay-fee');
      await this.fetchFees();
      this.openReceiptModal(feeId);
    } catch (err) {
      UI.showToast('Payment processing failed: ' + err.message, 'error');
    }
  },

  async openReceiptModal(feeId) {
    try {
      const data = await API.get(`/fees/receipt/${feeId}`);
      if (!data.success) return;

      const r = data.receipt;
      const printable = document.getElementById('receipt-printable-content');

      printable.innerHTML = `
        <div class="print-receipt-header">
          <div style="font-size:2.2rem; color:var(--primary); margin-bottom:0.5rem;"><i class="fa-solid fa-graduation-cap"></i></div>
          <h1>HAWARYAW TENKEL SCHOOL</h1>
          <p>Official Institutional Payment Receipt</p>
          <div style="margin-top:0.5rem; font-weight:700; color:#059669; font-size:1.1rem;">
            <i class="fa-solid fa-circle-check"></i> PAYMENT ACKNOWLEDGEMENT
          </div>
        </div>

        <div class="receipt-meta-grid">
          <div class="receipt-meta-box">
            <strong>Billed To Student:</strong><br>
            <h3>${r.STUDENT_NAME}</h3>
            <p>Admission #: <code>${r.ADMISSION_NUMBER}</code></p>
            <p>Class & Section: ${r.CLASS_NAME} - ${r.SECTION}</p>
          </div>
          <div class="receipt-meta-box">
            <strong>Receipt Details:</strong><br>
            <p>Invoice #: <strong>#INV-${String(r.FEE_ID).padStart(4, '0')}</strong></p>
            <p>Transaction Ref: <code>${r.TRANSACTION_REF || 'TXN-CASH'}</code></p>
            <p>Payment Date: ${UI.formatDate(r.PAYMENT_DATE)}</p>
            <p>Payment Mode: <strong>${r.PAYMENT_METHOD || 'CASH'}</strong></p>
          </div>
        </div>

        <table class="receipt-table">
          <thead>
            <tr>
              <th>Fee Description</th>
              <th>Category</th>
              <th style="text-align:right;">Billed Amount</th>
              <th style="text-align:right;">Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${r.TITLE}</strong></td>
              <td>${r.FEE_TYPE}</td>
              <td style="text-align:right;">${UI.formatCurrency(r.AMOUNT)}</td>
              <td style="text-align:right; font-weight:700; color:#059669;">${UI.formatCurrency(r.PAID_AMOUNT)}</td>
            </tr>
          </tbody>
        </table>

        <div class="receipt-total-box">
          <div>Payment Status: ${UI.renderStatusBadge(r.STATUS)}</div>
          <h3>Total Paid: ${UI.formatCurrency(r.PAID_AMOUNT)}</h3>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:4rem; padding-top:1rem; border-top:1px solid #cbd5e1;">
          <div>Accounts Cashier Signature: _______________________</div>
          <div>Official Seal & Stamp</div>
        </div>
      `;

      UI.openModal('modal-receipt');
    } catch (err) {
      UI.showToast('Could not load receipt: ' + err.message, 'error');
    }
  }
};
