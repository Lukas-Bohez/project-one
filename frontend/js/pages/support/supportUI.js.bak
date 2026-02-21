// Support UI - Handles user interface interactions for support chat
class SupportUI {
    constructor() {
        this.authSystem = null;
        this.supportChatSystem = null;
        this.init();
    }

    init() {
        // Initialize authentication and chat system
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Support page loaded, initializing systems...');

            // Initialize support auth system (NOT quiz auth)
            this.authSystem = new SupportAuthSystem();

            // Initialize support chat system (it will wait for authentication)
            this.supportChatSystem = new SupportChatSystem();

            // Set up UI event handlers
            this.setupUIHandlers();

            // Set up user info display
            this.setupUserInfoDisplay();
        });
    }

    setupUIHandlers() {
        const sendButton = document.getElementById('sendButton');
        const messageInput = document.getElementById('messageInput');

        if (sendButton) {
            sendButton.addEventListener('click', () => this.handleSendMessage());
        }

        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });

            // Enable/disable send button based on input content
            messageInput.addEventListener('input', () => {
                const message = messageInput.value.trim();
                if (sendButton) {
                    sendButton.disabled = message.length === 0;
                }
            });

            // Auto-resize textarea
            messageInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 150) + 'px';
            });
        }
    }

    setupUserInfoDisplay() {
        // Listen for user authentication events
        document.addEventListener('userAuthenticated', (event) => {
            const user = event.detail.user;
            this.showUserInfo(user.fullName);
        });

        document.addEventListener('userLoggedOut', () => {
            // Only hide if we're sure the user is actually logged out
            setTimeout(() => {
                if (!this.authSystem || !this.authSystem.getCurrentUser()) {
                    this.hideUserInfo();
                }
            }, 100);
        });

        // Check authentication state after a short delay to let the auth system initialize
        setTimeout(() => {
            this.checkAndUpdateUserDisplay();
        }, 500);

        // Also check after auth system is fully initialized
        setTimeout(() => {
            this.checkAndUpdateUserDisplay();
        }, 2000);
    }

    checkAndUpdateUserDisplay() {
        // Check if we have a valid user from the auth system
        if (this.authSystem && typeof this.authSystem.getCurrentUser === 'function') {
            const user = this.authSystem.getCurrentUser();
            if (user && user.fullName) {
                this.showUserInfo(user.fullName);
                return;
            }
        }

        // Fallback to localStorage check
        const user = this.getCurrentUserFromStorage();
        if (user && user.fullName) {
            this.showUserInfo(user.fullName);
        } else {
            this.hideUserInfo();
        }
    }

    showUserInfo(fullName) {
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');

        if (userInfo && userName) {
            userName.textContent = fullName;
            userInfo.style.display = 'block';

            // Adjust styling for mobile devices to integrate with flexbox
            if (window.innerWidth <= 768) {
                userInfo.style.position = 'static';
                userInfo.style.marginTop = '10px';
                userInfo.style.background = 'none';
                userInfo.style.padding = '0';
                userInfo.style.borderRadius = '0';
                userInfo.style.opacity = '1';
            }
        }
    }

    hideUserInfo() {
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.style.display = 'none';
        }
    }

    getCurrentUserFromStorage() {
        try {
            const firstName = localStorage.getItem('support_first_name');
            const lastName = localStorage.getItem('support_last_name');

            if (firstName && lastName) {
                return {
                    fullName: `${firstName} ${lastName}`
                };
            }
            return null;
        } catch (error) {
            console.error('Error reading user from localStorage:', error);
            return null;
        }
    }

    async handleSendMessage() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) return;

        const message = messageInput.value.trim();
        if (!message) return;

        if (!this.supportChatSystem) {
            console.error('Support chat system not initialized');
            return;
        }

        // Send the message
        const success = await this.supportChatSystem.sendMessage(message);

        if (success) {
            // Clear input
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
    }
}

// Global variables for backward compatibility
let supportChatSystem = null;
let authSystem = null;

// Initialize the UI when the script loads
const supportUI = new SupportUI();

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    if (supportUI.supportChatSystem) {
        supportUI.supportChatSystem.destroy();
    }
});