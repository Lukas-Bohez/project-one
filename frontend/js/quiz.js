// Quiz Authentication System
class QuizAuth {
    constructor() {
        this.currentUser = null;
        this.players = []; // This will now primarily be populated after successful login/registration if needed for display
        this.lanIP = `http://${window.location.hostname}:8000`; // Assuming your backend is on the same host, port 8000
        this.init();
    }

    init() {
    this.createAuthModal();
    this.bindEvents();
    this.bindChatEvents();
    
    // Try auto-login first, only show modal if it fails
    this.autoLogin().then(success => {
        if (!success) {
            this.showAuthModal(); // Only show modal if auto-login failed
        }
    }).catch(error => {
        console.error('Auto-login attempt failed:', error);
        this.showAuthModal(); // Show modal on any error
    });
}

// Add this method inside the QuizAuth class, after the init() method
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
                return true; // Indicate successful auto-login
            } else {
                console.warn('Auto-login failed: Invalid response from server');
                this.clearStoredCredentials(); // Clear invalid credentials
                return false;
            }
        } catch (error) {
            console.error('Auto-login error:', error);
            this.clearStoredCredentials(); // Clear credentials on error
            return false;
        }
    } else {
        console.log('No stored credentials found for auto-login');
        return false;
    }
}

    createAuthModal() {
        // Create modal HTML
        const modalHTML = `
            <div id="authModal" class="c-modal" style="display: block;">
                <div class="c-modal__content">
                    <h2 id="authModalTitle">Join <a href="../index.html" class="c-header__link">Quiz The Spire</a> Session</h2>
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

        // Insert modal into document
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    bindChatEvents() {
        const chatSend = document.getElementById('chatSend');
        const chatInput = document.getElementById('chatInput');
        const chatToggle = document.getElementById('chatToggle');
        const chatContent = document.getElementById('chatContent');
        const chatMessages = document.getElementById('chatMessages');

        // Check if chat elements exist before binding
        if (!chatSend || !chatInput || !chatToggle || !chatContent || !chatMessages) {
            console.warn("Chat elements not found. Skipping chat event binding.");
            return;
        }

        // Initialize chat container height and scrolling
        chatMessages.style.maxHeight = '250px';
        chatMessages.style.overflowY = 'auto';
        this.scrollChatToBottom();

        // Load existing messages
        this.loadChatMessages();

        // Send message on button click
        chatSend.addEventListener('click', () => this.sendChatMessage());

        // Send message on Enter key
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });

        // Toggle chat visibility
        chatToggle.addEventListener('click', () => {
            chatContent.style.display = chatContent.style.display === 'none' ? 'block' : 'none';
            chatToggle.textContent = chatContent.style.display === 'none' ? '+' : '−';
            if (chatContent.style.display === 'block') {
                this.scrollChatToBottom();
            }
        });
    }

    async loadChatMessages() {
        try {
            const response = await fetch(`${this.lanIP}/api/v1/chat/messages/2`); // Using session ID 2 as requested
            if (!response.ok) throw new Error('Failed to load messages');
            
            const data = await response.json();
            const messages = data.messages || [];
            
            // Clear existing messages
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = '';
            
            // Add all messages to chat
            messages.reverse().forEach(msg => { // Reverse to show oldest first
                this.addChatMessage(msg.username, msg.message);
            });
            
            this.scrollChatToBottom();
        } catch (error) {
            console.error('Error loading chat messages:', error);
        }
    }

    async sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();

        if (!message || !this.currentUser) {
            this.showError('Please log in and enter a message to chat.');
            return;
        }

        try {
            // First add message locally for immediate feedback
            this.addChatMessage(this.currentUser.fullName, message);
            chatInput.value = '';
            this.scrollChatToBottom();

            // Send to server
            const response = await fetch(`${this.lanIP}/api/v1/chat/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: 2, // Using session ID 2 as requested
                    message_text: message,
                    user_id: this.currentUser.id // Assuming currentUser has an id property
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message. Please try again.');
        }
    }

    // Rest of your methods remain the same...
    scrollChatToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    addChatMessage(sender, message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = 'c-chat-message';

        messageElement.innerHTML = `
            <span class="c-chat-sender">${sender}:</span>
            <span class="c-chat-text">${message}</span>
        `;

        chatMessages.appendChild(messageElement);
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
                errorEl.textContent = ''; // Clear message after hiding
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
        const password = passwordInput ? passwordInput.value : ''; // Do not trim password

        // Move localStorage operations AFTER variable declarations
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
        const registerBtn = document.getElementById('registerBtn'); // Get the other button to disable

        const formData = this.validateForm();
        if (!formData) return;

        this.showLoading(loginBtn);
        registerBtn.disabled = true; // Disable other button during loading

        try {
            const result = await this.sendAuthenticationRequest('login', formData.firstName, formData.lastName, formData.password);
            
            if (result && result.user_id) {
                this.loginUser(formData, result.user_id); // Pass user_id from backend
            } else {
                this.showError('Login failed: Invalid response from server.');
            }
        } catch (error) {
            console.error('Login error:', error);
            const errorMessage = error.detail || 'Login failed. Please check your credentials.';
            this.showError(errorMessage);
        } finally {
            this.hideLoading(loginBtn, 'Login');
            registerBtn.disabled = false; // Re-enable other button
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const registerBtn = document.getElementById('registerBtn');
        const loginBtn = document.getElementById('loginBtn'); // Get the other button to disable

        const formData = this.validateForm();
        if (!formData) return;

        this.showLoading(registerBtn);
        loginBtn.disabled = true; // Disable other button during loading

        try {
            const result = await this.sendAuthenticationRequest('register', formData.firstName, formData.lastName, formData.password);
            
            if (result && result.user_id) {
                this.registerUser(formData, result.user_id); // Pass user_id from backend
            } else {
                this.showError('Registration failed: Unexpected response from server.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            const errorMessage = error.detail || 'Registration failed. User may already exist or password is too weak.';
            this.showError(errorMessage);
        } finally {
            this.hideLoading(registerBtn, 'Register');
            loginBtn.disabled = false; // Re-enable other button
        }
    }

    // --- REPLACED SIMULATE API CALL AND USER CHECKS WITH ACTUAL FETCH ---
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
                throw errorData; // Throw the error object containing 'detail'
            }

            return await response.json(); // Should contain {"user_id": X}
        } catch (error) {
            throw error; // Re-throw to be caught by handleLogin/handleRegister
        }
    }

    // Modified to use actual backend success and user_id
    loginUser(userData, userId) {
        this.currentUser = {
            id: userId, // Store the actual user ID from the backend
            firstName: userData.firstName,
            lastName: userData.lastName,
            fullName: `${userData.firstName} ${userData.lastName}`,
            key: `${userData.firstName}_${userData.lastName}`, // Still useful for DOM manipulation
            score: 0, // Initial values, can be fetched from backend if user has existing score
            lp: 4,
            sp: 4,
        };

        // You might want to fetch player specific data like score, lp, sp here
        // using the userId from the backend, if they are persisted.
        // For now, initializing with defaults as per your original code.

        this.addPlayerToList(this.currentUser); // Add to local players list if needed for display
        this.hideAuthModal();
        this.showWelcomeMessage();
    }

    // Modified to use actual backend success and user_id
    registerUser(userData, userId) {
        const newUser = {
            id: userId, // Store the actual user ID from the backend
            firstName: userData.firstName,
            lastName: userData.lastName,
            fullName: `${userData.firstName} ${userData.lastName}`,
            key: `${userData.firstName}_${userData.lastName}`,
            score: 0,
            lp: 4,
            sp: 4,
        };

        this.currentUser = newUser;
        this.addPlayerToList(newUser); // Add to local players list if needed for display
        this.hideAuthModal();
        this.showWelcomeMessage();
        this.addChatMessage('System', `${this.currentUser.fullName} has joined the quiz!`);
    }

    // --- END OF REPLACED METHODS ---

    addPlayerToList(player) {
        // Only add if not already in the list (e.g., if re-logging in)
        if (!this.players.some(p => p.id === player.id)) {
            this.players.push(player);
        }

        const playersList = document.getElementById('playersList');
        if (!playersList) {
            console.warn("Players list element not found.");
            return;
        }

        // Check if player element already exists before creating
        let playerElement = document.getElementById(`player-${player.id}`);
        if (!playerElement) {
            playerElement = document.createElement('div');
            playerElement.className = 'c-player-item';
            playerElement.id = `player-${player.id}`; // Use ID for uniqueness
            playersList.appendChild(playerElement);
        }

        playerElement.innerHTML = `
            <div class="c-player-info">
                <span class="c-player-name">${player.fullName}</span>
                <span class="c-player-score">Score: ${player.score}</span>
            </div>
            <div class="c-player-stats">
                <span class="c-player-lp">LP: ${player.lp}</span>
                <span class="c-player-sp">SP: ${player.sp}</span>
            </div>
        `;

        this.updateUserStats(); // Update current user's LP/SP display
    }

    updateUserStats() {
        const lpDisplay = document.querySelector('.js-LP');
        const spDisplay = document.querySelector('.js-SP');

        if (this.currentUser) {
            if (lpDisplay) lpDisplay.textContent = this.currentUser.lp;
            if (spDisplay) spDisplay.textContent = this.currentUser.sp;
        }
    }

    showWelcomeMessage() {
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'c-welcome-message';
        welcomeMsg.style.position = 'fixed';
        welcomeMsg.style.top = '20px';
        welcomeMsg.style.right = '20px';
        welcomeMsg.style.zIndex = '1000';
        welcomeMsg.style.maxWidth = '300px';
        welcomeMsg.innerHTML = `
            <strong>Welcome, ${this.currentUser.fullName}!</strong>
            <p>You have joined the quiz session. Good luck!</p>
        `;

        document.body.appendChild(welcomeMsg);

        setTimeout(() => {
            if (welcomeMsg.parentNode) {
                welcomeMsg.parentNode.removeChild(welcomeMsg);
            }
        }, 5000);
    }

    getCurrentUser() {
        return this.currentUser;
    }

    updateUserScore(newScore) {
        if (this.currentUser) {
            this.currentUser.score = newScore;
            const scoreDisplay = document.getElementById('currentScore');
            if (scoreDisplay) {
                scoreDisplay.textContent = newScore;
            }

            const playerElement = document.getElementById(`player-${this.currentUser.id}`); // Use ID
            if (playerElement) {
                const scoreSpan = playerElement.querySelector('.c-player-score');
                if (scoreSpan) {
                    scoreSpan.textContent = `Score: ${newScore}`;
                }
            }
        }
    }

    updateUserLP(newLP) {
        if (this.currentUser) {
            this.currentUser.lp = newLP;
            this.updateUserStats();

            const playerElement = document.getElementById(`player-${this.currentUser.id}`); // Use ID
            if (playerElement) {
                const lpSpan = playerElement.querySelector('.c-player-lp');
                if (lpSpan) {
                    lpSpan.textContent = `LP: ${newLP}`;
                }
            }
        }
    }

    updateUserSP(newSP) {
        if (this.currentUser) {
            this.currentUser.sp = newSP;
            this.updateUserStats();

            const playerElement = document.getElementById(`player-${this.currentUser.id}`); // Use ID
            if (playerElement) {
                const spSpan = playerElement.querySelector('.c-player-sp');
                if (spSpan) {
                    spSpan.textContent = `SP: ${newSP}`;
                }
            }
        }
    }
}


