// #region ***  DOM references                           ***********
const domLogin = {
    adminBtn: document.querySelector('.js-login-admin'),
    userBtn: document.querySelector('.js-login-user'),
    loginForm: document.querySelector('.js-login-form'),
    rfidInput: document.querySelector('.js-rfid-input'),
    errorMessage: document.querySelector('.js-error-message')
};
// #endregion

// #region ***  Callback-Visualisation - show___         ***********
const showErrorMessage = (message) => {
    if (domLogin.errorMessage) {
        domLogin.errorMessage.textContent = message;
        domLogin.errorMessage.classList.add('is-visible');
        setTimeout(() => {
            domLogin.errorMessage.classList.remove('is-visible');
        }, 5000);
    }
};

const showLoadingState = (button, isLoading) => {
    if (button) {
        button.disabled = isLoading;
        button.innerHTML = isLoading ? 
            '<span class="c-loading-spinner"></span> Loading...' : 
            button.dataset.originalText;
    }
};
// #endregion

// #region ***  Callback-No Visualisation - callback___  ***********
const callbackAdminLoginSuccess = () => {
    window.location.href = 'admin.html';
};

const callbackUserLoginSuccess = () => {
    window.location.href = 'create.html';
};

const callbackLoginFailed = (error) => {
    console.error('Login error:', error);
    showErrorMessage('Login failed. Please try again.');
};
// #endregion

// #region ***  Data Access - get___                     ***********
const getAdminCredentials = async (rfid) => {
    try {
        // In a real implementation, this would fetch from your API
        return {
            isValid: rfid.length === 1, // Example validation
            isAdmin: true
        };
    } catch (error) {
        throw new Error('Failed to verify admin credentials');
    }
};

const getUserCredentials = async (rfid) => {
    try {
        // In a real implementation, this would fetch from your API
        return {
            isValid: rfid.length === 1, // Example validation
            isAdmin: false
        };
    } catch (error) {
        throw new Error('Failed to verify user credentials');
    }
};
// #endregion

// #region ***  Event Listeners - listenTo___            ***********
const listenToAdminLogin = () => {
    if (domLogin.adminBtn) {
        domLogin.adminBtn.dataset.originalText = domLogin.adminBtn.textContent;
        domLogin.adminBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            showLoadingState(domLogin.adminBtn, true);
            
            try {
                const rfid = domLogin.rfidInput?.value;
                if (!rfid) {
                    showErrorMessage('Please scan your RFID badge');
                    return;
                }
                
                const credentials = await getAdminCredentials(rfid);
                if (credentials.isValid && credentials.isAdmin) {
                    callbackAdminLoginSuccess();
                } else {
                    showErrorMessage('Invalid admin credentials');
                }
            } catch (error) {
                callbackLoginFailed(error);
            } finally {
                showLoadingState(domLogin.adminBtn, false);
            }
        });
    }
};

const listenToUserLogin = () => {
    if (domLogin.userBtn) {
        domLogin.userBtn.dataset.originalText = domLogin.userBtn.textContent;
        domLogin.userBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            showLoadingState(domLogin.userBtn, true);
            
            try {
                const rfid = domLogin.rfidInput?.value;
                if (!rfid) {
                    showErrorMessage('Please scan your RFID badge');
                    return;
                }
                
                const credentials = await getUserCredentials(rfid);
                if (credentials.isValid) {
                    callbackUserLoginSuccess();
                } else {
                    showErrorMessage('Invalid user credentials');
                }
            } catch (error) {
                callbackLoginFailed(error);
            } finally {
                showLoadingState(domLogin.userBtn, false);
            }
        });
    }
};

const listenToRFIDScanner = () => {
    if (domLogin.rfidInput) {
        // Simulate RFID scanner input for demo purposes
        domLogin.rfidInput.addEventListener('change', (e) => {
            console.log('RFID scanned:', e.target.value);
        });
    }
};
// #endregion

// #region ***  Init / DOMContentLoaded                  ***********
const initLogin = () => {
    if (!document.querySelector('.js-login-form')) return;
    
    // Store original button texts
    const adminBtn = document.querySelector('.js-login-admin');
    const userBtn = document.querySelector('.js-login-user');
    
    if (adminBtn) adminBtn.dataset.originalText = adminBtn.textContent;
    if (userBtn) userBtn.dataset.originalText = userBtn.textContent;
    
    listenToAdminLogin();
    listenToUserLogin();
    listenToRFIDScanner();
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('login.html')) {
        initLogin();
    }
});
// #endregion