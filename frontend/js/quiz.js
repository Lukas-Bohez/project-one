// main-quiz-logic.js
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
    // In QuizLogic's initializeModules() method
    initializeModules() {
        // Initialize question handler FIRST
        this.questionHandler = new QuizQuestionHandler(this, this.socket);
        
        // Then initialize socket handler with proper reference
        this.socketHandler = new QuizSocketHandler(this.socket, this.questionHandler); // Pass question handler directly
        
        // Rest of initialization
        this.timerHandler = new QuizTimerHandler();
        this.playerHandler = new QuizPlayerHandler(this);
        
        console.log("All quiz modules initialized with proper references");
    }

    // Main methods that delegate to modules
    setCurrentUser(user) {
    console.log("Setting current user:", user);
    this.currentUser = user;
    this.playerHandler.requestAllUsersData(this.socket);
    // Make sure the question handler also knows the user!
    if (this.questionHandler) {
        this.questionHandler.setCurrentUser(user);
    }
}

    getCurrentUser() {
        return this.currentUser;
    }

    // Delegate methods to appropriate handlers
    updateTimer(timeRemaining) {
        this.timerHandler.updateTimer(timeRemaining);
    }

    handleTimerFinished() {
        this.timerHandler.handleTimerFinished();
    }

    updatePlayersDisplay() {
        this.playerHandler.updatePlayersDisplay();
    }

    loadQuestion(questionData) {
    this.currentQuestion = questionData;
    if (this.questionHandler && this.currentUser) {
        this.questionHandler.setCurrentUser(this.currentUser);
    }
    this.questionHandler.loadQuestion(questionData);
}

    handleAnswerClick(answerIndex, buttonElement) {
        this.questionHandler.handleAnswerClick(answerIndex, buttonElement, this.socket, this.currentUser, this.currentQuestion);
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
    // In main-quiz-logic.js - QuizLogic class
    showExplanation(data) {
    console.log("Delegating explanation to question handler");
    if (this.questionHandler && this.questionHandler.showExplanation) {
        this.questionHandler.showExplanation(data);
    } else {
        console.error("Question handler missing or broken");
    }
}

    // Stub methods
    updateItems(itemsData) { /* ... */ }
    updateGameState(gameState) { /* ... */ }
    bindGlobalEvents() { /* ... */ }
    useItem(itemIndex) { /* ... */ }
    deleteItem(itemIndex) { /* ... */ }
    updateUserScore(newScore) { /* ... */ }
    updateUserLP(newLP) { /* ... */ }
    updateUserSP(newSP) { /* ... */ }
    showWelcomeMessage(user) { /* ... */ }
    initInfoModal() { /* ... */ }
    listenToInfoModal(domElements) { /* ... */ }
}

window.QuizLogic = QuizLogic;