// Initialize the authentication system when the page loads
let quizAuth;
document.addEventListener('DOMContentLoaded', () => {
    const storedIP = sessionStorage.getItem('IP');
    console.log('Stored IP:', storedIP);
    quizAuth = new QuizAuth(); // autoLogin will be called automatically in init()
    listenToInfoModal(dom);
});

// Export for use in other scripts
window.QuizAuth = QuizAuth;






STORAGE_KEYS = {
  USER: {
    USER_ID: 'user_user_id',
    FIRST_NAME: 'user_first_name', 
    LAST_NAME: 'user_last_name',
    PASSWORD: 'user_password'
  }
};














  const dom = {
    infoBtn: document.getElementById('infoBtn'),
    infoModal: document.getElementById('infoModal'),
    closeModal: document.querySelector('.c-modal__close'),
    quizSessionsContainer: document.querySelector('.c-quiz-sessions-container')
  };
const listenToInfoModal = (domElements) => {
  const { infoBtn, infoModal, closeModal } = domElements;

  if (!infoBtn || !infoModal || !closeModal) {
    console.warn('Missing required DOM elements for info modal');
    return;
  }

  infoBtn.addEventListener('click', () => {
    infoModal.style.display = 'block';
  });

  closeModal.addEventListener('click', () => {
    infoModal.style.display = 'none';
  });

  window.addEventListener('click', (event) => {
    if (event.target === infoModal) {
      infoModal.style.display = 'none';
    }
  });
};