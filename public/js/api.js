/**
 * API Wrapper for School Management System
 * Handles automatic JWT inclusion, error interception, and JSON parsing
 */
const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('sms_token');
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('sms_token');
        localStorage.removeItem('sms_user');
        if (!window.location.hash.includes('login') && !document.getElementById('auth-view').classList.contains('active')) {
          UI.showToast('Session expired. Please log in again.', 'info');
          Auth.showLogin();
        }
        throw new Error('Unauthorized');
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Server request failed');
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  },

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};
