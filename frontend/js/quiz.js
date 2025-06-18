// Fixed main-quiz-logic.js
class QuizLogic {
    constructor() {
        this.currentUser = null;
        this.players = [];
        this.socket = null;
        this.currentQuestion = null;
        this.items = [];
        
        // Initialize modules
        this.socketHandler = null;
        this.timerHandler = null;
        this.playerHandler = null;
        this.questionHandler = null;
        
        this.init();
    }
    
    async init() {
        // Wait for socket connection
        if (!window.sharedSocket) {
            await new Promise(resolve => {
                const checkSocket = setInterval(() => {
                    if (window.sharedSocket) {
                        clearInterval(checkSocket);
                        resolve();
                    }
                }, 50);
            });
        }

        this.socket = window.sharedSocket;

        if (!this.socket) {
            console.error("Socket connection not available for QuizLogic.");
            return;
        }

        // Initialize all modules
        this.initializeModules();
    }

    initializeModules() {
        // Initialize question handler FIRST
        this.questionHandler = new QuizQuestionHandler(this, this.socket);
        // Then initialize socket handler with proper reference
        this.socketHandler = new QuizSocketHandler(this.socket, this.questionHandler);
        
        // Rest of initialization
        this.timerHandler = new QuizTimerHandler();
        this.playerHandler = new QuizPlayerHandler(this);
        
        console.log("All quiz modules initialized with proper references");
    }

    // FIXED: Main methods that delegate to modules
    setCurrentUser(user) {
        console.log("QuizLogic: Setting current user:", user);
        this.currentUser = user;
        
        // Make sure the question handler also knows the user with correct field mapping
        if (this.questionHandler) {
            // Map the user object to include both id and user_id for compatibility
            const userForHandler = {
                ...user,
                user_id: user.id || user.user_id, // Ensure user_id is available
                id: user.id || user.user_id       // Ensure id is available
            };
            console.log("QuizLogic: Passing user to question handler:", userForHandler);
            this.questionHandler.setCurrentUser(userForHandler);
        }
        
        // Also initialize players list manager if it exists
        if (window.playersListManager) {
            window.playersListManager.setCurrentUser(user);
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

// Delegate methods to appropriate handlers
updateTimer(timerData) {
    if (this.timerHandler) {
        // Pass all relevant data to the timer handler
        this.timerHandler.updateTimer(
            timerData.time_remaining,
            timerData.speed_multiplier,
            timerData.temperature,
            timerData.illuminance,
            timerData.total_time
        );
    }
}
    handleTimerFinished() {
        if (this.timerHandler) {
            this.timerHandler.handleTimerFinished();
        }
    }

    updatePlayersDisplay() {
        if (this.playerHandler) {
            this.playerHandler.updatePlayersDisplay();
        }
    }

    loadQuestion(questionData) {
        console.log("QuizLogic: Loading question:", questionData);
        this.currentQuestion = questionData;
        
        if (this.questionHandler) {
            // Ensure user is set before loading question
            if (this.currentUser) {
                const userForHandler = {
                    ...this.currentUser,
                    user_id: this.currentUser.id || this.currentUser.user_id,
                    id: this.currentUser.id || this.currentUser.user_id
                };
                this.questionHandler.setCurrentUser(userForHandler);
            }
            this.questionHandler.loadQuestion(questionData);
        } else {
            console.error("QuizLogic: Question handler not initialized");
        }
    }

    handleAnswerClick(answerIndex, buttonElement) {
        if (this.questionHandler) {
            this.questionHandler.handleAnswerClick(answerIndex, buttonElement);
        }
    }

    showExplanation(data) {
        console.log("QuizLogic: Delegating explanation to question handler");
        if (this.questionHandler && this.questionHandler.showExplanation) {
            this.questionHandler.showExplanation(data);
        } else {
            console.error("QuizLogic: Question handler missing or broken");
        }
    }

    // Utility methods
    showFeedback(message, isError = false) {
        const elementId = isError ? 'answerError' : 'answerFeedback';
        const element = document.getElementById(elementId);
        
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
            
            setTimeout(() => {
                element.style.display = 'none';
            }, 3000);
        }
    }

    // Legacy methods for compatibility
    addGamepadClasses() {
        const itemSlots = document.querySelectorAll('.c-item-slot');
        itemSlots.forEach((slot) => {
            slot.classList.add('gamepad', 'gamepad-special');
        });
    }
}

// Make QuizLogic globally available
window.QuizLogic = QuizLogic;

// FIXED: Proper user authentication handler
document.addEventListener('userAuthenticated', (event) => {
    console.log("User authenticated event received");
    const user = event.detail.user;
    console.log("User data from event:", user);
    
    // Get or create QuizLogic instance
    if (!window.quizLogicInstance) {
        console.log("Creating new QuizLogic instance");
        window.quizLogicInstance = new QuizLogic();
    }
    
    // Set the user on the QuizLogic instance
    if (window.quizLogicInstance) {
        window.quizLogicInstance.setCurrentUser(user);
        console.log("User set on QuizLogic instance");
    } else {
        console.error("Failed to create or access QuizLogic instance");
    }
    
    // Also initialize the players list manager
    const waitForSocket = () => {
        if (window.sharedSocket) {
            console.log("Socket available, initializing players list manager");
            if (typeof initializePlayersListManager === 'function') {
                const playersManager = initializePlayersListManager(window.sharedSocket, user);
                console.log("Players list manager initialized:", playersManager);
            } else {
                console.warn("initializePlayersListManager function not found");
            }
        } else {
            console.log("Waiting for socket...");
            setTimeout(waitForSocket, 100);
        }
    };
    
    waitForSocket();
});