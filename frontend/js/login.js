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

// #region *** In-Memory Session Storage ***********
let adminSession = null;

const AdminSession = {
  store: (userData) => {
    adminSession = {
      user_id: userData.user_id,
      first_name: userData.first_name,
      last_name: userData.last_name,
      rfid_code: userData.rfid_code,
      login_timestamp: Date.now()
    };
  },

  get: () => adminSession,

  clear: () => {
    adminSession = null;
  },

  isValid: () => {
    if (!adminSession) return false;
    
    // Check if session is expired (24 hours)
    const now = Date.now();
    const sessionAge = now - adminSession.login_timestamp;
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
  const response = await fetch(`/api/v1/users/${encodeURIComponent(rfidCode)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
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

      // Redirect to admin page
      window.location.href = 'admin.html';
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
    window.location.href = 'admin.html';
    return true;
  }
  return false;
};

const logout = () => {
  AdminSession.clear();
  window.location.href = 'login.html';
};

const getCurrentAdminSession = () => {
  if (!AdminSession.isValid()) {
    window.location.href = 'login.html';
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
    setupEventListeners();
    
    // Clear any existing error messages on page load
    if (domLogin.errorMessage) {
      domLogin.errorMessage.textContent = '';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize based on current page
  if (window.location.pathname.includes('login.html')) {
    init();
  } else if (window.location.pathname.includes('admin.html')) {
    // For admin pages, check if session is valid
    if (!AdminSession.isValid()) {
      window.location.href = 'login.html';
    }
  }
});
// #endregion