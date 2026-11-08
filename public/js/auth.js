/**
 * Authentication and Session Management
 */
const Auth = {
  currentUser: null,

  init() {
    const token = localStorage.getItem('sms_token');
    const userJson = localStorage.getItem('sms_user');

    if (token && userJson) {
      try {
        this.currentUser = JSON.parse(userJson);
        this.showApp();
      } catch (err) {
        this.logout();
      }
    } else {
      this.showLogin();
    }
  },

  async handleLogin() {
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const btnLogin = document.getElementById('btn-login');

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      UI.showToast('Please enter both username and password.', 'error');
      return;
    }

    try {
      btnLogin.disabled = true;
      btnLogin.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...`;

      const data = await API.post('/auth/login', { username, password });

      localStorage.setItem('sms_token', data.token);
      localStorage.setItem('sms_user', JSON.stringify(data.user));
      this.currentUser = data.user;

      UI.showToast(`Welcome back, ${data.user.fullName}!`, 'success');
      this.showApp();
    } catch (err) {
      UI.showToast(err.message || 'Login failed. Please verify credentials.', 'error');
    } finally {
      btnLogin.disabled = false;
      btnLogin.innerHTML = `<span>Sign In to Portal</span> <i class="fa-solid fa-arrow-right"></i>`;
    }
  },

  quickLogin(username, password) {
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = password;
    this.handleLogin();
  },

  showLogin() {
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  },

  showApp() {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');

    this.renderUserProfile();
    this.enforceRoleNavigation();
    App.navigate('dashboard');
  },

  renderUserProfile() {
    const user = this.currentUser || {};
    const initials = (user.fullName || 'User')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    // Topbar Profile
    const topName = document.getElementById('topbar-user-name');
    const topRole = document.getElementById('topbar-role-badge');
    if (topName) topName.textContent = user.fullName || user.username;
    if (topRole) topRole.textContent = user.role;

    // Sidebar Profile
    const navAvatar = document.getElementById('nav-user-avatar');
    const navName = document.getElementById('nav-user-name');
    const navRole = document.getElementById('nav-user-role');
    if (navAvatar) navAvatar.textContent = initials;
    if (navName) navName.textContent = user.fullName || user.username;
    if (navRole) navRole.textContent = user.role;
  },

  enforceRoleNavigation() {
    const role = this.currentUser?.role || 'STUDENT';
    const navItems = document.querySelectorAll('.nav-item[data-roles]');

    navItems.forEach(item => {
      const allowedRoles = item.getAttribute('data-roles').split(',');
      if (allowedRoles.includes(role)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });

    // Also hide role-restricted buttons across views
    const roleButtons = document.querySelectorAll('[data-roles]');
    roleButtons.forEach(btn => {
      if (!btn.classList.contains('nav-item')) {
        const allowed = btn.getAttribute('data-roles').split(',');
        btn.style.display = allowed.includes(role) ? '' : 'none';
      }
    });
  },

  logout() {
    localStorage.removeItem('sms_token');
    localStorage.removeItem('sms_user');
    this.currentUser = null;
    this.showLogin();
    UI.showToast('You have been logged out safely.', 'info');
  }
};
