/**
 * Faculty & Teachers Module
 */
const Teachers = {
  currentTeachers: [],

  async load() {
    await this.fetchTeachers();
  },

  async fetchTeachers() {
    try {
      const data = await API.get('/teachers');
      this.currentTeachers = data.data || [];
      this.renderTable(this.currentTeachers);
    } catch (err) {
      UI.showToast('Failed to load faculty: ' + err.message, 'error');
    }
  },

  renderTable(teachers) {
    const tbody = document.getElementById('teachers-table-body');
    if (!tbody) return;

    if (!teachers || teachers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No faculty members found.</td></tr>`;
      return;
    }

    const isAdmin = Auth.currentUser?.role === 'ADMIN';

    tbody.innerHTML = teachers.map(t => {
      const assignmentBadges = (t.assignments || []).map(a => `
        <span class="badge badge-info" style="margin:2px;" title="${a.SCHEDULE_TIME || ''}">${a.CLASS_NAME} ${a.SECTION}: ${a.SUBJECT_NAME}</span>
      `).join('') || '<span class="text-muted">None assigned</span>';

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <div style="width:36px; height:36px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.85rem;">
                ${(t.FULL_NAME || 'T').substring(0, 2).toUpperCase()}
              </div>
              <div>
                <strong>${t.FULL_NAME}</strong>
                <div style="font-size:0.75rem; color:var(--text-muted);">${t.EMAIL || 'No email registered'} | ${t.PHONE || ''}</div>
              </div>
            </div>
          </td>
          <td><code>${t.EMPLOYEE_CODE}</code></td>
          <td><strong>${t.SPECIALIZATION || 'General'}</strong></td>
          <td>${t.QUALIFICATION || '—'}</td>
          <td><div style="max-width:320px; display:flex; flex-wrap:wrap;">${assignmentBadges}</div></td>
          <td>${UI.renderStatusBadge(t.TEACHER_STATUS)}</td>
          <td class="text-right">
            ${isAdmin ? `
              <button class="btn btn-sm btn-outline" title="Delete Faculty" onclick="Teachers.deleteTeacher(${t.TEACHER_ID})">
                <i class="fa-solid fa-trash text-danger"></i>
              </button>
            ` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  },

  handleSearch() {
    const query = document.getElementById('teacher-search-input')?.value.toLowerCase().trim();
    if (!query) {
      this.renderTable(this.currentTeachers);
      return;
    }
    const filtered = this.currentTeachers.filter(t => 
      t.FULL_NAME?.toLowerCase().includes(query) ||
      t.EMPLOYEE_CODE?.toLowerCase().includes(query) ||
      t.SPECIALIZATION?.toLowerCase().includes(query)
    );
    this.renderTable(filtered);
  },

  openAddModal() {
    document.getElementById('form-teacher').reset();
    document.getElementById('teacher-edit-id').value = '';
    UI.openModal('modal-add-teacher');
  },

  async handleSubmit() {
    const fullName = document.getElementById('tch-fullname').value.trim();
    const employeeCode = document.getElementById('tch-empcode').value.trim();
    const qualification = document.getElementById('tch-qual').value.trim();
    const specialization = document.getElementById('tch-spec').value.trim();
    const email = document.getElementById('tch-email').value.trim();
    const phone = document.getElementById('tch-phone').value.trim();
    const salary = document.getElementById('tch-sal').value;

    try {
      await API.post('/teachers', {
        fullName,
        employeeCode,
        qualification,
        specialization,
        email,
        phone,
        salary
      });

      UI.showToast('Faculty member registered successfully!', 'success');
      UI.closeModal('modal-add-teacher');
      this.fetchTeachers();
    } catch (err) {
      UI.showToast('Failed to add faculty: ' + err.message, 'error');
    }
  },

  async deleteTeacher(teacherId) {
    if (!confirm('Are you sure you want to remove this faculty member?')) return;
    try {
      await API.delete(`/teachers/${teacherId}`);
      UI.showToast('Faculty member deleted successfully.', 'success');
      this.fetchTeachers();
    } catch (err) {
      UI.showToast('Failed to delete teacher: ' + err.message, 'error');
    }
  }
};
