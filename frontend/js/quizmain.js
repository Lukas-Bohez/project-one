// Main Application Initialization
class QuizApp {
    constructor() {
        this.authSystem = null;
        this.quizLogic = null;
        this.chatSystem = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeApp());
        } else {
            this.initializeApp();
        }
    }

    initializeApp() {
        console.log('Initializing Quiz Application...');
        
        // Initialize all systems
        this.chatSystem = new ChatSystem();
        this.authSystem = new AuthSystem();
        this.quizLogic = new QuizLogic();


        // Set up cross-system communication
        this.setupCrossSystemEvents();

        console.log('Quiz Application initialized successfully');
    }

    setupCrossSystemEvents() {
        // Listen for authentication events to update quiz logic
        document.addEventListener('userAuthenticated', (event) => {
            const user = event.detail.user;
            this.quizLogic.setCurrentUser(user);
        });

        // Listen for score updates to potentially update chat or other systems
        document.addEventListener('scoreUpdated', (event) => {
            console.log('Score updated:', event.detail);
            // Add any cross-system score update logic here
        });

        // Listen for messages sent to potentially update other systems
        document.addEventListener('messageSent', (event) => {
            console.log('Message sent:', event.detail);
            // Add any cross-system message logic here
        });

        // Listen for user registration to update chat
        document.addEventListener('userRegistered', (event) => {
            console.log('User registered:', event.detail);
            // Chat system already handles this, but you can add more logic here
        });
    }

    // Public API methods
    getCurrentUser() {
        return this.authSystem ? this.authSystem.getCurrentUser() : null;
    }

    updateUserScore(newScore) {
        if (this.quizLogic) {
            this.quizLogic.updateUserScore(newScore);
        }
    }

    updateUserLP(newLP) {
        if (this.quizLogic) {
            this.quizLogic.updateUserLP(newLP);
        }
    }

    updateUserSP(newSP) {
        if (this.quizLogic) {
            this.quizLogic.updateUserSP(newSP);
        }
    }

    logout() {
        if (this.authSystem) {
            this.authSystem.logout();
        }
    }

    // Chat system methods
    sendChatMessage(message) {
        if (this.chatSystem && message) {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                chatInput.value = message;
                this.chatSystem.sendChatMessage();
            }
        }
    }

    setChatSessionId(sessionId) {
        if (this.chatSystem) {
            this.chatSystem.setSessionId(sessionId);
        }
    }

    clearChat() {
        if (this.chatSystem) {
            this.chatSystem.clearChat();
        }
    }

    // Utility methods
    getStoredIP() {
        return sessionStorage.getItem('IP');
    }

    setStoredIP(ip) {
        sessionStorage.setItem('IP', ip);
    }
}

// Global instances
let quizApp;

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const storedIP = sessionStorage.getItem('IP');
    console.log('Stored IP:', storedIP);
    
    quizApp = new QuizApp();
});

// Export for global access
window.QuizApp = QuizApp;
window.quizApp = quizApp;

// Legacy compatibility - export individual systems for backward compatibility
window.getCurrentUser = () => quizApp ? quizApp.getCurrentUser() : null;
window.updateUserScore = (score) => quizApp ? quizApp.updateUserScore(score) : null;
window.updateUserLP = (lp) => quizApp ? quizApp.updateUserLP(lp) : null;
window.updateUserSP = (sp) => quizApp ? quizApp.updateUserSP(sp) : null;