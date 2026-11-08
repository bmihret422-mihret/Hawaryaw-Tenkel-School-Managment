/**
 * UI Utilities, Modals, Theme Toggle, Toasts, Formatting
 */
const UI = {
  init() {
    // Restore theme preference
    const savedTheme = localStorage.getItem('sms_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);

    // Initial check for Oracle Database health
    this.refreshOracleHealth();
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon} toast-icon"></i>
      <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.toggle('mobile-open');
    }
  },

  toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('sms_theme', newTheme);
    this.updateThemeIcon(newTheme);
  },

  updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  },

  togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  },

  async refreshOracleHealth() {
    try {
      const data = await API.get('/auth/health');
      const indicator = document.getElementById('topbar-oracle-status');
      const authIndicator = document.getElementById('oracle-health-indicator');

      if (data.success) {
        if (indicator) {
          indicator.innerHTML = `
            <span class="status-indicator-dot online"></span>
            <span class="status-text">Oracle 11g XE Active</span>
          `;
        }
        if (authIndicator) {
          authIndicator.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i> Oracle Database XE Connected`;
        }

        // If on oracle-info view, render full specs
        const specsGrid = document.getElementById('oracle-specs-grid');
        if (specsGrid) {
          specsGrid.innerHTML = `
            <div class="oracle-spec-box">
              <span>Database Status</span>
              <h4 class="text-success"><i class="fa-solid fa-circle-check"></i> ${data.status}</h4>
            </div>
            <div class="oracle-spec-box">
              <span>Oracle Engine</span>
              <h4>${data.database}</h4>
            </div>
            <div class="oracle-spec-box">
              <span>Connected Schema</span>
              <h4>${data.user}</h4>
            </div>
            <div class="oracle-spec-box">
              <span>Database Sysdate</span>
              <h4>${new Date(data.currentTime).toLocaleString()}</h4>
            </div>
            <div class="oracle-spec-box">
              <span>Active Pool Connections</span>
              <h4>${data.pool.connectionsInUse} in use / ${data.pool.connectionsOpen} open</h4>
            </div>
            <div class="oracle-spec-box">
              <span>Server Version</span>
              <h4 style="font-size: 0.85rem;">${data.version}</h4>
            </div>
          `;
        }
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      const indicator = document.getElementById('topbar-oracle-status');
      const authIndicator = document.getElementById('oracle-health-indicator');
      if (indicator) {
        indicator.innerHTML = `
          <span class="status-indicator-dot offline"></span>
          <span class="status-text text-danger">Oracle DB Offline</span>
        `;
      }
      if (authIndicator) {
        authIndicator.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-danger"></i> Oracle DB Offline: ${err.message}`;
      }
    }
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  },

  renderStatusBadge(status) {
    const s = (status || '').toUpperCase();
    if (['ACTIVE', 'PRESENT', 'PAID', 'COMPLETED', 'PUBLISHED'].includes(s)) {
      return `<span class="badge badge-success">${s}</span>`;
    }
    if (['PENDING', 'LATE', 'PARTIALLY_PAID', 'UPCOMING'].includes(s)) {
      return `<span class="badge badge-warning">${s}</span>`;
    }
    if (['ABSENT', 'OVERDUE', 'EXPELLED', 'RESIGNED'].includes(s)) {
      return `<span class="badge badge-danger">${s}</span>`;
    }
    if (['EXCUSED', 'ON_LEAVE', 'ALUMNI'].includes(s)) {
      return `<span class="badge badge-info">${s}</span>`;
    }
    return `<span class="badge badge-neutral">${s || 'UNKNOWN'}</span>`;
  }
};

document.addEventListener('DOMContentLoaded', () => UI.init());
