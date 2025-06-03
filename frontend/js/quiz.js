// Quiz Authentication System
class QuizAuth {
  constructor() {
    this.currentUser = null;
    this.players = [];
    this.init();
  }

  init() {
    this.createAuthModal();
    this.bindEvents();
    this.bindChatEvents();
    this.showAuthModal();
  }

  createAuthModal() {
    // Create modal HTML
    const modalHTML = `
            <div id="authModal" class="c-modal" style="display: block;">
                <div class="c-modal__content">
                    <h2 id="authModalTitle">Join Quiz Session</h2>
                    <form id="authForm" class="c-login-form">
                        <div class="c-error-message" id="authError"></div>
                        
                        <input type="text" id="firstName" class="c-login-input" 
                               placeholder="First Name" required>
                        
                        <input type="text" id="lastName" class="c-login-input" 
                               placeholder="Last Name" required>
                        
                        <input type="password" id="passwordRfid" class="c-login-input" 
                               placeholder="Password / RFID Code" required>
                        
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
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message || !this.currentUser) return;

    // Add message to chat
    this.addChatMessage(this.currentUser.fullName, message);

    // Clear input
    chatInput.value = '';

    // Scroll to bottom after adding new message
    this.scrollChatToBottom();
  }

  addChatMessage(sender, message) {
    const chatMessages = document.getElementById('chatMessages');
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

    loginBtn.addEventListener('click', (e) => this.handleLogin(e));
    registerBtn.addEventListener('click', (e) => this.handleRegister(e));

    // Prevent form submission
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
    modal.style.display = 'block';
  }

  hideAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = 'none';
  }

  showError(message) {
    const errorEl = document.getElementById('authError');
    errorEl.textContent = message;
    errorEl.classList.add('is-visible');

    // Hide error after 5 seconds
    setTimeout(() => {
      errorEl.classList.remove('is-visible');
    }, 5000);
  }

  showLoading(button) {
    const buttonText = button.querySelector('.button-text');
    buttonText.innerHTML = '<span class="c-loading-spinner"></span>Processing...';
    button.disabled = true;
  }

  hideLoading(button, originalText) {
    const buttonText = button.querySelector('.button-text');
    buttonText.textContent = originalText;
    button.disabled = false;
  }

  validateForm() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const passwordRfid = document.getElementById('passwordRfid').value.trim();

    if (!firstName) {
      this.showError('First name is required');
      return false;
    }

    if (!lastName) {
      this.showError('Last name is required');
      return false;
    }

    if (!passwordRfid) {
      this.showError('Password or RFID code is required');
      return false;
    }

    return { firstName, lastName, passwordRfid };
  }

  async handleLogin(e) {
    e.preventDefault();
    const loginBtn = document.getElementById('loginBtn');

    const formData = this.validateForm();
    if (!formData) return;

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
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const registerBtn = document.getElementById('registerBtn');

    const formData = this.validateForm();
    if (!formData) return;

    this.showLoading(registerBtn);

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
    }
  }

  // Simulate API call delay
  simulateApiCall() {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Simulate user existence check (in real app, this would be an API call)
  checkUserExists(userData) {
    const userKey = `${userData.firstName}_${userData.lastName}`;
    return this.players.some((player) => player.key === userKey);
  }

  loginUser(userData) {
    this.currentUser = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      fullName: `${userData.firstName} ${userData.lastName}`,
      key: `${userData.firstName}_${userData.lastName}`,
      score: 0,
      lp: 4,
      sp: 4,
    };

    this.addPlayerToList(this.currentUser);
    this.hideAuthModal();
    this.showWelcomeMessage();
  }

  registerUser(userData) {
    const newUser = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      fullName: `${userData.firstName} ${userData.lastName}`,
      key: `${userData.firstName}_${userData.lastName}`,
      score: 0,
      lp: 4,
      sp: 4,
    };

    this.currentUser = newUser;
    this.addPlayerToList(newUser);
    this.hideAuthModal();
    this.showWelcomeMessage();
  }

  addPlayerToList(player) {
    // Add to players array
    this.players.push(player);

    // Add to DOM
    const playersList = document.getElementById('playersList');
    const playerElement = document.createElement('div');
    playerElement.className = 'c-player-item';
    playerElement.id = `player-${player.key}`;

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

    playersList.appendChild(playerElement);

    // Update current user's LP/SP display if this is the current user
    if (player.key === this.currentUser?.key) {
      this.updateUserStats();
    }
  }

  updateUserStats() {
    const lpDisplay = document.querySelector('.js-LP');
    const spDisplay = document.querySelector('.js-SP');

    if (lpDisplay) lpDisplay.textContent = this.currentUser.lp;
    if (spDisplay) spDisplay.textContent = this.currentUser.sp;
  }

  showWelcomeMessage() {
    // Create a temporary welcome message
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

    // Remove welcome message after 5 seconds
    setTimeout(() => {
      if (welcomeMsg.parentNode) {
        welcomeMsg.parentNode.removeChild(welcomeMsg);
      }
    }, 5000);
  }

  // Public method to get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Public method to update user score
  updateUserScore(newScore) {
    if (this.currentUser) {
      this.currentUser.score = newScore;
      const scoreDisplay = document.getElementById('currentScore');
      if (scoreDisplay) {
        scoreDisplay.textContent = newScore;
      }

      // Update in players list
      const playerElement = document.getElementById(`player-${this.currentUser.key}`);
      if (playerElement) {
        const scoreSpan = playerElement.querySelector('.c-player-score');
        if (scoreSpan) {
          scoreSpan.textContent = `Score: ${newScore}`;
        }
      }
    }
  }

  // Public method to update LP/SP
  updateUserLP(newLP) {
    if (this.currentUser) {
      this.currentUser.lp = newLP;
      this.updateUserStats();

      // Update in players list
      const playerElement = document.getElementById(`player-${this.currentUser.key}`);
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

      // Update in players list
      const playerElement = document.getElementById(`player-${this.currentUser.key}`);
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
});

// Export for use in other scripts
window.QuizAuth = QuizAuth;