/**
 * Classes & Sections Module
 */
const Classes = {
  currentClasses: [],

  async load() {
    await this.fetchClasses();
  },

  async fetchClasses() {
    try {
      const data = await API.get('/classes');
      this.currentClasses = data.data || [];
      this.renderGrid(this.currentClasses);
    } catch (err) {
      UI.showToast('Failed to load classes: ' + err.message, 'error');
    }
  },

  renderGrid(classes) {
    const grid = document.getElementById('classes-cards-grid');
    if (!grid) return;

    if (!classes || classes.length === 0) {
      grid.innerHTML = `<p class="text-muted text-center col-span-2 py-4">No classes registered yet.</p>`;
      return;
    }

    const isAdmin = Auth.currentUser?.role === 'ADMIN';

    grid.innerHTML = classes.map(c => `
      <div class="class-card">
        <div>
          <div class="class-card-header">
            <div class="class-badge">${c.SECTION}</div>
            <div class="class-card-title">
              <h3>${c.CLASS_NAME}</h3>
              <p>Section ${c.SECTION} | Room: ${c.ROOM_NUMBER || 'Main'}</p>
            </div>
          </div>

          <div class="class-card-stats">
            <div class="class-stat-item">
              <span>Enrolled</span>
              <strong>${c.STUDENT_COUNT} Students</strong>
            </div>
            <div class="class-stat-item">
              <span>Max Capacity</span>
              <strong>${c.CAPACITY} Seats</strong>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:0.5rem; margin-top:1rem;">
          <button class="btn btn-sm btn-outline btn-block" onclick="Classes.viewClassDetails(${c.CLASS_ID})">
            <i class="fa-solid fa-list-check"></i> Roster & Subjects
          </button>
          ${isAdmin ? `
            <button class="btn btn-sm btn-primary" title="Assign Course" onclick="Classes.openAssignSubjectModal(${c.CLASS_ID})">
              <i class="fa-solid fa-plus"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  },

  openAddModal() {
    document.getElementById('form-class').reset();
    UI.openModal('modal-add-class');
  },

  async handleSubmit() {
    const className = document.getElementById('cls-name').value.trim();
    const gradeLevel = document.getElementById('cls-level').value.trim();
    const section = document.getElementById('cls-sec').value.trim();
    const roomNumber = document.getElementById('cls-room').value.trim();
    const capacity = document.getElementById('cls-cap').value;

    try {
      await API.post('/classes', {
        className,
        gradeLevel,
        section,
        roomNumber,
        capacity
      });

      UI.showToast('Class created successfully!', 'success');
      UI.closeModal('modal-add-class');
      this.fetchClasses();
    } catch (err) {
      UI.showToast('Failed to create class: ' + err.message, 'error');
    }
  },

  async viewClassDetails(classId) {
    try {
      const data = await API.get(`/classes/${classId}`);
      if (!data.success) return;

      const c = data.classInfo;
      const students = data.students || [];
      const subjects = data.subjects || [];

      let studList = students.map(s => `
        <li><strong>${s.ROLL_NUMBER || '—'}</strong>: ${s.FULL_NAME} (Adm: ${s.ADMISSION_NUMBER})</li>
      `).join('') || '<p class="text-muted">No students enrolled yet.</p>';

      let subList = subjects.map(s => `
        <li><strong>${s.SUBJECT_NAME}</strong> - Instructor: ${s.TEACHER_NAME || 'None'} <small>(${s.SCHEDULE_TIME || 'Standard'})</small></li>
      `).join('') || '<p class="text-muted">No subjects mapped yet.</p>';

      alert(`Class: ${c.CLASS_NAME} Section ${c.SECTION}\nRoom: ${c.ROOM_NUMBER || 'TBA'}\n\nEnrolled Students (${students.length}):\n${students.map(s => s.FULL_NAME).join(', ') || 'None'}`);
    } catch (err) {
      UI.showToast('Failed to load class details: ' + err.message, 'error');
    }
  },

  async openAssignSubjectModal(classId) {
    document.getElementById('assign-class-id').value = classId;

    try {
      // Load subjects & teachers options
      const [subjectsRes, teachersRes] = await Promise.all([
        API.get('/subjects'),
        API.get('/teachers')
      ]);

      const subSelect = document.getElementById('assign-sub-select');
      const tchSelect = document.getElementById('assign-teacher-select');

      subSelect.innerHTML = (subjectsRes.data || []).map(s => `
        <option value="${s.SUBJECT_ID}">${s.SUBJECT_NAME} (${s.SUBJECT_CODE})</option>
      `).join('');

      tchSelect.innerHTML = '<option value="">-- No Teacher Assigned --</option>' + (teachersRes.data || []).map(t => `
        <option value="${t.TEACHER_ID}">${t.FULL_NAME} (${t.SPECIALIZATION || 'General'})</option>
      `).join('');

      UI.openModal('modal-assign-subject');
    } catch (err) {
      UI.showToast('Failed to open assign dialog: ' + err.message, 'error');
    }
  },

  async handleAssignSubmit() {
    const classId = document.getElementById('assign-class-id').value;
    const subjectId = document.getElementById('assign-sub-select').value;
    const teacherId = document.getElementById('assign-teacher-select').value;
    const scheduleTime = document.getElementById('assign-time').value.trim();

    try {
      await API.post(`/classes/${classId}/subjects`, {
        subjectId,
        teacherId,
        scheduleTime
      });

      UI.showToast('Subject mapped to class successfully!', 'success');
      UI.closeModal('modal-assign-subject');
      this.fetchClasses();
    } catch (err) {
      UI.showToast('Assignment failed: ' + err.message, 'error');
    }
  }
};
