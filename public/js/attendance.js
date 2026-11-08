/**
 * Attendance Management Module
 */
const Attendance = {
  currentRoster: [],

  async load() {
    // Set date to today by default
    const dateInput = document.getElementById('att-date-input');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    await this.loadClassDropdown();
    await this.loadClassRoster();
  },

  async loadClassDropdown() {
    try {
      const data = await API.get('/classes');
      const select = document.getElementById('att-class-select');
      if (!select) return;

      select.innerHTML = (data.data || []).map(c => `
        <option value="${c.CLASS_ID}">${c.CLASS_NAME} - Section ${c.SECTION}</option>
      `).join('');
    } catch (err) {
      console.error('[Attendance Class Dropdown Error]:', err);
    }
  },

  async loadClassRoster() {
    const classId = document.getElementById('att-class-select')?.value;
    const date = document.getElementById('att-date-input')?.value;

    if (!classId) return;

    try {
      const data = await API.get('/attendance', { classId, date });
      this.currentRoster = data.data || [];
      this.renderRoster(this.currentRoster);
    } catch (err) {
      UI.showToast('Failed to load class roster: ' + err.message, 'error');
    }
  },

  renderRoster(roster) {
    const tbody = document.getElementById('attendance-table-body');
    if (!tbody) return;

    if (!roster || roster.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No enrolled students in this class.</td></tr>`;
      return;
    }

    tbody.innerHTML = roster.map(s => {
      const currentStatus = s.STATUS || 'PRESENT';
      return `
        <tr data-student-id="${s.STUDENT_ID}">
          <td>${s.ROLL_NUMBER || '—'}</td>
          <td><code>${s.ADMISSION_NUMBER}</code></td>
          <td><strong>${s.FULL_NAME}</strong></td>
          <td>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <select class="form-control att-status-select" style="max-width:140px;">
                <option value="PRESENT" ${currentStatus === 'PRESENT' ? 'selected' : ''}>Present</option>
                <option value="ABSENT" ${currentStatus === 'ABSENT' ? 'selected' : ''}>Absent</option>
                <option value="LATE" ${currentStatus === 'LATE' ? 'selected' : ''}>Late</option>
                <option value="EXCUSED" ${currentStatus === 'EXCUSED' ? 'selected' : ''}>Excused</option>
              </select>
            </div>
          </td>
          <td>
            <input type="text" class="form-control att-remarks-input" placeholder="Optional notes" value="${s.REMARKS || ''}">
          </td>
        </tr>
      `;
    }).join('');
  },

  markAll(status) {
    document.querySelectorAll('.att-status-select').forEach(sel => {
      sel.value = status;
    });
    UI.showToast(`Marked all students as ${status}. Click 'Save Attendance' to record.`, 'info');
  },

  async saveDailyAttendance() {
    const classId = document.getElementById('att-class-select')?.value;
    const date = document.getElementById('att-date-input')?.value;

    if (!classId || !date) {
      UI.showToast('Please select class and date.', 'error');
      return;
    }

    const rows = document.querySelectorAll('#attendance-table-body tr[data-student-id]');
    const records = [];

    rows.forEach(r => {
      const studentId = r.getAttribute('data-student-id');
      const status = r.querySelector('.att-status-select').value;
      const remarks = r.querySelector('.att-remarks-input').value.trim();

      records.push({ studentId, status, remarks });
    });

    if (records.length === 0) {
      UI.showToast('No students to save.', 'warning');
      return;
    }

    try {
      await API.post('/attendance/batch', {
        classId,
        date,
        records
      });

      UI.showToast(`Attendance successfully saved to Oracle Database!`, 'success');
      this.loadClassRoster();
    } catch (err) {
      UI.showToast('Failed to save attendance: ' + err.message, 'error');
    }
  }
};
