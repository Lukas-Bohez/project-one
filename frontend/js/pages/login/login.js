// #region *** DOM references ***********
const domLogin = {
  loginBtn: document.querySelector('.js-login-admin'),
  loginForm: document.querySelector('.js-login-form'),
  firstnameInput: document.querySelector('.js-user-input'),
  lastnameInput: document.querySelector('.js-user-input-2'),
  rfidInput: document.querySelector('.js-rfid-input'),
  errorMessage: document.querySelector('.js-error-message'),
};
// #endregion

// #region *** Session Storage ***********
const AdminSession = {
  store: (userData) => {
    sessionStorage.setItem('admin_user_id', userData.user_id.toString());
    sessionStorage.setItem('admin_first_name', userData.first_name);
    sessionStorage.setItem('admin_last_name', userData.last_name);
    sessionStorage.setItem('admin_rfid_code', userData.rfid_code);
    sessionStorage.setItem('admin_login_timestamp', Date.now().toString());
  },

  get: () => {
    const userId = sessionStorage.getItem('admin_user_id');
    const firstName = sessionStorage.getItem('admin_first_name');
    const lastName = sessionStorage.getItem('admin_last_name');
    const rfidCode = sessionStorage.getItem('admin_rfid_code');
    const timestamp = sessionStorage.getItem('admin_login_timestamp');

    if (!userId || !firstName || !lastName || !rfidCode || !timestamp) {
      return null;
    }

    return {
      user_id: parseInt(userId),
      first_name: firstName,
      last_name: lastName,
      rfid_code: rfidCode,
      login_timestamp: parseInt(timestamp)
    };
  },

  clear: () => {
    sessionStorage.removeItem('admin_user_id');
    sessionStorage.removeItem('admin_first_name');
    sessionStorage.removeItem('admin_last_name');
    sessionStorage.removeItem('admin_rfid_code');
    sessionStorage.removeItem('admin_login_timestamp');
  },

  isValid: () => {
    const session = AdminSession.get();
    if (!session) return false;
    
    // Check if session is expired (24 hours)
    const now = Date.now();
    const sessionAge = now - session.login_timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (sessionAge > maxAge) {
      AdminSession.clear();
      return false;
    }
    return true;
  }
};
// #endregion

// #region *** UI Helpers ***********
const showErrorMessage = (message) => {
  if (domLogin.errorMessage) {
    domLogin.errorMessage.textContent = message;
    domLogin.errorMessage.classList.add('is-visible');
    setTimeout(() => {
      domLogin.errorMessage.classList.remove('is-visible');
      domLogin.errorMessage.textContent = '';
    }, 5000);
  }
};

const showLoadingState = (button, isLoading) => {
  if (button) {
    button.disabled = isLoading;
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }
    button.innerHTML = isLoading ? '<span class="c-loading-spinner"></span> Loading...' : button.dataset.originalText;
  }
};
// #endregion

// #region *** API Call ***********
const authenticateUser = async (firstName, lastName, rfidCode) => {
  const csrfToken = (function getCookie(name) {
    const v = `; ${document.cookie}`;
    const parts = v.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  })('csrf_token');

  const response = await fetch(`/api/v1/users/${encodeURIComponent(rfidCode)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
    },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Authentication failed');
  }

  return await response.json();
};
// #endregion

// #region *** Form Validation ***********
const validateForm = () => {
  const firstName = domLogin.firstnameInput?.value.trim() || '';
  const lastName = domLogin.lastnameInput?.value.trim() || '';
  const rfidCode = domLogin.rfidInput?.value.trim() || '';

  if (!firstName) {
    showErrorMessage('First name is required');
    return null;
  }
  if (!lastName) {
    showErrorMessage('Last name is required');
    return null;
  }
  if (!rfidCode) {
    showErrorMessage('RFID code is required');
    return null;
  }
  
  return { firstName, lastName, rfidCode };
};
// #endregion

// #region *** Login Handler ***********
const handleLogin = async (e) => {
  e.preventDefault();
  
  const formData = validateForm();
  if (!formData) return;

  showLoadingState(domLogin.loginBtn, true);

  try {
    const result = await authenticateUser(
      formData.firstName, 
      formData.lastName, 
      formData.rfidCode
    );
    
    if (result?.user_id) {
      // Store session data
      AdminSession.store({
        user_id: result.user_id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        rfid_code: formData.rfidCode
      });

      // Also store for articles.js compatibility (session-only)
      sessionStorage.setItem('currentUserId', result.user_id.toString());
      sessionStorage.setItem('currentUserRFID', formData.rfidCode);

      // Redirect to admin page
      window.location.href = '/pages/admin/';
    } else {
      showErrorMessage('Login failed: Invalid response from server');
    }
  } catch (error) {
    console.error('Login error:', error);
    showErrorMessage(error.message || 'Login failed. Please check your details and try again.');
  } finally {
    showLoadingState(domLogin.loginBtn, false);
  }
};
// #endregion

// #region *** Event Listeners ***********
const setupEventListeners = () => {
  if (domLogin.loginBtn) {
    domLogin.loginBtn.addEventListener('click', handleLogin);
  }
  
  if (domLogin.loginForm) {
    domLogin.loginForm.addEventListener('submit', handleLogin);
    
    // Allow Enter key to trigger login
    domLogin.loginForm.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleLogin(e);
      }
    });
  }
};
// #endregion

// #region *** Session Management ***********
const checkExistingSession = () => {
  if (AdminSession.isValid()) {
    const session = AdminSession.get();
    console.log(`Auto-logging in admin: ${session.first_name} ${session.last_name}`);
    window.location.href = '/pages/admin/';
    return true;
  }
  return false;
};

const logout = () => {
  AdminSession.clear();
  // Clear articles.js compatibility storage
  sessionStorage.removeItem('currentUserId');
  sessionStorage.removeItem('currentUserRFID');
  window.location.href = '/pages/login/';
};

const getCurrentAdminSession = () => {
  if (!AdminSession.isValid()) {
    window.location.href = '/pages/login/';
    return null;
  }
  return AdminSession.get();
};

// Expose functions globally for use in admin pages
window.adminLogout = logout;
window.getCurrentAdminSession = getCurrentAdminSession;
// #endregion

// #region *** Initialization ***********
const init = () => {
  // Check for existing session first
  if (checkExistingSession()) {
    return; // Will redirect, no need to initialize login form
  }

  // Only initialize if the login form is present on the page
  if (document.querySelector('.js-login-form')) {
      // Populate CSRF token field from cookie (middleware sets `csrf_token` cookie)
      const tokenInput = document.getElementById('csrfToken');
      if (tokenInput) {
        const v = `; ${document.cookie}`;
        const parts = v.split(`; csrf_token=`);
        if (parts.length === 2) tokenInput.value = parts.pop().split(';').shift() || '';
      }
    setupEventListeners();
    
    // Clear any existing error messages on page load
    if (domLogin.errorMessage) {
      domLogin.errorMessage.textContent = '';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize based on current page
  if (window.location.pathname.startsWith('/pages/login')) {
    init();
  } else if (window.location.pathname.startsWith('/pages/admin')) {
    // For admin pages, check if session is valid
    if (!AdminSession.isValid()) {
      window.location.href = '/pages/login/';
    }
  }
});
// #endregion