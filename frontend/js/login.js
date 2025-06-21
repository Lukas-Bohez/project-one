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

// #region *** Storage Keys ***********
const STORAGE_KEYS = {
  ADMIN: {
    USER_ID: 'admin_user_id',
    FIRST_NAME: 'admin_first_name',
    LAST_NAME: 'admin_last_name',
    RFID_CODE_HASH: 'admin_rfid_code_hash',
    LOGIN_TIMESTAMP: 'admin_login_timestamp',
    SESSION_TOKEN: 'admin_session_token'
  }
};

const API_BASE = '/api';
// #endregion

// #region *** Admin Session Object ***********
const AdminSession = {
  store: (userData) => {
    sessionStorage.setItem(STORAGE_KEYS.ADMIN.USER_ID, userData.user_id.toString());
    sessionStorage.setItem(STORAGE_KEYS.ADMIN.FIRST_NAME, userData.first_name);
    sessionStorage.setItem(STORAGE_KEYS.ADMIN.LAST_NAME, userData.last_name);
    sessionStorage.setItem(STORAGE_KEYS.ADMIN.RFID_CODE_HASH, userData.rfid_code);
    sessionStorage.setItem(STORAGE_KEYS.ADMIN.SESSION_TOKEN, userData.session_token);
    sessionStorage.setItem(STORAGE_KEYS.ADMIN.LOGIN_TIMESTAMP, Date.now().toString());
  },

  get: () => {
    const userId = sessionStorage.getItem(STORAGE_KEYS.ADMIN.USER_ID);
    const firstName = sessionStorage.getItem(STORAGE_KEYS.ADMIN.FIRST_NAME);
    const lastName = sessionStorage.getItem(STORAGE_KEYS.ADMIN.LAST_NAME);
    const rfidHash = sessionStorage.getItem(STORAGE_KEYS.ADMIN.RFID_CODE_HASH);
    const timestamp = sessionStorage.getItem(STORAGE_KEYS.ADMIN.LOGIN_TIMESTAMP);
    const sessionToken = sessionStorage.getItem(STORAGE_KEYS.ADMIN.SESSION_TOKEN);

    if (!userId || !firstName || !lastName || !rfidHash || !timestamp || !sessionToken) {
      return null;
    }

    return {
      user_id: parseInt(userId),
      first_name: firstName,
      last_name: lastName,
      rfid_code_hash: rfidHash,
      login_timestamp: parseInt(timestamp),
      session_token: sessionToken
    };
  },

  clear: () => {
    Object.values(STORAGE_KEYS.ADMIN).forEach(key => {
      sessionStorage.removeItem(key);
    });
  },

  isValid: async () => {
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
  },

  extend: async () => {
    if (await AdminSession.isValid()) {
      const sessionToken = sessionStorage.getItem(STORAGE_KEYS.ADMIN.SESSION_TOKEN);
      
      try {
        const response = await fetch(`${API_BASE}/extend-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': await SecurityUtils.getCSRFToken()
          },
          body: JSON.stringify({ session_token: sessionToken }),
          credentials: 'include'
        });

        if (response.ok) {
          sessionStorage.setItem(STORAGE_KEYS.ADMIN.LOGIN_TIMESTAMP, Date.now().toString());
        }
      } catch (error) {
        console.error('Session extension failed:', error);
      }
    }
  }
};
// #endregion

// #region *** Security Utils ***********
const SecurityUtils = {
  getCSRFToken: async () => {
    try {
      const response = await fetch(`${API_BASE}/csrf-token`);
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      return '';
    }
  }
};
// #endregion

// #region *** Callback-Visualisation - show___ ***********
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

// #region *** Authentication Request Handler ***********
const sendAdminAuthenticationRequest = async (firstName, lastName, rfidCode) => {
  try {
    const response = await fetch(`${API_BASE}/admin-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': await SecurityUtils.getCSRFToken()
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        rfid_code: rfidCode
      }),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw errorData;
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};
// #endregion

// #region *** Form Validation ***********
const validateAdminForm = () => {
  const firstName = domLogin.firstnameInput ? domLogin.firstnameInput.value.trim() : '';
  const lastName = domLogin.lastnameInput ? domLogin.lastnameInput.value.trim() : '';
  const rfidCode = domLogin.rfidInput ? domLogin.rfidInput.value.trim() : '';

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
const handleAdminLogin = async (e) => {
  e.preventDefault();
  
  const formData = validateAdminForm();
  if (!formData) return;

  showLoadingState(domLogin.loginBtn, true);

  try {
    const result = await sendAdminAuthenticationRequest(
      formData.firstName, 
      formData.lastName, 
      formData.rfidCode
    );
    
    if (result && result.user_id) {
      callbackLoginSuccess(result, formData.rfidCode);
    } else {
      callbackLoginFailed({ message: 'Login failed: Invalid response from server' });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    callbackLoginFailed(error);
  } finally {
    showLoadingState(domLogin.loginBtn, false);
  }
};

const listenToLogin = () => {
  if (domLogin.loginBtn) {
    domLogin.loginBtn.addEventListener('click', handleAdminLogin);
  }
  
  if (domLogin.loginForm) {
    // Prevent default form submission
    domLogin.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAdminLogin(e);
    });
    
    // Allow Enter key to trigger login
    domLogin.loginForm.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleAdminLogin(e);
      }
    });
  }
};
// #endregion

