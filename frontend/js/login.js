// #region *** DOM references ***********
const lanIP = `http://${window.location.hostname}:8000`; // Assuming your backend is on the same host, port 8000
const domLogin = {
  loginBtn: document.querySelector('.js-login-admin'),
  loginForm: document.querySelector('.js-login-form'),
  firstnameInput: document.querySelector('.js-user-input'), // Changed from usernameInput
  lastnameInput: document.querySelector('.js-user-input-2'),
  rfidInput: document.querySelector('.js-rfid-input'),
  errorMessage: document.querySelector('.js-error-message'),
};
// #endregion

// #region *** Callback-Visualisation - show___ ***********
const showErrorMessage = (message) => {
  if (domLogin.errorMessage) {
    domLogin.errorMessage.textContent = message;
    domLogin.errorMessage.classList.add('is-visible');
    setTimeout(() => {
      domLogin.errorMessage.classList.remove('is-visible');
      domLogin.errorMessage.textContent = ''; // Clear message after hiding
    }, 5000);
  }
};

const showLoadingState = (button, isLoading) => {
  if (button) {
    button.disabled = isLoading;
    // Store original text if not already stored
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }
    button.innerHTML = isLoading ? '<span class="c-loading-spinner"></span> Loading...' : button.dataset.originalText;
  }
};
// #endregion

// #region *** Callback-No Visualisation - callback___ ***********
const callbackLoginSuccess = (userId, rfidCode) => {
  // Redirect to admin.html with user ID and RFID in URL for verification
  window.location.href = `admin.html?userId=${userId}&rfid=${rfidCode}`;
};

const callbackLoginFailed = (error) => {
  console.error('Login error:', error);
  // Display a more specific error message if available from the backend
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
      // If the response is not OK, parse the error message from the backend
      const errorData = await response.json();
      throw errorData; // Throw the error object containing 'detail'
    }

    return await response.json(); // This should contain { "user_id": <id> }
  } catch (error) {
    // Re-throw to be caught by the calling function
    throw error;
  }
};
// #endregion

// #region *** Event Listeners - listenTo___ ***********
const listenToLogin = () => {
  if (domLogin.loginBtn && domLogin.firstnameInput && domLogin.lastnameInput && domLogin.rfidInput) {
    // Ensure original text is stored when the button is available
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
        
        // Backend now returns {"user_id": X} on success
        if (result && result.user_id) {
          callbackLoginSuccess(result.user_id, rfid);
        } else {
          // This case should ideally be caught by !response.ok, but as a fallback
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
    // This listener just logs the change, the actual processing happens on button click
    domLogin.rfidInput.addEventListener('change', (e) => {
      console.log('RFID input changed:', e.target.value);
    });
  }
};
// #endregion

// #region *** Init / DOMContentLoaded ***********
const initLogin = () => {
  // Only initialize if the login form is present on the page
  if (document.querySelector('.js-login-form')) {
    listenToLogin();
    listenToRFIDScanner();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('login.html')) {
    initLogin();
  }
});
// #endregion