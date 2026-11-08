/**
 * Students Module
 * Handles student directory, enrollment, profile 360 view, and report card generation
 */
const Students = {
  currentStudents: [],
  selectedStudent: null,

  async load() {
    await this.loadClassFilterOptions();
    await this.fetchStudents();
  },

  async loadClassFilterOptions() {
    try {
      const data = await API.get('/classes');
      const selectFilter = document.getElementById('student-class-filter');
      const modalSelect = document.getElementById('std-class');

      let optionsHtml = '<option value="">All Classes</option>';
      let modalOptionsHtml = '<option value="">-- Choose Class --</option>';

      (data.data || []).forEach(c => {
        optionsHtml += `<option value="${c.CLASS_ID}">${c.CLASS_NAME} - Sec ${c.SECTION}</option>`;
        modalOptionsHtml += `<option value="${c.CLASS_ID}">${c.CLASS_NAME} - Sec ${c.SECTION}</option>`;
      });

      if (selectFilter) selectFilter.innerHTML = optionsHtml;
      if (modalSelect) modalSelect.innerHTML = modalOptionsHtml;
    } catch (err) {
      console.error('[Students Class Options Error]:', err);
    }
  },

  async fetchStudents() {
    const search = document.getElementById('student-search-input')?.value.trim();
    const classId = document.getElementById('student-class-filter')?.value;

    try {
      const data = await API.get('/students', { search, classId });
      this.currentStudents = data.data || [];
      this.renderTable(this.currentStudents);
    } catch (err) {
      UI.showToast('Failed to load students: ' + err.message, 'error');
    }
  },

  renderTable(students) {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;

    if (!students || students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No students matching criteria found.</td></tr>`;
      return;
    }

    const isAdmin = Auth.currentUser?.role === 'ADMIN';

    tbody.innerHTML = students.map(s => `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div style="width:34px; height:34px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.8rem;">
              ${(s.FULL_NAME || 'S').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <strong style="cursor:pointer; color:var(--primary);" onclick="Students.openProfileModal(${s.STUDENT_ID})">${s.FULL_NAME}</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">${s.EMAIL || 'No email registered'}</div>
            </div>
          </div>
        </td>
        <td><code>${s.ADMISSION_NUMBER}</code></td>
        <td><strong>${s.CLASS_NAME ? `${s.CLASS_NAME} - ${s.SECTION}` : 'Unassigned'}</strong></td>
        <td>${s.ROLL_NUMBER || '—'}</td>
        <td>${s.GENDER || '—'}</td>
        <td>
          <div>${s.GUARDIAN_NAME || '—'}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${s.GUARDIAN_PHONE || ''}</div>
        </td>
        <td>${UI.renderStatusBadge(s.STUDENT_STATUS)}</td>
        <td class="text-right">
          <div style="display:inline-flex; gap:0.4rem;">
            <button class="btn btn-sm btn-outline" title="View Full 360 Profile" onclick="Students.openProfileModal(${s.STUDENT_ID})">
              <i class="fa-solid fa-eye text-primary"></i>
            </button>
            ${isAdmin ? `
              <button class="btn btn-sm btn-outline" title="Delete Student" onclick="Students.deleteStudent(${s.STUDENT_ID})">
                <i class="fa-solid fa-trash text-danger"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  },

  handleSearch() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.fetchStudents(), 250);
  },

  handleFilter() {
    this.fetchStudents();
  },

  openAddModal() {
    document.getElementById('form-student').reset();
    document.getElementById('student-edit-id').value = '';
    document.getElementById('modal-student-title').textContent = 'Enroll New Student';
    UI.openModal('modal-add-student');
  },

  async handleSubmit() {
    const fullName = document.getElementById('std-fullname').value.trim();
    const admissionNumber = document.getElementById('std-adm').value.trim();
    const classId = document.getElementById('std-class').value;
    const rollNumber = document.getElementById('std-roll').value.trim();
    const dob = document.getElementById('std-dob').value;
    const gender = document.getElementById('std-gender').value;
    const bloodGroup = document.getElementById('std-blood').value.trim();
    const email = document.getElementById('std-email').value.trim();
    const guardianName = document.getElementById('std-gname').value.trim();
    const guardianPhone = document.getElementById('std-gphone').value.trim();
    const guardianRelation = document.getElementById('std-grel').value.trim();
    const address = document.getElementById('std-addr').value.trim();

    try {
      await API.post('/students', {
        fullName,
        admissionNumber,
        classId,
        rollNumber,
        dob,
        gender,
        bloodGroup,
        email,
        guardianName,
        guardianPhone,
        guardianRelation,
        address
      });

      UI.showToast('Student enrolled successfully in Oracle DB!', 'success');
      UI.closeModal('modal-add-student');
      this.fetchStudents();
    } catch (err) {
      UI.showToast('Failed to enroll student: ' + err.message, 'error');
    }
  },

  async deleteStudent(studentId) {
    if (!confirm('Are you sure you want to delete this student and their entire record? This action cannot be undone.')) {
      return;
    }

    try {
      await API.delete(`/students/${studentId}`);
      UI.showToast('Student deleted successfully.', 'success');
      this.fetchStudents();
    } catch (err) {
      UI.showToast('Failed to delete student: ' + err.message, 'error');
    }
  },

  async openProfileModal(studentId) {
    try {
      const data = await API.get(`/students/${studentId}`);
      if (!data.success) return;

      this.selectedStudent = data;

      const s = data.student;
      document.getElementById('prof-name').textContent = s.FULL_NAME;
      document.getElementById('prof-meta').textContent = `${s.CLASS_NAME || 'Class'} ${s.SECTION || ''} | Admission: ${s.ADMISSION_NUMBER} | Roll: ${s.ROLL_NUMBER || '—'}`;
      document.getElementById('prof-avatar').textContent = (s.FULL_NAME || 'S').substring(0, 2).toUpperCase();

      this.switchProfileTab('info');
      UI.openModal('modal-student-profile');
    } catch (err) {
      UI.showToast('Error opening student profile: ' + err.message, 'error');
    }
  },

  switchProfileTab(tab) {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    event?.target?.classList.add('active');

    const content = document.getElementById('prof-tab-content');
    const data = this.selectedStudent;
    if (!data) return;

    const s = data.student;

    if (tab === 'info') {
      content.innerHTML = `
        <div class="form-grid">
          <div>
            <h4 class="form-section-title">Personal Record</h4>
            <p><strong>Admission Number:</strong> ${s.ADMISSION_NUMBER}</p>
            <p><strong>Roll Number:</strong> ${s.ROLL_NUMBER || '—'}</p>
            <p><strong>Date of Birth:</strong> ${UI.formatDate(s.DOB)}</p>
            <p><strong>Gender:</strong> ${s.GENDER || '—'}</p>
            <p><strong>Blood Group:</strong> ${s.BLOOD_GROUP || '—'}</p>
            <p><strong>Admission Date:</strong> ${UI.formatDate(s.ADMISSION_DATE)}</p>
          </div>
          <div>
            <h4 class="form-section-title">Guardian & Contact</h4>
            <p><strong>Guardian Name:</strong> ${s.GUARDIAN_NAME || '—'} (${s.GUARDIAN_RELATION || 'Parent'})</p>
            <p><strong>Guardian Phone:</strong> ${s.GUARDIAN_PHONE || '—'}</p>
            <p><strong>Guardian Email:</strong> ${s.GUARDIAN_EMAIL || '—'}</p>
            <p><strong>Residential Address:</strong> ${s.ADDRESS || '—'}</p>
            <p><strong>Student Status:</strong> ${UI.renderStatusBadge(s.STATUS)}</p>
          </div>
        </div>
      `;
    } else if (tab === 'grades') {
      const grades = data.grades || [];
      let rows = grades.map(g => `
        <tr>
          <td><strong>${g.EXAM_NAME}</strong></td>
          <td>${g.SUBJECT_NAME} (${g.SUBJECT_CODE})</td>
          <td><strong>${g.SCORE} / ${g.MAX_SCORE}</strong></td>
          <td><span class="badge badge-success">${g.GRADE_LETTER}</span></td>
          <td>${g.REMARKS || '—'}</td>
        </tr>
      `).join('');

      content.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Exam</th>
              <th>Course</th>
              <th>Score</th>
              <th>Grade</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" class="text-center text-muted">No assessment marks logged yet.</td></tr>'}
          </tbody>
        </table>
      `;
    } else if (tab === 'attendance') {
      const att = data.attendance || {};
      const total = att.TOTAL_MARKED || 0;
      const rate = total > 0 ? Math.round((att.PRESENT_COUNT / total) * 100) : 100;

      content.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:1rem; margin-bottom:1.5rem; text-align:center;">
          <div class="card p-3">
            <span class="text-muted">Attendance Rate</span>
            <h2 class="text-success">${rate}%</h2>
          </div>
          <div class="card p-3">
            <span class="text-muted">Days Present</span>
            <h2>${att.PRESENT_COUNT || 0}</h2>
          </div>
          <div class="card p-3">
            <span class="text-muted">Days Absent</span>
            <h2 class="text-danger">${att.ABSENT_COUNT || 0}</h2>
          </div>
          <div class="card p-3">
            <span class="text-muted">Days Late</span>
            <h2 class="text-warning">${att.LATE_COUNT || 0}</h2>
          </div>
        </div>
      `;
    } else if (tab === 'fees') {
      const fees = data.fees || [];
      let rows = fees.map(f => `
        <tr>
          <td>${f.TITLE}</td>
          <td>${f.FEE_TYPE}</td>
          <td><strong>${UI.formatCurrency(f.AMOUNT)}</strong></td>
          <td>${UI.formatCurrency(f.PAID_AMOUNT)}</td>
          <td>${UI.formatDate(f.DUE_DATE)}</td>
          <td>${UI.renderStatusBadge(f.STATUS)}</td>
        </tr>
      `).join('');

      content.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Fee Title</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Paid</th>
              <th>Due Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="6" class="text-center text-muted">No fee records found.</td></tr>'}
          </tbody>
        </table>
      `;
    }
  },

  async printReportCard() {
    if (!this.selectedStudent) return;
    const studentId = this.selectedStudent.student.STUDENT_ID;

    try {
      const data = await API.get(`/grades/report-card/${studentId}`);
      if (!data.success) return;

      const s = data.student;
      const sum = data.summary;
      const printable = document.getElementById('report-card-printable-content');

      let rows = (data.marks || []).map(m => `
        <tr>
          <td class="subject-name"><strong>${m.SUBJECT_NAME}</strong> (${m.SUBJECT_CODE})</td>
          <td>${m.CREDITS}</td>
          <td>${m.EXAM_NAME}</td>
          <td><strong>${m.SCORE}</strong> / ${m.MAX_SCORE}</td>
          <td><strong>${m.GRADE_LETTER}</strong></td>
          <td>${m.REMARKS || 'Satisfactory'}</td>
        </tr>
      `).join('');

      printable.innerHTML = `
        <div class="report-card-container">
          <div class="report-header">
            <div style="font-size:2rem; color:var(--primary); margin-bottom:0.5rem;"><i class="fa-solid fa-graduation-cap"></i></div>
            <h2>HAWARYAW TENKEL SCHOOL</h2>
            <p>Official Academic Performance Transcript & Report Card</p>
          </div>

          <div class="report-student-meta">
            <div><strong>Student Name:</strong><br>${s.FULL_NAME}</div>
            <div><strong>Admission #:</strong><br>${s.ADMISSION_NUMBER}</div>
            <div><strong>Class & Section:</strong><br>${s.CLASS_NAME} - ${s.SECTION}</div>
            <div><strong>Roll Number:</strong><br>${s.ROLL_NUMBER || '—'}</div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th style="text-align:left;">Subject & Course</th>
                <th>Credits</th>
                <th>Assessment</th>
                <th>Marks</th>
                <th>Letter Grade</th>
                <th>Instructor Comments</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="6">No grades recorded.</td></tr>'}
            </tbody>
          </table>

          <div class="report-gpa-summary">
            <div>Total Subjects Assessed: <strong>${sum.totalSubjects}</strong></div>
            <div>Overall Percentage: <strong style="font-size:1.2rem; color:var(--primary);">${sum.overallPercentage}%</strong></div>
            <div>Cumulative Grade: <strong style="font-size:1.3rem; color:var(--success);">${sum.overallGrade}</strong></div>
          </div>

          <div style="display:flex; justify-content:space-between; margin-top:3.5rem; text-align:center;">
            <div style="border-top:1px solid #64748b; width:200px; padding-top:0.5rem;">Principal / Headmaster</div>
            <div style="border-top:1px solid #64748b; width:200px; padding-top:0.5rem;">Class Mentor</div>
            <div style="border-top:1px solid #64748b; width:200px; padding-top:0.5rem;">Registrar Official Seal</div>
          </div>
        </div>
      `;

      UI.openModal('modal-report-card');
    } catch (err) {
      UI.showToast('Failed to generate report card: ' + err.message, 'error');
    }
  }
};
