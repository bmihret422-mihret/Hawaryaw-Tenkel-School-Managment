/**
 * Subjects & Courses Module
 */
const Subjects = {
  currentSubjects: [],

  async load() {
    await this.fetchSubjects();
  },

  async fetchSubjects() {
    try {
      const data = await API.get('/subjects');
      this.currentSubjects = data.data || [];
      this.renderTable(this.currentSubjects);
    } catch (err) {
      UI.showToast('Failed to load courses: ' + err.message, 'error');
    }
  },

  renderTable(subjects) {
    const tbody = document.getElementById('subjects-table-body');
    if (!tbody) return;

    if (!subjects || subjects.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No subjects registered yet.</td></tr>`;
      return;
    }

    const isAdmin = Auth.currentUser?.role === 'ADMIN';

    tbody.innerHTML = subjects.map(s => `
      <tr>
        <td><code>${s.SUBJECT_CODE}</code></td>
        <td><strong>${s.SUBJECT_NAME}</strong></td>
        <td><span class="badge badge-neutral">${s.CREDITS} Credits</span></td>
        <td><span style="font-size:0.85rem; color:var(--text-muted);">${s.DESCRIPTION || 'Core curriculum course'}</span></td>
        <td><strong>${s.CLASSES_COUNT || 0}</strong> Sections</td>
        <td class="text-right">
          ${isAdmin ? `
            <button class="btn btn-sm btn-outline" title="Delete Course" onclick="Subjects.deleteSubject(${s.SUBJECT_ID})">
              <i class="fa-solid fa-trash text-danger"></i>
            </button>
          ` : '—'}
        </td>
      </tr>
    `).join('');
  },

  openAddModal() {
    document.getElementById('form-subject').reset();
    UI.openModal('modal-add-subject');
  },

  async handleSubmit() {
    const subjectCode = document.getElementById('sub-code').value.trim();
    const subjectName = document.getElementById('sub-name').value.trim();
    const credits = document.getElementById('sub-credits').value;
    const description = document.getElementById('sub-desc').value.trim();

    try {
      await API.post('/subjects', {
        subjectCode,
        subjectName,
        credits,
        description
      });

      UI.showToast('Subject created successfully!', 'success');
      UI.closeModal('modal-add-subject');
      this.fetchSubjects();
    } catch (err) {
      UI.showToast('Failed to create subject: ' + err.message, 'error');
    }
  },

  async deleteSubject(subjectId) {
    if (!confirm('Are you sure you want to remove this course from curriculum?')) return;
    try {
      await API.delete(`/subjects/${subjectId}`);
      UI.showToast('Course removed successfully.', 'success');
      this.fetchSubjects();
    } catch (err) {
      UI.showToast('Failed to delete course: ' + err.message, 'error');
    }
  }
};
