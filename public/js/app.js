/**
 * Main Application Router & Coordinator
 */
const App = {
  currentView: 'dashboard',

  init() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      this.navigate(hash, false);
    });

    Auth.init();
  },

  navigate(viewId, updateHash = true) {
    const validViews = [
      'dashboard', 'students', 'teachers', 'classes', 
      'subjects', 'attendance', 'grades', 'fees', 
      'announcements', 'oracle-info'
    ];

    if (!validViews.includes(viewId)) {
      viewId = 'dashboard';
    }

    this.currentView = viewId;

    if (updateHash) {
      window.location.hash = viewId;
    }

    // Update active nav link
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-nav') === viewId);
    });

    // Update active content view
    document.querySelectorAll('.content-view').forEach(el => {
      el.classList.remove('active');
    });

    const activeView = document.getElementById(`view-${viewId}`);
    if (activeView) {
      activeView.classList.add('active');
    }

    // Update Page Header Info
    this.updateHeaderTitles(viewId);

    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');

    // Trigger module loader
    this.loadViewData(viewId);
  },

  updateHeaderTitles(viewId) {
    const titles = {
      dashboard: { title: 'Dashboard', sub: 'School Overview & Analytics' },
      students: { title: 'Students Directory', sub: 'Manage enrolled student records, demographics & academic profiles' },
      teachers: { title: 'Faculty & Instructors', sub: 'Faculty staff roster, specializations & teaching assignments' },
      classes: { title: 'Classes & Sections', sub: 'Classroom allocations, student capacity & course schedules' },
      subjects: { title: 'Courses & Curriculum', sub: 'Academic course catalog, syllabus & credit systems' },
      attendance: { title: 'Attendance Tracker', sub: 'Record and track daily student presence and excuses' },
      grades: { title: 'Gradebook & Exams', sub: 'Class marks sheets, examinations and printable report cards' },
      fees: { title: 'Fee Invoicing & Payments', sub: 'Tuition and laboratory billing with printable cash receipts' },
      announcements: { title: 'Notice Board', sub: 'Official school broadcasts, alerts & emergency memos' },
      'oracle-info': { title: 'Oracle DB Engine Status', sub: 'Live diagnostics for Oracle Database 11g Express Edition' }
    };

    const info = titles[viewId] || titles.dashboard;
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-subtitle');

    if (titleEl) titleEl.textContent = info.title;
    if (subEl) subEl.textContent = info.sub;
  },

  loadViewData(viewId) {
    switch (viewId) {
      case 'dashboard':
        Dashboard.load();
        break;
      case 'students':
        Students.load();
        break;
      case 'teachers':
        Teachers.load();
        break;
      case 'classes':
        Classes.load();
        break;
      case 'subjects':
        Subjects.load();
        break;
      case 'attendance':
        Attendance.load();
        break;
      case 'grades':
        Grades.load();
        break;
      case 'fees':
        Fees.load();
        break;
      case 'announcements':
        Announcements.load();
        break;
      case 'oracle-info':
        UI.refreshOracleHealth();
        break;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
