// =============================================================================
// KINGDOM QUARRY - AUTHENTICATION SYSTEM
// =============================================================================

class AuthSystem {
    constructor() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.authToken = null;
        this.isGuest = false;
        this.gameEndpointsAvailable = false;
        
        // Bind event handlers
        this.bindEvents();
        
        // Check for existing session
        this.checkExistingSession();
    }
    
    // Bind authentication event handlers
    bindEvents() {
        // Modal switching
        document.getElementById('showRegister')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });
        
        document.getElementById('showLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });
        
        // Authentication buttons
        document.getElementById('loginBtn')?.addEventListener('click', () => {
            this.handleLogin();
        });
        
        document.getElementById('registerBtn')?.addEventListener('click', () => {
            this.handleRegister();
        });
        
        document.getElementById('guestBtn')?.addEventListener('click', () => {
            this.handleGuestMode();
        });
        
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.handleLogout();
        });
        
        // Enter key support
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !document.getElementById('authModal').classList.contains('hidden')) {
                const activeForm = !document.getElementById('loginForm').classList.contains('hidden') ? 'login' : 'register';
                if (activeForm === 'login') {
                    this.handleLogin();
                } else {
                    this.handleRegister();
                }
            }
        });
    }
    
    // Check for existing authentication session
    async checkExistingSession() {
        // First check if game endpoints are available
        await this.checkGameAvailability();
        
        const savedAuth = localStorage.getItem('kingdomQuarryAuth');
        if (savedAuth) {
            try {
                const authData = JSON.parse(savedAuth);
                if (authData.token && authData.expiresAt > Date.now()) {
                    this.authToken = authData.token;
                    this.currentUser = authData.user;
                    this.isAuthenticated = true;
                    this.isGuest = authData.isGuest || false;
                    
                    // Validate token with server (if not guest and game endpoints available)
                    if (!this.isGuest && this.gameEndpointsAvailable) {
                        const isValid = await this.validateToken();
                        if (isValid) {
                            this.hideAuthModal();
                            this.updateUI();
                            return;
                        }
                    } else {
                        this.hideAuthModal();
                        this.updateUI();
                        return;
                    }
                }
            } catch (error) {
                console.error('Error checking existing session:', error);
            }
        }
        
        // No valid session found, show auth modal
        this.showAuthModal();
    }
    
    // Check if game endpoints are available (JWT dependency check)
    async checkGameAvailability() {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.gameStatus}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.gameEndpointsAvailable = data.game_available;
                
                if (!this.gameEndpointsAvailable) {
                    console.warn('Game endpoints not available - PyJWT may not be installed');
                }
            } else {
                this.gameEndpointsAvailable = false;
            }
        } catch (error) {
            console.error('Failed to check game availability:', error);
            this.gameEndpointsAvailable = false;
        }
    }
    
    // Validate authentication token with server
    async validateToken() {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.resources}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            return response.ok;
        } catch (error) {
            console.error('Token validation failed:', error);
            return false;
        }
    }
    
    // Handle user login
    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!username || !password) {
            this.showError('Please enter both username and password');
            return;
        }
        
        // Check if game endpoints are available
        if (!this.gameEndpointsAvailable) {
            this.showError('Game authentication requires PyJWT. Playing as guest instead.');
            this.handleGuestMode();
            return;
        }
        
        try {
            this.showLoading('Logging in...');
            
            const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.login}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.authToken = data.access_token;
                this.currentUser = {
                    id: data.user_id,
                    username: username
                };
                this.isAuthenticated = true;
                this.isGuest = false;
                
                // Save authentication data
                this.saveAuthData();
                
                this.hideAuthModal();
                this.updateUI();
                this.showSuccess('Login successful!');
                
                // Initialize game with cloud save
                if (window.gameEngine) {
                    await window.gameEngine.loadCloudSave();
                }
                
            } else {
                this.showError(data.detail || 'Login failed');
            }
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }
    
    // Handle user registration
    async handleRegister() {
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirm').value;
        
        if (!username || !password || !confirmPassword) {
            this.showError('Please fill in all fields');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }
        
        // Check if game endpoints are available
        if (!this.gameEndpointsAvailable) {
            this.showError('Game registration requires PyJWT. Playing as guest instead.');
            this.handleGuestMode();
            return;
        }
        
        try {
            this.showLoading('Creating account...');
            
            const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.register}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.authToken = data.access_token;
                this.currentUser = {
                    id: data.user_id,
                    username: username
                };
                this.isAuthenticated = true;
                this.isGuest = false;
                
                // Save authentication data
                this.saveAuthData();
                
                this.hideAuthModal();
                this.updateUI();
                this.showSuccess('Account created successfully!');
                
                // Initialize game with new save
                if (window.gameEngine) {
                    window.gameEngine.initializeNewGame();
                }
                
            } else {
                this.showError(data.detail || 'Registration failed');
            }
            
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }
    
    // Handle guest mode
    handleGuestMode() {
        this.authToken = 'guest_' + Date.now();
        this.currentUser = {
            id: 'guest',
            username: 'Guest Player'
        };
        this.isAuthenticated = true;
        this.isGuest = true;
        
        // Save guest session
        this.saveAuthData();
        
        this.hideAuthModal();
        this.updateUI();
        this.showInfo('Playing as guest - progress will be saved locally only');
        
        // Initialize game in offline mode
        if (window.gameEngine) {
            window.gameEngine.initializeNewGame();
        }
    }
    
    // Handle logout
    handleLogout() {
        // Save current game state before logout
        if (window.gameEngine && this.isAuthenticated) {
            window.gameEngine.saveGame(true); // Force save
        }
        
        // Clear authentication data
        this.authToken = null;
        this.currentUser = null;
        this.isAuthenticated = false;
        this.isGuest = false;
        
        localStorage.removeItem('kingdomQuarryAuth');
        localStorage.removeItem('kingdomQuarrySave');
        
        // Reset UI and show auth modal
        this.showAuthModal();
        this.updateUI();
        this.showInfo('Logged out successfully');
        
        // Reset game state
        if (window.gameEngine) {
            window.gameEngine.resetGame();
        }
    }
    
    // Save authentication data to localStorage
    saveAuthData() {
        const authData = {
            token: this.authToken,
            user: this.currentUser,
            isGuest: this.isGuest,
            expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };
        
        localStorage.setItem('kingdomQuarryAuth', JSON.stringify(authData));
    }
    
    // Show/hide authentication modal
    showAuthModal() {
        document.getElementById('authModal').classList.remove('hidden');
        document.getElementById('gameContainer').classList.add('hidden');
        this.showLoginForm(); // Default to login form
        
        // Update modal based on game endpoint availability
        this.updateAuthModalStatus();
    }
    
    // Update authentication modal with PyJWT status
    updateAuthModalStatus() {
        const authTitle = document.getElementById('authTitle');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (!this.gameEndpointsAvailable) {
            // Show PyJWT warning
            let warningDiv = document.querySelector('.pyjwt-warning');
            if (!warningDiv) {
                warningDiv = document.createElement('div');
                warningDiv.className = 'pyjwt-warning';
                warningDiv.innerHTML = `
                    <div class="warning-content">
                        <h3>⚠️ Cloud Saves Unavailable</h3>
                        <p>The backend requires PyJWT for account authentication and cloud saves.</p>
                        <p>Install with: <code>pip install PyJWT</code></p>
                        <p>You can still play as guest with local saves only.</p>
                    </div>
                `;
                
                const modalContent = document.querySelector('.modal-content');
                modalContent.insertBefore(warningDiv, loginForm);
            }
            
            // Disable auth forms
            const authInputs = document.querySelectorAll('.auth-input');
            const authBtns = document.querySelectorAll('.auth-btn.primary');
            
            authInputs.forEach(input => input.disabled = true);
            authBtns.forEach(btn => {
                btn.disabled = true;
                btn.textContent = 'Requires PyJWT';
            });
            
        } else {
            // Remove warning if it exists
            const warningDiv = document.querySelector('.pyjwt-warning');
            if (warningDiv) {
                warningDiv.remove();
            }
            
            // Enable auth forms
            const authInputs = document.querySelectorAll('.auth-input');
            const authBtns = document.querySelectorAll('.auth-btn.primary');
            
            authInputs.forEach(input => input.disabled = false);
            authBtns.forEach(btn => btn.disabled = false);
            
            document.getElementById('loginBtn').textContent = 'Login';
            document.getElementById('registerBtn').textContent = 'Register';
        }
    }
    
    hideAuthModal() {
        document.getElementById('authModal').classList.add('hidden');
        document.getElementById('gameContainer').classList.remove('hidden');
    }
    
    // Switch between login and register forms
    showLoginForm() {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('authTitle').textContent = 'Welcome Back to Kingdom Quarry';
        this.clearInputs();
    }
    
    showRegisterForm() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('authTitle').textContent = 'Join Kingdom Quarry';
        this.clearInputs();
    }
    
    // Clear form inputs
    clearInputs() {
        const inputs = document.querySelectorAll('.auth-input');
        inputs.forEach(input => input.value = '');
    }
    
    // Update UI based on authentication state
    updateUI() {
        if (this.isAuthenticated && this.currentUser) {
            document.getElementById('playerName').textContent = this.currentUser.username;
            
            // Show/hide elements based on authentication state
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.classList.remove('hidden');
                logoutBtn.textContent = this.isGuest ? 'New Game' : 'Logout';
            }
        }
    }
    
    // Get authentication headers for API requests
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.authToken && !this.isGuest) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        
        return headers;
    }
    
    // Make authenticated API request
    async makeAuthenticatedRequest(url, options = {}) {
        const requestOptions = {
            ...options,
            headers: {
                ...this.getAuthHeaders(),
                ...(options.headers || {})
            }
        };
        
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}${url}`, requestOptions);
            
            // Handle authentication errors
            if (response.status === 401 || response.status === 403) {
                if (!this.isGuest) {
                    this.showError('Session expired. Please log in again.');
                    this.handleLogout();
                    return null;
                }
            }
            
            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    
    // Utility methods for showing messages
    showLoading(message) {
        // You can implement a loading indicator here
        console.log('Loading:', message);
    }
    
    hideLoading() {
        // Hide loading indicator
    }
    
    showError(message) {
        // You can implement toast notifications or modal alerts here
        console.error('Auth Error:', message);
        alert(message); // Simple fallback
    }
    
    showSuccess(message) {
        console.log('Auth Success:', message);
        // Implement success notification
    }
    
    showInfo(message) {
        console.log('Auth Info:', message);
        // Implement info notification
    }
}

// Initialize authentication system when DOM is ready
let authSystem = null;

document.addEventListener('DOMContentLoaded', () => {
    authSystem = new AuthSystem();
    window.authSystem = authSystem; // Make globally available
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthSystem;
}