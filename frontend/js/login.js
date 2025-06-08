// #region *** Constants and Storage Keys ***********
const lanIP = `http://${window.location.hostname}:8000`;

// Separate storage keys for admin vs regular user identification
const STORAGE_KEYS = {
  ADMIN: {
    USER_ID: 'admin_user_id',
    FIRST_NAME: 'admin_first_name', 
    LAST_NAME: 'admin_last_name',
    RFID_CODE: 'admin_rfid_code',
    LOGIN_TIMESTAMP: 'admin_login_timestamp'
  }
};

// Session timeout (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;
// #endregion

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

// #region *** Session Management ***********
const AdminSession = {
  // Store admin credentials securely
  store: (userData) => {
    const timestamp = Date.now();
    sessionStorage.setItem(STORAGE_KEYS.ADMIN.USER_ID, userData.user_id.toString());
    sessionStorage.setItem(STORAGE_KEYS.ADMIN.FIRST_NAME, userData.first_name);
    sessionStorage.setItem(STORAGE_KEYS.ADMIN.LAST_NAME, userData.last_name);
    sessionStorage.setItem(STORAGE_KEYS.ADMIN.RFID_CODE, userData.rfid_code);
    sessionStorage.setItem(STORAGE_KEYS.ADMIN.LOGIN_TIMESTAMP, timestamp.toString());
  },

  // Retrieve admin session data
  get: () => {
    const userId = sessionStorage.getItem(STORAGE_KEYS.ADMIN.USER_ID);
    const firstName = sessionStorage.getItem(STORAGE_KEYS.ADMIN.FIRST_NAME);
    const lastName = sessionStorage.getItem(STORAGE_KEYS.ADMIN.LAST_NAME);
    const rfidCode = sessionStorage.getItem(STORAGE_KEYS.ADMIN.RFID_CODE);
    const timestamp = sessionStorage.getItem(STORAGE_KEYS.ADMIN.LOGIN_TIMESTAMP);

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

  // Check if session is valid (not expired)
  isValid: () => {
    const session = AdminSession.get();
    if (!session) return false;

    const now = Date.now();
    const sessionAge = now - session.login_timestamp;
    
    return sessionAge < SESSION_TIMEOUT;
  },

  // Clear admin session
  clear: () => {
    Object.values(STORAGE_KEYS.ADMIN).forEach(key => {
      sessionStorage.removeItem(key);
    });
  },

  // Extend session (update timestamp)
  extend: () => {
    if (AdminSession.isValid()) {
      sessionStorage.setItem(STORAGE_KEYS.ADMIN.LOGIN_TIMESTAMP, Date.now().toString());
    }
  }
};
// #endregion

// #region *** Auto-login Check ***********
const checkAutoLogin = () => {
  if (AdminSession.isValid()) {
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

// #region *** Callback-No Visualisation - callback___ ***********
const callbackLoginSuccess = (userData, rfidCode) => {
  // Store credentials securely in sessionStorage
  AdminSession.store({
    user_id: userData.user_id,
    first_name: userData.first_name || domLogin.firstnameInput.value.trim(),
    last_name: userData.last_name || domLogin.lastnameInput.value.trim(),
    rfid_code: rfidCode
  });

  // Redirect to admin page (no sensitive data in URL)
  window.location.href = 'admin.html';
};

const callbackLoginFailed = (error) => {
  console.error('Login error:', error);
  const errorMessage = error.detail || 'Login failed. Please check your details and try again.';
  showErrorMessage(errorMessage);
};
// #endregion

// #region *** Data Access - send___ ***********
const sendLoginCredentials = async (firstName, lastName, rfid) => {
  try {
    const response = await fetch(`${lanIP}/api/v1/users/${rfid}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw errorData;
    }

    const result = await response.json();
    // Ensure we return the names as well for storage
    return {
      ...result,
      first_name: firstName,
      last_name: lastName
    };
  } catch (error) {
    throw error;
  }
};
// #endregion

// #region *** Event Listeners - listenTo___ ***********
const listenToLogin = () => {
  if (domLogin.loginBtn && domLogin.firstnameInput && domLogin.lastnameInput && domLogin.rfidInput) {
    domLogin.loginBtn.dataset.originalText = domLogin.loginBtn.textContent;

    domLogin.loginBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      showLoadingState(domLogin.loginBtn, true);

      try {
        const firstName = domLogin.firstnameInput.value.trim();
        const lastName = domLogin.lastnameInput.value.trim();
        const rfid = domLogin.rfidInput.value.trim();

        if (!firstName || !lastName || !rfid) {
          showErrorMessage('Please enter your first name, last name, and scan your RFID badge.');
          return;
        }

        const result = await sendLoginCredentials(firstName, lastName, rfid);
        
        if (result && result.user_id) {
          callbackLoginSuccess(result, rfid);
        } else {
          showErrorMessage('Login failed: Unexpected response from server.');
        }
      } catch (error) {
        callbackLoginFailed(error);
      } finally {
        showLoadingState(domLogin.loginBtn, false);
      }
    });
  } else {
    console.warn("Login DOM elements not fully available. Login button or inputs might be missing.");
  }
};

const listenToRFIDScanner = () => {
  if (domLogin.rfidInput) {
    domLogin.rfidInput.addEventListener('change', (e) => {
      console.log('RFID input changed:', e.target.value);
    });
  }
};

// Listen for session extension on user activity
const listenToSessionActivity = () => {
  ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, () => {
      if (AdminSession.isValid()) {
        AdminSession.extend();
      }
    }, { passive: true });
  });
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

// #region *** Init / DOMContentLoaded ***********
const initLogin = () => {
  // Check for auto-login first
  if (checkAutoLogin()) {
    return; // Will redirect, no need to initialize login form
  }

  // Only initialize if the login form is present on the page
  if (document.querySelector('.js-login-form')) {
    listenToLogin();
    listenToRFIDScanner();
    listenToSessionActivity();
  }
};

// Function to get current admin session (for use in admin pages)
const getCurrentAdminSession = () => {
  if (!AdminSession.isValid()) {
    // Session expired, redirect to login
    window.location.href = 'login.html';
    return null;
  }
  AdminSession.extend(); // Extend session on access
  return AdminSession.get();
};

// Expose session function globally for use in admin pages
window.getCurrentAdminSession = getCurrentAdminSession;

document.addEventListener('DOMContentLoaded', () => {
  const storedIP = sessionStorage.getItem('IP');
  console.log('Stored IP:', storedIP);
  if (window.location.pathname.includes('login.html')) {
    initLogin();
  } else if (window.location.pathname.includes('admin.html')) {
    // For admin pages, check if session is valid
    if (!AdminSession.isValid()) {
      window.location.href = 'login.html';
    }
  }
});
// #endregion

// #region *** Session cleanup on page unload ***********
window.addEventListener('beforeunload', () => {
  // Optional: Clear session on browser close (comment out if you want persistence across browser sessions)
  // AdminSession.clear();
});
// #endregion