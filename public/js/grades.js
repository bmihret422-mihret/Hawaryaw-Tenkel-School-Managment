/**
 * Examinations & Gradebook Module
 */
const Grades = {
  currentExams: [],

  async load() {
    await this.loadFilterDropdowns();
    await this.fetchExams();
    await this.loadMarksheet();
  },

  switchTab(tab) {
    document.getElementById('tab-grades-sheet').classList.toggle('active', tab === 'sheet');
    document.getElementById('tab-grades-exams').classList.toggle('active', tab === 'exams');

    document.getElementById('grades-tab-sheet').classList.toggle('hidden', tab !== 'sheet');
    document.getElementById('grades-tab-exams').classList.toggle('hidden', tab !== 'exams');
  },

  async loadFilterDropdowns() {
    try {
      const [examsRes, classesRes, subjectsRes] = await Promise.all([
        API.get('/grades/exams'),
        API.get('/classes'),
        API.get('/subjects')
      ]);

      const examSelect = document.getElementById('grade-exam-select');
      const classSelect = document.getElementById('grade-class-select');
      const subSelect = document.getElementById('grade-subject-select');

      if (examSelect) {
        examSelect.innerHTML = (examsRes.data || []).map(e => `
          <option value="${e.EXAM_ID}">${e.EXAM_NAME} (${e.EXAM_TYPE})</option>
        `).join('');
      }

      if (classSelect) {
        classSelect.innerHTML = (classesRes.data || []).map(c => `
          <option value="${c.CLASS_ID}">${c.CLASS_NAME} - Sec ${c.SECTION}</option>
        `).join('');
      }

      if (subSelect) {
        subSelect.innerHTML = (subjectsRes.data || []).map(s => `
          <option value="${s.SUBJECT_ID}">${s.SUBJECT_NAME} (${s.SUBJECT_CODE})</option>
        `).join('');
      }
    } catch (err) {
      console.error('[Grades Filter Dropdown Error]:', err);
    }
  },

  async fetchExams() {
    try {
      const data = await API.get('/grades/exams');
      this.currentExams = data.data || [];
      this.renderExamsTable(this.currentExams);
    } catch (err) {
      console.error('[Fetch Exams Error]:', err);
    }
  },

  renderExamsTable(exams) {
    const tbody = document.getElementById('exams-table-tbody');
    if (!tbody) return;

    if (!exams || exams.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No examination schedules created yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = exams.map(e => `
      <tr>
        <td><strong>${e.EXAM_NAME}</strong></td>
        <td><span class="badge badge-info">${e.EXAM_TYPE}</span></td>
        <td>${e.YEAR_NAME || 'Current Term'}</td>
        <td>${UI.formatDate(e.START_DATE)}</td>
        <td>${UI.formatDate(e.END_DATE)}</td>
        <td>${UI.renderStatusBadge(e.STATUS)}</td>
      </tr>
    `).join('');
  },

  async loadMarksheet() {
    const examId = document.getElementById('grade-exam-select')?.value;
    const classId = document.getElementById('grade-class-select')?.value;
    const subjectId = document.getElementById('grade-subject-select')?.value;

    if (!examId || !classId || !subjectId) return;

    try {
      const data = await API.get('/grades/sheet', { examId, classId, subjectId });
      this.renderMarksheet(data.data || []);
    } catch (err) {
      UI.showToast('Failed to load marksheet: ' + err.message, 'error');
    }
  },

  renderMarksheet(records) {
    const tbody = document.getElementById('grade-sheet-tbody');
    if (!tbody) return;

    if (!records || records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No enrolled students in this class.</td></tr>`;
      return;
    }

    tbody.innerHTML = records.map(r => `
      <tr data-student-id="${r.STUDENT_ID}">
        <td>${r.ROLL_NUMBER || '—'}</td>
        <td><strong>${r.FULL_NAME}</strong></td>
        <td>
          <input type="number" class="form-control grade-score-input" min="0" max="100" step="0.5" 
                 placeholder="0-100" value="${r.SCORE !== null && r.SCORE !== undefined ? r.SCORE : ''}"
                 oninput="Grades.updateLetterBadge(this)">
        </td>
        <td>
          <span class="badge badge-success grade-letter-badge">${r.GRADE_LETTER || '—'}</span>
        </td>
        <td>
          <input type="text" class="form-control grade-remarks-input" placeholder="Teacher remarks" value="${r.REMARKS || ''}">
        </td>
      </tr>
    `).join('');
  },

  updateLetterBadge(input) {
    const row = input.closest('tr');
    const badge = row.querySelector('.grade-letter-badge');
    const val = parseFloat(input.value);

    if (isNaN(val)) {
      badge.textContent = '—';
      return;
    }

    if (val >= 93) badge.textContent = 'A+';
    else if (val >= 85) badge.textContent = 'A';
    else if (val >= 80) badge.textContent = 'B+';
    else if (val >= 75) badge.textContent = 'B';
    else if (val >= 70) badge.textContent = 'C+';
    else if (val >= 60) badge.textContent = 'C';
    else if (val >= 50) badge.textContent = 'D';
    else badge.textContent = 'F';
  },

  async saveMarksheet() {
    const examId = document.getElementById('grade-exam-select')?.value;
    const subjectId = document.getElementById('grade-subject-select')?.value;

    if (!examId || !subjectId) {
      UI.showToast('Select exam and subject.', 'error');
      return;
    }

    const rows = document.querySelectorAll('#grade-sheet-tbody tr[data-student-id]');
    const records = [];

    rows.forEach(r => {
      const studentId = r.getAttribute('data-student-id');
      const scoreInput = r.querySelector('.grade-score-input');
      const remarksInput = r.querySelector('.grade-remarks-input');

      if (scoreInput.value !== '') {
        records.push({
          studentId,
          score: parseFloat(scoreInput.value),
          maxScore: 100,
          remarks: remarksInput.value.trim()
        });
      }
    });

    if (records.length === 0) {
      UI.showToast('Please enter scores before saving.', 'warning');
      return;
    }

    try {
      await API.post('/grades/bulk', {
        examId,
        subjectId,
        records
      });

      UI.showToast(`Saved grades for ${records.length} students to Oracle DB!`, 'success');
      this.loadMarksheet();
    } catch (err) {
      UI.showToast('Failed to save grades: ' + err.message, 'error');
    }
  },

  openAddExamModal() {
    document.getElementById('form-exam').reset();
    UI.openModal('modal-add-exam');
  },

  async handleExamSubmit() {
    const examName = document.getElementById('exam-title').value.trim();
    const examType = document.getElementById('exam-type').value;
    const startDate = document.getElementById('exam-start').value;
    const endDate = document.getElementById('exam-end').value;

    try {
      await API.post('/grades/exams', {
        examName,
        examType,
        startDate,
        endDate
      });

      UI.showToast('Exam scheduled successfully!', 'success');
      UI.closeModal('modal-add-exam');
      await this.loadFilterDropdowns();
      await this.fetchExams();
    } catch (err) {
      UI.showToast('Failed to create exam: ' + err.message, 'error');
    }
  }
};
