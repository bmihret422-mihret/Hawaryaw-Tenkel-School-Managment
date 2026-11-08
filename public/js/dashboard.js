/**
 * Dashboard Controller
 * Adapts widgets, metrics, and tables according to user role (ADMIN, TEACHER, STUDENT)
 */
const Dashboard = {
  async load() {
    try {
      const data = await API.get('/dashboard/stats');
      if (!data.success) return;

      if (data.role === 'ADMIN') {
        this.renderAdminDashboard(data);
      } else if (data.role === 'TEACHER') {
        this.renderTeacherDashboard(data);
      } else if (data.role === 'STUDENT') {
        this.renderStudentDashboard(data);
      }
    } catch (err) {
      console.error('[Dashboard Load Error]:', err);
      UI.showToast('Could not load dashboard metrics: ' + err.message, 'error');
    }
  },

  renderAdminDashboard(data) {
    const s = data.summary;
    const metricsGrid = document.getElementById('dashboard-metrics');

    metricsGrid.innerHTML = `
      <div class="metric-card">
        <div class="metric-icon-box purple">
          <i class="fa-solid fa-user-graduate"></i>
        </div>
        <div class="metric-content">
          <h4>Active Students</h4>
          <div class="metric-value">${s.TOTAL_STUDENTS || 0}</div>
          <div class="metric-subtitle">Enrolled this term</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box blue">
          <i class="fa-solid fa-chalkboard-user"></i>
        </div>
        <div class="metric-content">
          <h4>Faculty Members</h4>
          <div class="metric-value">${s.TOTAL_TEACHERS || 0}</div>
          <div class="metric-subtitle">Teaching staff</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box emerald">
          <i class="fa-solid fa-sack-dollar"></i>
        </div>
        <div class="metric-content">
          <h4>Fee Collections</h4>
          <div class="metric-value">${UI.formatCurrency(s.TOTAL_COLLECTED)}</div>
          <div class="metric-subtitle">${UI.formatCurrency(s.TOTAL_PENDING)} Pending</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box amber">
          <i class="fa-solid fa-school"></i>
        </div>
        <div class="metric-content">
          <h4>Active Classes</h4>
          <div class="metric-value">${s.TOTAL_CLASSES || 0}</div>
          <div class="metric-subtitle">${s.TOTAL_SUBJECTS || 0} Curriculum Courses</div>
        </div>
      </div>
    `;

    // Institutional Analytics (Class Breakdown)
    const chartCardContent = document.getElementById('dash-chart-content');
    let classRows = '';
    (data.classDistribution || []).forEach(c => {
      const pct = Math.min(100, Math.round((c.STUDENT_COUNT / 35) * 100));
      classRows += `
        <tr>
          <td><strong>${c.CLASS_NAME} - Sec ${c.SECTION}</strong></td>
          <td>${c.STUDENT_COUNT} Students</td>
          <td>
            <div style="background: var(--border-light); border-radius: 9999px; height: 10px; width: 100%; overflow: hidden;">
              <div style="background: var(--primary); width: ${pct}%; height: 100%; border-radius: 9999px;"></div>
            </div>
          </td>
          <td class="text-right"><strong>${pct}%</strong> capacity</td>
        </tr>
      `;
    });

    chartCardContent.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Class / Section</th>
            <th>Enrolled</th>
            <th>Capacity Fill</th>
            <th class="text-right">Occupancy</th>
          </tr>
        </thead>
        <tbody>
          ${classRows || '<tr><td colspan="4" class="text-center text-muted">No classes recorded yet.</td></tr>'}
        </tbody>
      </table>
    `;

    // Announcements
    this.renderAnnouncementsList(data.announcements);

    // Recent Fee Transactions
    const recentTable = document.getElementById('dash-recent-table');
    const tableTitle = document.getElementById('dash-table-title');
    tableTitle.innerHTML = `<i class="fa-solid fa-clock-rotate-left text-blue"></i> Recent Fee Invoices & Payments`;

    let feeRows = '';
    (data.recentFees || []).forEach(f => {
      feeRows += `
        <tr>
          <td><strong>${f.STUDENT_NAME}</strong></td>
          <td>${f.CLASS_NAME || ''} ${f.SECTION || ''}</td>
          <td>${f.TITLE}</td>
          <td><strong>${UI.formatCurrency(f.AMOUNT)}</strong></td>
          <td>${UI.formatCurrency(f.PAID_AMOUNT)}</td>
          <td>${UI.renderStatusBadge(f.STATUS)}</td>
        </tr>
      `;
    });

    recentTable.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Class</th>
            <th>Invoice Title</th>
            <th>Amount</th>
            <th>Paid</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${feeRows || '<tr><td colspan="6" class="text-center text-muted">No recent fee records found.</td></tr>'}
        </tbody>
      </table>
    `;
  },

  renderTeacherDashboard(data) {
    const s = data.summary;
    const metricsGrid = document.getElementById('dashboard-metrics');

    metricsGrid.innerHTML = `
      <div class="metric-card">
        <div class="metric-icon-box purple">
          <i class="fa-solid fa-chalkboard"></i>
        </div>
        <div class="metric-content">
          <h4>My Teaching Classes</h4>
          <div class="metric-value">${s.totalClasses || 0}</div>
          <div class="metric-subtitle">Assigned sections</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box blue">
          <i class="fa-solid fa-users"></i>
        </div>
        <div class="metric-content">
          <h4>Students Under Instruction</h4>
          <div class="metric-value">${s.totalStudents || 0}</div>
          <div class="metric-subtitle">Across assigned courses</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box emerald">
          <i class="fa-solid fa-calendar-check"></i>
        </div>
        <div class="metric-content">
          <h4>Daily Attendance</h4>
          <div class="metric-value"><button class="btn btn-sm btn-primary" onclick="App.navigate('attendance')">Take Attendance</button></div>
          <div class="metric-subtitle">Ready to log today</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box amber">
          <i class="fa-solid fa-award"></i>
        </div>
        <div class="metric-content">
          <h4>Gradebook Entry</h4>
          <div class="metric-value"><button class="btn btn-sm btn-outline" onclick="App.navigate('grades')">Open Marks</button></div>
          <div class="metric-subtitle">Record exam marks</div>
        </div>
      </div>
    `;

    // Teacher's Courses Table
    const chartCardContent = document.getElementById('dash-chart-content');
    let classRows = '';
    (data.myClasses || []).forEach(c => {
      classRows += `
        <tr>
          <td><strong>${c.CLASS_NAME} - Sec ${c.SECTION}</strong></td>
          <td><span class="badge badge-info">${c.SUBJECT_NAME}</span></td>
          <td>${c.ROOM_NUMBER || 'Room TBA'}</td>
          <td>${c.SCHEDULE_TIME || 'Standard Hours'}</td>
        </tr>
      `;
    });

    chartCardContent.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Class / Section</th>
            <th>Course / Subject</th>
            <th>Room</th>
            <th>Schedule</th>
          </tr>
        </thead>
        <tbody>
          ${classRows || '<tr><td colspan="4" class="text-center text-muted">No classes assigned yet.</td></tr>'}
        </tbody>
      </table>
    `;

    this.renderAnnouncementsList(data.announcements);

    // Hide or repurpose bottom table
    document.getElementById('dash-recent-table-card').style.display = 'none';
  },

  renderStudentDashboard(data) {
    const att = data.attendanceStats || {};
    const attPct = att.TOTAL_DAYS > 0 ? Math.round((att.DAYS_PRESENT / att.TOTAL_DAYS) * 100) : 100;

    // Calculate Average Grade Score
    let totalScore = 0;
    let countGrades = 0;
    (data.grades || []).forEach(g => {
      totalScore += g.SCORE;
      countGrades++;
    });
    const avgScore = countGrades > 0 ? Math.round(totalScore / countGrades) : 0;

    const metricsGrid = document.getElementById('dashboard-metrics');

    metricsGrid.innerHTML = `
      <div class="metric-card">
        <div class="metric-icon-box emerald">
          <i class="fa-solid fa-chart-line"></i>
        </div>
        <div class="metric-content">
          <h4>Academic Average</h4>
          <div class="metric-value">${avgScore}%</div>
          <div class="metric-subtitle">${countGrades} Recorded Assessments</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box blue">
          <i class="fa-solid fa-calendar-check"></i>
        </div>
        <div class="metric-content">
          <h4>Attendance Rate</h4>
          <div class="metric-value">${attPct}%</div>
          <div class="metric-subtitle">${att.DAYS_PRESENT || 0} / ${att.TOTAL_DAYS || 0} Days Present</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box purple">
          <i class="fa-solid fa-graduation-cap"></i>
        </div>
        <div class="metric-content">
          <h4>My Class</h4>
          <div class="metric-value">${data.studentProfile?.CLASS_NAME || ''} ${data.studentProfile?.SECTION || ''}</div>
          <div class="metric-subtitle">Roll #: ${data.studentProfile?.ROLL_NUMBER || '—'}</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box amber">
          <i class="fa-solid fa-receipt"></i>
        </div>
        <div class="metric-content">
          <h4>Fee Invoices</h4>
          <div class="metric-value"><button class="btn btn-sm btn-outline" onclick="App.navigate('fees')">View Fees</button></div>
          <div class="metric-subtitle">Check payment status</div>
        </div>
      </div>
    `;

    // My Enrolled Courses
    const chartCardContent = document.getElementById('dash-chart-content');
    let subjectRows = '';
    (data.enrolledSubjects || []).forEach(s => {
      subjectRows += `
        <tr>
          <td><strong>${s.SUBJECT_CODE}</strong></td>
          <td>${s.SUBJECT_NAME}</td>
          <td>${s.CREDITS} Credits</td>
          <td>${s.TEACHER_NAME || 'Faculty Assigned'}</td>
          <td>${s.SCHEDULE_TIME || 'Mon-Fri'}</td>
        </tr>
      `;
    });

    chartCardContent.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Course Name</th>
            <th>Credits</th>
            <th>Instructor</th>
            <th>Schedule</th>
          </tr>
        </thead>
        <tbody>
          ${subjectRows || '<tr><td colspan="5" class="text-center text-muted">No courses assigned yet.</td></tr>'}
        </tbody>
      </table>
    `;

    this.renderAnnouncementsList(data.announcements);

    // Recent Grades
    const recentTable = document.getElementById('dash-recent-table');
    const tableTitle = document.getElementById('dash-table-title');
    tableTitle.innerHTML = `<i class="fa-solid fa-award text-blue"></i> My Recent Examination Marks`;

    let gradeRows = '';
    (data.grades || []).forEach(g => {
      gradeRows += `
        <tr>
          <td><strong>${g.EXAM_NAME}</strong></td>
          <td>${g.SUBJECT_NAME}</td>
          <td><strong>${g.SCORE} / ${g.MAX_SCORE}</strong></td>
          <td><span class="badge badge-success">${g.GRADE_LETTER}</span></td>
          <td>${g.REMARKS || 'Good work'}</td>
        </tr>
      `;
    });

    recentTable.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Assessment Exam</th>
            <th>Subject</th>
            <th>Score</th>
            <th>Grade</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${gradeRows || '<tr><td colspan="5" class="text-center text-muted">No grades recorded yet.</td></tr>'}
        </tbody>
      </table>
    `;
    document.getElementById('dash-recent-table-card').style.display = 'block';
  },

  renderAnnouncementsList(announcements) {
    const list = document.getElementById('dash-announcements-list');
    if (!list) return;

    if (!announcements || announcements.length === 0) {
      list.innerHTML = `<p class="text-muted text-center py-3">No campus announcements posted.</p>`;
      return;
    }

    list.innerHTML = announcements.slice(0, 4).map(a => `
      <div class="compact-notice-item prio-${a.PRIORITY}">
        <div class="compact-notice-header">
          <span class="compact-notice-title">${a.TITLE}</span>
          <span class="compact-notice-date">${UI.formatDate(a.CREATED_AT)}</span>
        </div>
        <p class="compact-notice-body">${a.CONTENT}</p>
      </div>
    `).join('');
  }
};
