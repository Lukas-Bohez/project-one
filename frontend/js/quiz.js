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
        this.showAuthModal(); // Show modal on page load
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
        chatMessages.style.maxHeight = '250px'; // Fixed height for messages
        chatMessages.style.overflowY = 'auto';
        this.scrollChatToBottom();

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

    scrollChatToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();

        if (!message || !this.currentUser) {
            this.showError('Please log in and enter a message to chat.');
            return;
        }

        // Add message to chat
        this.addChatMessage(this.currentUser.fullName, message);

        // Clear input
        chatInput.value = '';

        // Scroll to bottom after adding new message
        this.scrollChatToBottom();
        // TODO: In a real app, send this message to a WebSocket or another API endpoint
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

<<<<<<< HEAD
    this.showLoading(loginBtn);

    let loginSuccessful = false;

    try {
      // Simulate API call
      await this.simulateApiCall();

      // Check if user exists (simulate database check)
      const userExists = this.checkUserExists(formData);

      if (userExists) {
        this.loginUser(formData);
        loginSuccessful = true;
      } else {
        this.showError('User not found. Please register first.');
      }
    } catch (error) {
      this.showError('Login failed. Please try again.');
    } finally {
      this.hideLoading(loginBtn, 'Login');
      
      // Only add chat message if login was successful and currentUser exists
      if (loginSuccessful && this.currentUser) {
        this.addChatMessage('System', `${this.currentUser.fullName} has joined the quiz!`);
      }
=======
        chatMessages.appendChild(messageElement);
>>>>>>> 308f2c7 (updated frontend)
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

<<<<<<< HEAD
    let registrationSuccessful = false;

    try {
      // Simulate API call
      await this.simulateApiCall();

      // Check if user already exists
      const userExists = this.checkUserExists(formData);

      if (userExists) {
        this.showError('User already exists. Please login instead.');
      } else {
        this.registerUser(formData);
        registrationSuccessful = true;
      }
    } catch (error) {
      this.showError('Registration failed. Please try again.');
    } finally {
      this.hideLoading(registerBtn, 'Register');
      
      // Only add chat message if registration was successful and currentUser exists
      if (registrationSuccessful && this.currentUser) {
        this.addChatMessage('System', `${this.currentUser.fullName} has joined the quiz!`);
      }
=======
        // Prevent default form submission
        authForm.addEventListener('submit', (e) => e.preventDefault());

        // Allow Enter key to trigger login
        authForm.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLogin(e);
            }
        });
>>>>>>> 308f2c7 (updated frontend)
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
        const passwordInput = document.getElementById('password'); // Changed from passwordRfid

        const firstName = firstNameInput ? firstNameInput.value.trim() : '';
        const lastName = lastNameInput ? lastNameInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : ''; // Do not trim password

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
        this.addChatMessage('System', `${this.currentUser.fullName} has joined the quiz!`);
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
    quizAuth = new QuizAuth();
    listenToInfoModal(dom);
});

// Export for use in other scripts
<<<<<<< HEAD
window.QuizAuth = QuizAuth;
=======
window.QuizAuth = QuizAuth;




















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
>>>>>>> 308f2c7 (updated frontend)
