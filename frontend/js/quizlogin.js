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
            // console.log('Attempting auto-login for:', firstName, lastName);
            
            const formData = { firstName, lastName, password };

            try {
                const result = await this.sendAuthenticationRequest('login', firstName, lastName, password);
                
                if (result && result.user_id) {
                    this.loginUser(formData, result.user_id);
                    // console.log('Auto-login successful');
                    return true;
                } else {
                    console.warn('Auto-login failed: Invalid response from server');
                    this.clearStoredCredentials();
                    return false;
                }
            } catch (error) {
                console.error('Auto-login error:', error.message || error);
                // Don't show error message for auto-login failures, just clear and show modal
                this.clearStoredCredentials();
                return false;
            }
        } else {
            // console.log('No stored credentials found for auto-login');
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
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            errorContainer.classList.add('error-shake');
            
            // Remove shake animation after it completes
            setTimeout(() => {
                errorContainer.classList.remove('error-shake');
            }, 300);
            
            // Auto-hide after 6 seconds (longer for better UX)
            setTimeout(() => {
                if (errorContainer.textContent === message) {
                    errorContainer.style.display = 'none';
                }
            }, 6000);
        } else {
            // Fallback: create error message if container doesn't exist
            console.error('Error container not found, message:', message);
            alert(message);
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

        // Clear any existing error styling
        [firstNameInput, lastNameInput, passwordInput].forEach(input => {
            if (input) input.classList.remove('error');
        });

        // Validate first name
        if (!firstName) {
            this.showError('First name is required');
            if (firstNameInput) firstNameInput.classList.add('error');
            return null;
        }
        if (firstName.length < 1) {
            this.showError('First name must be at least 1 character long');
            if (firstNameInput) firstNameInput.classList.add('error');
            return null;
        }
        if (firstName.length > 50) {
            this.showError('First name must be 50 characters or less');
            if (firstNameInput) firstNameInput.classList.add('error');
            return null;
        }

        // Validate last name
        if (!lastName) {
            this.showError('Last name is required');
            if (lastNameInput) lastNameInput.classList.add('error');
            return null;
        }
        if (lastName.length < 1) {
            this.showError('Last name must be at least 1 character long');
            if (lastNameInput) lastNameInput.classList.add('error');
            return null;
        }
        if (lastName.length > 50) {
            this.showError('Last name must be 50 characters or less');
            if (lastNameInput) lastNameInput.classList.add('error');
            return null;
        }

        // Validate password
        if (!password) {
            this.showError('Password is required');
            if (passwordInput) passwordInput.classList.add('error');
            return null;
        }
        if (password.length < 8) {
            this.showError('Password must be at least 8 characters long');
            if (passwordInput) passwordInput.classList.add('error');
            return null;
        }
        
        // Additional password strength checks
        if (!/[a-zA-Z]/.test(password)) {
            this.showError('Password must contain at least one letter');
            if (passwordInput) passwordInput.classList.add('error');
            return null;
        }
        
        // Store credentials for auto-login only after validation
        localStorage.setItem(STORAGE_KEYS.USER.FIRST_NAME, firstName);
        localStorage.setItem(STORAGE_KEYS.USER.LAST_NAME, lastName);
        localStorage.setItem(STORAGE_KEYS.USER.PASSWORD, password);

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
            const errorMessage = error.message || 'Login failed. Please check your credentials.';
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
        // console.log(formData)
        try {
            const result = await this.sendAuthenticationRequest('register', formData.firstName, formData.lastName, formData.password);
            
            if (result && result.user_id) {
                this.registerUser(formData, result.user_id);
            } else {
                this.showError('Registration failed: Unexpected response from server.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            const errorMessage = error.message || 'Registration failed. User may already exist or password is too weak.';
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
                let errorData;
                try {
                    errorData = await response.json();
                } catch (parseError) {
                    // If JSON parsing fails, create a generic error
                    throw new Error(`Server error (${response.status}): ${response.statusText}`);
                }
                
                // Handle different error response formats
                let errorMessage = 'Unknown server error';
                
                if (typeof errorData === 'string') {
                    errorMessage = errorData;
                } else if (errorData && typeof errorData === 'object') {
                    // Try different possible error message fields
                    errorMessage = errorData.detail || 
                                 errorData.message || 
                                 errorData.error || 
                                 errorData.msg ||
                                 (errorData.detail && errorData.detail[0] && errorData.detail[0].msg) || // FastAPI validation errors
                                 JSON.stringify(errorData);
                    
                    // Handle FastAPI validation errors (422 status)
                    if (response.status === 422 && errorData.detail && Array.isArray(errorData.detail)) {
                        const validationErrors = errorData.detail.map(err => {
                            const field = err.loc && err.loc.length > 1 ? err.loc[err.loc.length - 1] : 'field';
                            return `${field}: ${err.msg}`;
                        }).join(', ');
                        errorMessage = `Validation error: ${validationErrors}`;
                    }
                }
                
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            // Re-throw with proper error message handling
            if (error instanceof Error) {
                throw error;
            } else if (typeof error === 'object' && error !== null) {
                // Handle cases where error is an object but not an Error instance
                const errorMessage = error.detail || error.message || error.error || 'Network or server error';
                throw new Error(errorMessage);
            } else {
                throw new Error('Network or server error');
            }
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
        
        // Only reload if quiz session isn't properly loaded
        this.checkAndReloadIfNeeded();
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
        
        // Only reload if quiz session isn't properly loaded
        this.checkAndReloadIfNeeded();
    }

    checkAndReloadIfNeeded() {
        // Check if we've already done a reload for this session to prevent multiple reloads
        const reloadKey = 'quiz_reload_attempted';
        const lastReloadTime = sessionStorage.getItem(reloadKey);
        const now = Date.now();
        
        // If we reloaded less than 30 seconds ago, skip any reload attempts
        if (lastReloadTime && (now - parseInt(lastReloadTime)) < 30000) {
            // console.log('Recent reload detected, skipping reload check to prevent reload loop');
            return;
        }
        
        // Single check after giving systems time to initialize
        setTimeout(() => {
            // console.log('Performing single quiz state check...');
            
            // Only check for the most critical issue: stuck on session 2
            const sessionSelector = document.querySelector('select');
            if (sessionSelector && sessionSelector.value === '2') {
                // console.log('Detected stuck on session 2, performing ONE reload...');
                
                // Mark that we're about to reload
                sessionStorage.setItem(reloadKey, now.toString());
                
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                // console.log('Quiz session appears to be working correctly, no reload needed.');
            }
        }, 2000); // Give more time for systems to initialize
    }

    shouldReloadPage() {
        // Check various conditions that indicate the quiz isn't properly loaded
        
        // 1. Check if chat system has a session ID
        if (window.chatSystemInstance) {
            const chatSessionId = window.chatSystemInstance.getSessionId();
            // console.log('Chat session ID:', chatSessionId);
            if (!chatSessionId || chatSessionId === 2) {
                // console.log('Chat system has no valid session ID, needs reload');
                return true;
            }
        }
        
        // 2. Check if we're stuck on session 2 (common issue) 
        const sessionSelector = document.querySelector('select');
        if (sessionSelector && sessionSelector.value === '2') {
            // console.log('Detected stuck on session 2, needs reload');
            return true;
        }
        
        // 3. Check if QuizApp is properly initialized
        if (!window.quizApp) {
            // console.log('QuizApp not found, needs reload');
            return true;
        }
        
        // 4. Check if current user is properly set in QuizApp
        const quizAppUser = window.quizApp.getCurrentUser();
        if (!quizAppUser || !quizAppUser.id) {
            // console.log('QuizApp has no current user, needs reload');
            return true;
        }
        
        // 5. Check if socket connection exists and is connected
        if (window.socket && !window.socket.connected) {
            // console.log('Socket not connected, needs reload');
            return true;
        }
        
        // 6. Check for critical quiz elements (but be less strict)
        const quizContainer = document.querySelector('.c-quiz-container, #quiz-container, [data-quiz-container]');
        if (!quizContainer) {
            // console.log('No quiz container found, needs reload');
            return true;
        }
        
        // 7. Check for active session in chat system
        if (window.chatSystemInstance && typeof window.chatSystemInstance.canChat === 'function') {
            if (!window.chatSystemInstance.canChat()) {
                // console.log('Chat system cannot chat (user not properly set), needs reload');
                return true;
            }
        }
        
        // If all checks pass, no reload needed
        return false;
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