// #region *** Callback-No Visualisation - callback___ ***********
const callbackLoginSuccess = (userData, rfidCode) => {
  // Store credentials securely in sessionStorage
  AdminSession.store({
    user_id: userData.user_id,
    first_name: userData.first_name || domLogin.firstnameInput.value.trim(),
    last_name: userData.last_name || domLogin.lastnameInput.value.trim(),
    rfid_code: rfidCode,
    session_token: userData.session_token
  });

  // Redirect to admin page (no sensitive data in URL)
  window.location.href = 'admin.html';
};

const callbackLoginFailed = (error) => {
  console.error('Login error:', error);
  const errorMessage = error.message || error.detail || 'Login failed. Please check your details and try again.';
  showErrorMessage(errorMessage);
};
// #endregion

// #region *** Auto-login Check ***********
const checkAutoLogin = async () => {
  if (await AdminSession.isValid()) {
    const session = AdminSession.get();
    console.log(`Auto-logging in admin: ${session.first_name} ${session.last_name}`);
    // Extend the session since user is active
    AdminSession.extend();
    // Redirect to admin page
    window.location.href = 'admin.html';
    return true;
  }
  return false;
};
// #endregion

// #region *** Session Activity Tracking ***********
const listenToSessionActivity = () => {
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  
  const handleActivity = debounce(() => {
    if (AdminSession.isValid()) {
      AdminSession.extend();
    }
  }, 1000);

  activityEvents.forEach(event => {
    document.addEventListener(event, handleActivity, { passive: true });
  });
};

const debounce = (func, delay) => {
  let timeoutId;
  return function() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, arguments), delay);
  };
};
// #endregion

// #region *** Logout functionality ***********
const logout = () => {
  AdminSession.clear();
  window.location.href = 'login.html';
};

// Expose logout function globally for use in admin pages
window.adminLogout = logout;
// #endregion

// #region *** Session Data Retrieval ***********
const getCurrentAdminSession = async () => {
  if (!await AdminSession.isValid()) {
    // Session expired, redirect to login
    window.location.href = 'login.html';
    return null;
  }
  
  AdminSession.extend(); // Extend session on access
  return AdminSession.get();
};

// Expose session function globally for use in admin pages
window.getCurrentAdminSession = getCurrentAdminSession;
// #endregion

// #region *** Initialization ***********
const initLogin = async () => {
  // Check for auto-login first
  if (await checkAutoLogin()) {
    return; // Will redirect, no need to initialize login form
  }

  // Initialize CSRF token
  await SecurityUtils.getCSRFToken();

  // Only initialize if the login form is present on the page
  if (document.querySelector('.js-login-form')) {
    listenToLogin();
    listenToSessionActivity();
    
    // Clear any existing error messages on page load
    if (domLogin.errorMessage) {
      domLogin.errorMessage.textContent = '';
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize based on current page
  if (window.location.pathname.includes('login.html')) {
    await initLogin();
  } else if (window.location.pathname.includes('admin.html')) {
    // For admin pages, check if session is valid
    if (!await AdminSession.isValid()) {
      window.location.href = 'login.html';
    }
  }
});

// Clear session on browser close if desired
window.addEventListener('beforeunload', () => {
  // Optional: Uncomment if you want to clear session on browser close
  // AdminSession.clear();
});
// #endregion