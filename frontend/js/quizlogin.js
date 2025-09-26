// Authentication System
const STORAGE_KEYS = {
    USER: {
        USER_ID: 'user_user_id',
        FIRST_NAME: 'user_first_name',
        LAST_NAME: 'user_last_name',
        PASSWORD: 'user_password'
    }
};

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.lanIP = `https://${window.location.hostname}`;
        this.init();
    }

    init() {
        this.createAuthModal();
        this.bindEvents();
        
        // Try auto-login first, only show modal if it fails
        this.autoLogin().then(success => {
            if (!success) {
                this.showAuthModal();
            }
        }).catch(error => {
            console.error('Auto-login attempt failed:', error);
            this.showAuthModal();
        });
    }

    async autoLogin() {
        const firstName = localStorage.getItem(STORAGE_KEYS.USER.FIRST_NAME);
        const lastName = localStorage.getItem(STORAGE_KEYS.USER.LAST_NAME);
        const password = localStorage.getItem(STORAGE_KEYS.USER.PASSWORD);

        if (firstName && lastName && password) {
            console.log('Attempting auto-login for:', firstName, lastName);
            
            const formData = { firstName, lastName, password };

            try {
                const result = await this.sendAuthenticationRequest('login', firstName, lastName, password);
                
                if (result && result.user_id) {
                    this.loginUser(formData, result.user_id);
                    console.log('Auto-login successful');
                    return true;
                } else {
                    console.warn('Auto-login failed: Invalid response from server');
                    this.clearStoredCredentials();
                    return false;
                }
            } catch (error) {
                console.error('Auto-login error:', error);
                this.clearStoredCredentials();
                return false;
            }
        } else {
            console.log('No stored credentials found for auto-login');
            return false;
        }
    }

    clearStoredCredentials() {
        localStorage.removeItem(STORAGE_KEYS.USER.FIRST_NAME);
        localStorage.removeItem(STORAGE_KEYS.USER.LAST_NAME);
        localStorage.removeItem(STORAGE_KEYS.USER.PASSWORD);
        localStorage.removeItem(STORAGE_KEYS.USER.USER_ID);
    }

    createAuthModal() {
        const modalHTML = `
            <div id="authModal" class="c-modal" style="display: block;">
                <div class="c-modal__content">
                    <h2 id="authModalTitle">Join <a href="../index.html" class="c-header__link gamepad">Quiz The Spire</a> Session</h2>
                    <form id="authForm" class="c-login-form">
                        <div class="c-error-message" id="authError"></div>
                        
                        <input type="text" id="firstName" class="c-login-input" 
                               placeholder="First Name" required>
                        
                        <input type="text" id="lastName" class="c-login-input" 
                               placeholder="Last Name" required>
                        
                        <input type="password" id="password" class="c-login-input" 
                               placeholder="Password" required>
                        
                        <div class="o-button-group">
                            <button type="button" id="loginBtn" class="c-btn c-btn--primary">
                                <span class="button-text">Login</span>
                            </button>
                            <button type="button" id="registerBtn" class="c-btn c-btn--secondary">
                                <span class="button-text">Register</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    bindEvents() {
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const authForm = document.getElementById('authForm');

        if (!loginBtn || !registerBtn || !authForm) {
            console.error("Auth modal buttons or form not found.");
            return;
        }

        loginBtn.addEventListener('click', (e) => this.handleLogin(e));
        registerBtn.addEventListener('click', (e) => this.handleRegister(e));

        // Prevent default form submission
        authForm.addEventListener('submit', (e) => e.preventDefault());

        // Allow Enter key to trigger login
        authForm.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLogin(e);
            }
        });
    }

    showAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) modal.style.display = 'block';
    }

    hideAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) modal.style.display = 'none';
    }

    showError(message) {
        const errorEl = document.getElementById('authError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('is-visible');
            setTimeout(() => {
                errorEl.classList.remove('is-visible');
                errorEl.textContent = '';
            }, 5000);
        }
    }

    showLoading(button) {
        const buttonText = button.querySelector('.button-text');
        if (buttonText) {
            buttonText.innerHTML = '<span class="c-loading-spinner"></span>Processing...';
        }
        button.disabled = true;
    }

    hideLoading(button, originalText) {
        const buttonText = button.querySelector('.button-text');
        if (buttonText) {
            buttonText.textContent = originalText;
        }
        button.disabled = false;
    }

    validateForm() {
        const firstNameInput = document.getElementById('firstName');
        const lastNameInput = document.getElementById('lastName');
        const passwordInput = document.getElementById('password');

        const firstName = firstNameInput ? firstNameInput.value.trim() : '';
        const lastName = lastNameInput ? lastNameInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        // Store credentials for auto-login
        localStorage.setItem(STORAGE_KEYS.USER.FIRST_NAME, firstName);
        localStorage.setItem(STORAGE_KEYS.USER.LAST_NAME, lastName);
        localStorage.setItem(STORAGE_KEYS.USER.PASSWORD, password);

        if (!firstName) {
            this.showError('First name is required');
            return null;
        }
        if (!lastName) {
            this.showError('Last name is required');
            return null;
        }
        if (!password) {
            this.showError('Password is required');
            return null;
        }
        return { firstName, lastName, password };
    }

    async handleLogin(e) {
        e.preventDefault();
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');

        const formData = this.validateForm();
        if (!formData) return;

        this.showLoading(loginBtn);
        registerBtn.disabled = true;

        try {
            const result = await this.sendAuthenticationRequest('login', formData.firstName, formData.lastName, formData.password);
            
            if (result && result.user_id) {
                this.loginUser(formData, result.user_id);
            } else {
                this.showError('Login failed: Invalid response from server.');
            }
        } catch (error) {
            console.error('Login error:', error);
            const errorMessage = error.detail || 'Login failed. Please check your credentials.';
            this.showError(errorMessage);
        } finally {
            this.hideLoading(loginBtn, 'Login');
            registerBtn.disabled = false;
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const registerBtn = document.getElementById('registerBtn');
        const loginBtn = document.getElementById('loginBtn');

        const formData = this.validateForm();
        if (!formData) return;

        this.showLoading(registerBtn);
        loginBtn.disabled = true;
        console.log(formData)
        try {
            const result = await this.sendAuthenticationRequest('register', formData.firstName, formData.lastName, formData.password);
            
            if (result && result.user_id) {
                this.registerUser(formData, result.user_id);
            } else {
                this.showError('Registration failed: Unexpected response from server.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            const errorMessage = error.detail || 'Registration failed. User may already exist or password is too weak.';
            this.showError(errorMessage);
        } finally {
            this.hideLoading(registerBtn, 'Register');
            loginBtn.disabled = false;
        }
    }

    async sendAuthenticationRequest(endpoint, firstName, lastName, password) {
        try {
            const response = await fetch(`${this.lanIP}/api/v1/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    password: password,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw errorData;
            }

            return await response.json();
        } catch (error) {
            throw error;
        }
    }

    loginUser(userData, userId) {
        this.currentUser = {
            id: userId,
            firstName: userData.firstName,
            lastName: userData.lastName,
            fullName: `${userData.firstName} ${userData.lastName}`,
            key: `${userData.firstName}_${userData.lastName}`,
            score: 0,
            lp: 4,
            sp: 4,
        };

        localStorage.setItem(STORAGE_KEYS.USER.USER_ID, userId);
        
        this.hideAuthModal();
        this.notifyUserAuthenticated(this.currentUser);
        this.showWelcomeMessage(this.currentUser);
    }

    registerUser(userData, userId) {
        const newUser = {
            id: userId,
            firstName: userData.firstName,
            lastName: userData.lastName,
            fullName: `${userData.firstName} ${userData.lastName}`,
            key: `${userData.firstName}_${userData.lastName}`,
            score: 0,
            lp: 4,
            sp: 4,
        };

        localStorage.setItem(STORAGE_KEYS.USER.USER_ID, userId);

        this.currentUser = newUser;
        this.hideAuthModal();
        this.notifyUserAuthenticated(newUser);
        this.showWelcomeMessage(newUser);
        
        // Notify chat system about new user
        document.dispatchEvent(new CustomEvent('userRegistered', {
            detail: { user: newUser }
        }));
    }

    notifyUserAuthenticated(user) {
        // Dispatch event for other modules to listen to
        document.dispatchEvent(new CustomEvent('userAuthenticated', {
            detail: { user }
        }));
    }

    showWelcomeMessage(user) {
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'c-welcome-message';
        welcomeMsg.style.position = 'fixed';
        welcomeMsg.style.top = '20px';
        welcomeMsg.style.right = '20px';
        welcomeMsg.style.zIndex = '1000';
        welcomeMsg.style.maxWidth = '300px';
        welcomeMsg.innerHTML = `
            <strong>Welcome, ${user.fullName}!</strong>
            <p>You have joined the quiz session. Good luck!</p>
        `;

        document.body.appendChild(welcomeMsg);

        setTimeout(() => {
            if (welcomeMsg.parentNode) {
                welcomeMsg.parentNode.removeChild(welcomeMsg);
            }
        }, 5000);
    }

    logout() {
        this.clearStoredCredentials();
        this.currentUser = null;
        
        // Notify other modules
        document.dispatchEvent(new CustomEvent('userLoggedOut'));
        
        this.showAuthModal();
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// Export for use in other scripts
window.AuthSystem = AuthSystem;
window.STORAGE_KEYS = STORAGE_KEYS;