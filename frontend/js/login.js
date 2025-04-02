// #region *** DOM references ***********
const domLogin = {
    loginBtn: document.querySelector('.js-login-admin'),
    loginForm: document.querySelector('.js-login-form'),
    usernameInput: document.querySelector('.js-user-input'),
    rfidInput: document.querySelector('.js-rfid-input'),
    errorMessage: document.querySelector('.js-error-message')
};
// #endregion

// #region *** Callback-Visualisation - show___ ***********
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

// #region *** Callback-No Visualisation - callback___ ***********
const callbackLoginSuccess = () => {
    // All users go to the same page, backend controls permissions
    window.location.href = 'admin.html';
};

const callbackLoginFailed = (error) => {
    console.error('Login error:', error);
    showErrorMessage('Login failed. Please try again.');
};
// #endregion

// #region *** Data Access - get___ ***********
const getCredentials = async (username, rfid) => {
    try {
        // In a real implementation, this would fetch from your API
        // The backend would handle access control based on the credentials
        // Example API call:
        // const response = await fetch('/api/login', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ username, rfid })
        // });
        // return await response.json();
        
        // Placeholder implementation - just check if values exist
        return {
            isValid: username.length > 0 && rfid.length > 0
        };
    } catch (error) {
        throw new Error('Failed to verify credentials');
    }
};
// #endregion

// #region *** Event Listeners - listenTo___ ***********
const listenToLogin = () => {
    if (domLogin.loginBtn) {
        domLogin.loginBtn.dataset.originalText = domLogin.loginBtn.textContent;
        domLogin.loginBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            showLoadingState(domLogin.loginBtn, true);
            
            try {
                const username = domLogin.usernameInput?.value.trim();
                const rfid = domLogin.rfidInput?.value.trim();
                
                if (!username || !rfid) {
                    showErrorMessage('Please enter your username and scan your RFID badge');
                    return;
                }
                
                const credentials = await getCredentials(username, rfid);
                if (credentials.isValid) {
                    callbackLoginSuccess();
                } else {
                    showErrorMessage('Invalid credentials');
                }
            } catch (error) {
                callbackLoginFailed(error);
            } finally {
                showLoadingState(domLogin.loginBtn, false);
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

// #region *** Init / DOMContentLoaded ***********
const initLogin = () => {
    if (!document.querySelector('.js-login-form')) return;
    
    // Store original button text
    const loginBtn = document.querySelector('.js-login-admin');
    
    if (loginBtn) loginBtn.dataset.originalText = loginBtn.textContent;
    
    listenToLogin();
    listenToRFIDScanner();
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('login.html')) {
        initLogin();
    }
});
// #endregion
