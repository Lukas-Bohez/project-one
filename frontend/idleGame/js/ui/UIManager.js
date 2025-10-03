class UIManager {
    constructor(gameEngine) {
        console.log('UIManager constructor called');
        this.gameEngine = gameEngine;
        this.isLoginMode = true;
        this.isLoggedIn = false;
        this.currentUser = null;
        
        // Delay initialization to ensure DOM is ready
        setTimeout(() => {
            this.init();
        }, 100);
    }

    init() {
        console.log('UIManager init called');
        this.checkLoginStatus(); // Check if user is already logged in
        this.bindEvents();
        this.updateAuthButtons();
        console.log('UIManager initialization complete');
    }

    checkLoginStatus() {
        // Check if player data exists in SaveManager
        if (!this.gameEngine.saveManager) {
            console.warn('SaveManager not initialized yet');
            this.isLoggedIn = false;
            return;
        }
        
        // Check actual authentication status
        if (this.gameEngine.saveManager.isAuthenticated) {
            this.isLoggedIn = true;
            this.currentUser = this.gameEngine.saveManager.username;
            console.log('User already logged in:', this.currentUser);
        } else {
            this.isLoggedIn = false;
            this.currentUser = null;
        }
    }

    bindEvents() {
        // Modal controls
        const modal = document.getElementById('auth-modal');
        const closeBtn = document.getElementById('close-auth');
        const loginToggleBtn = document.getElementById('login-toggle-btn');

        console.log('UIManager bindEvents - Elements found:', {
            modal: !!modal,
            closeBtn: !!closeBtn,
            loginToggleBtn: !!loginToggleBtn
        });

        if (!loginToggleBtn) {
            console.error('Login toggle button not found! Expected element with id "login-toggle-btn"');
            return;
        }

        // Open modal
        loginToggleBtn.addEventListener('click', () => {
            console.log('Login button clicked, isLoggedIn:', this.isLoggedIn);
            if (this.isLoggedIn) {
                this.showLogoutConfirmation();
            } else {
                this.showAuthModal();
            }
        });

        // Close modal
        closeBtn.addEventListener('click', () => this.hideAuthModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideAuthModal();
        });

        // Auth form controls
        document.getElementById('login-btn').addEventListener('click', () => this.handleLogin());
        document.getElementById('register-btn').addEventListener('click', () => this.handleRegister());
        document.getElementById('toggle-register').addEventListener('click', () => this.switchToRegister());
        document.getElementById('toggle-login').addEventListener('click', () => this.switchToLogin());

        // Game controls
        document.getElementById('save-btn').addEventListener('click', () => this.handleSave());
        document.getElementById('load-btn').addEventListener('click', () => this.handleLoad());
        document.getElementById('reset-btn').addEventListener('click', () => this.handleReset());

        // Handle Enter key in form
        const formInputs = ['username', 'password', 'email'];
        formInputs.forEach(id => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (this.isLoginMode) {
                        this.handleLogin();
                    } else {
                        this.handleRegister();
                    }
                }
            });
        });
    }

    showAuthModal() {
        document.getElementById('auth-modal').style.display = 'block';
        document.getElementById('username').focus();
    }

    hideAuthModal() {
        document.getElementById('auth-modal').style.display = 'none';
        this.clearForm();
        this.hideStatus();
    }

    switchToRegister() {
        this.isLoginMode = false;
        document.getElementById('auth-title').textContent = 'Register';
        document.getElementById('email-label').style.display = 'block';
        document.getElementById('email').style.display = 'block';
        document.getElementById('email').required = true;
        document.getElementById('toggle-register').parentElement.style.display = 'none';
        document.getElementById('toggle-login-text').style.display = 'block';
        this.hideStatus();
    }

    switchToLogin() {
        this.isLoginMode = true;
        document.getElementById('auth-title').textContent = 'Login';
        document.getElementById('email-label').style.display = 'none';
        document.getElementById('email').style.display = 'none';
        document.getElementById('email').required = false;
        document.getElementById('toggle-register').parentElement.style.display = 'block';
        document.getElementById('toggle-login-text').style.display = 'none';
        this.hideStatus();
    }

    async handleLogin() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showStatus('Please fill in all fields', 'error');
            return;
        }

        this.showStatus('Logging in...', 'info');

        try {
            const result = await this.gameEngine.loginUser(username, password);
            if (result.success) {
                this.isLoggedIn = true;
                this.currentUser = username;
                this.showStatus('Login successful!', 'success');
                setTimeout(() => {
                    this.hideAuthModal();
                    this.updateAuthButtons();
                    this.gameEngine.loadGame(); // Auto-load game after login
                }, 1000);
            } else {
                this.showStatus(result.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showStatus('Login failed. Please try again.', 'error');
        }
    }

    async handleRegister() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const email = document.getElementById('email').value.trim();

        if (!username || !password || !email) {
            this.showStatus('Please fill in all fields', 'error');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showStatus('Please enter a valid email address', 'error');
            return;
        }

        if (password.length < 6) {
            this.showStatus('Password must be at least 6 characters long', 'error');
            return;
        }

        this.showStatus('Creating account...', 'info');

        try {
            const result = await this.gameEngine.registerUser(username, password, email);
            if (result.success) {
                this.showStatus('Registration successful! Please login.', 'success');
                setTimeout(() => {
                    this.switchToLogin();
                    // Pre-fill username
                    document.getElementById('username').value = username;
                    document.getElementById('password').focus();
                }, 1500);
            } else {
                this.showStatus(result.message || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showStatus('Registration failed. Please try again.', 'error');
        }
    }

    async handleSave() {
        if (!this.isLoggedIn) {
            this.showNotification('❌ Cannot save game - Please login or create an account first!', 'error');
            // Optionally, show the login modal to make it easier for users
            setTimeout(() => {
                const loginToggle = document.getElementById('login-toggle-btn');
                if (loginToggle) {
                    loginToggle.click();
                }
            }, 1500);
            return;
        }

        try {
            const result = await this.gameEngine.saveGame();
            if (result.success) {
                this.showNotification('Game saved successfully!', 'success');
                this.updateSaveStatus('Saved');
            } else {
                this.showNotification('Save failed: ' + (result.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Save error:', error);
            this.showNotification('Failed to save game', 'error');
        }
    }

    async handleLoad() {
        if (!this.isLoggedIn) {
            this.showNotification('❌ Cannot load game - Please login first!', 'error');
            // Optionally, show the login modal
            setTimeout(() => {
                const loginToggle = document.getElementById('login-toggle-btn');
                if (loginToggle) {
                    loginToggle.click();
                }
            }, 1500);
            return;
        }

        try {
            const result = await this.gameEngine.loadGame();
            if (result.success) {
                this.showNotification('Game loaded successfully!', 'success');
                this.updateSaveStatus('Loaded');
            } else {
                this.showNotification('Load failed: ' + (result.message || 'No saved game found'), 'error');
            }
        } catch (error) {
            console.error('Load error:', error);
            this.showNotification('Failed to load game', 'error');
        }
    }

    handleReset() {
        if (confirm('Are you sure you want to reset your game? This will delete all progress but keep you logged in!')) {
            // Save login status before reset
            const wasLoggedIn = this.isLoggedIn;
            const currentUser = this.currentUser;
            
            this.gameEngine.resetGame();
            
            // Restore login status after reset
            this.isLoggedIn = wasLoggedIn;
            this.currentUser = currentUser;
            this.updateAuthButtons();
            
            this.showNotification('Game reset successfully!', 'info');
            this.updateSaveStatus('Reset');
        }
    }

    showLogoutConfirmation() {
        if (confirm('Are you sure you want to logout?')) {
            this.logout();
        }
    }

    logout() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.gameEngine.saveManager.logout();
        this.updateAuthButtons();
        this.showNotification('Logged out successfully', 'info');
    }

    updateAuthButtons() {
        const loginBtn = document.getElementById('login-toggle-btn');
        const saveBtn = document.getElementById('save-btn');
        const loadBtn = document.getElementById('load-btn');
        const saveStatus = document.getElementById('save-status');
        const userStatus = document.getElementById('user-status');

        if (this.isLoggedIn) {
            loginBtn.textContent = '🚪 Logout';
            loginBtn.classList.remove('danger');
            saveBtn.disabled = false;
            loadBtn.disabled = false;
            saveStatus.style.display = 'none';
            userStatus.style.display = 'block';
            userStatus.textContent = `Logged in as: ${this.currentUser}`;
        } else {
            loginBtn.textContent = '👤 Login';
            loginBtn.classList.remove('danger');
            saveBtn.disabled = true;
            loadBtn.disabled = true;
            saveStatus.style.display = 'block';
            saveStatus.textContent = '⚠️ Not logged in - Cannot save game';
            userStatus.style.display = 'none';
        }
    }

    updateSaveStatus(status) {
        if (this.isLoggedIn) {
            const userStatus = document.getElementById('user-status');
            const originalText = `Logged in as: ${this.currentUser}`;
            userStatus.textContent = `${originalText} - ${status}`;
            setTimeout(() => {
                userStatus.textContent = originalText;
            }, 2000);
        }
    }

    showStatus(message, type) {
        const statusElement = document.getElementById('auth-status');
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        statusElement.style.display = 'block';
    }

    hideStatus() {
        const statusElement = document.getElementById('auth-status');
        statusElement.style.display = 'none';
    }

    clearForm() {
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('email').value = '';
    }

    showNotification(message, type) {
        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-weight: bold;
            animation: slideIn 0.3s ease-out;
        `;

        // Set colors based on type
        switch (type) {
            case 'success':
                notification.style.background = 'rgba(76, 175, 80, 0.9)';
                notification.style.color = 'white';
                break;
            case 'error':
                notification.style.background = 'rgba(244, 67, 54, 0.9)';
                notification.style.color = 'white';
                break;
            case 'info':
                notification.style.background = 'rgba(100, 255, 218, 0.9)';
                notification.style.color = '#1a1a2e';
                break;
        }

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}

// Add notification animations to CSS via JavaScript
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(notificationStyles);

// Make UIManager globally available
window.UIManager = UIManager;