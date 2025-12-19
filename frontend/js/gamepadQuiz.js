class QuizGamepadNavigator {
    constructor() {
        this.gamepadIndex = null;
        this.buttonStates = {
            dpadUp: false,
            dpadDown: false,
            dpadLeft: false,
            dpadRight: false,
            buttonA: false,
            buttonB: false,
            buttonX: false,
            buttonY: false,
            buttonSelect: false,
            buttonStart: false
        };

        // Navigation contexts - now includes question
        this.contexts = ['items', 'question', 'answers', 'playerlist'];
        this.currentContext = 0;
        this.currentItemIndex = 0; // For items (0-2)
        this.currentPlayerIndex = 0; // For player list
        
        // Double press detection for down button
        this.lastDownPress = 0;
        this.doublePressThreshold = 250; // 250ms

        this.init();
    }

    init() {
        this.addStyles();
        this.setupGamepadDetection();
        this.gamepadLoop();
        this.setupStorageKeys(); // Set up local storage credentials
    }

    // This method now sets the storage keys.
    setupStorageKeys() {
        // Directly use key names since STORAGE_KEYS is not defined in this class
        localStorage.setItem('quizUserFirstName', 'gamepad');
        localStorage.setItem('quizUserLastName', 'user');
        localStorage.setItem('quizUserPassword', 'gamepaduser');
        console.log('Local Storage credentials updated for Gamepad Navigator.');
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Removed the outline styling as it's no longer needed */
            .quiz-gamepad-context-highlight {
                background-color: rgba(13, 97, 170, 0.1) !important;
                border-radius: 8px;
            }

            /* Hide chat and lofi player when gamepad is active */
            body.gamepad-active #lofi-player-icon,
            body.gamepad-active #lofi-player-modal,
            body.gamepad-active .c-chat-container {
                display: none !important;
            }

            /* Ensure answer buttons are clearly visible */
            .answer-box .snes-button {
                transition: all 0.2s ease;
            }

            .answer-box.quiz-gamepad-selected .snes-button {
                transform: scale(1.05);
            }
        `;
        document.head.appendChild(style);
    }

    setupGamepadDetection() {
        const handleGamepadConnected = (e) => {
            console.log('Gamepad connected:', e.gamepad);
            if (this.gamepadIndex === null) {
                this.gamepadIndex = e.gamepad.index;
                document.body.classList.add('gamepad-active');
                this.updateSelection();
            }
        };

        const handleGamepadDisconnected = (e) => {
            console.log('Gamepad disconnected');
            if (this.gamepadIndex === e.gamepad.index) {
                this.gamepadIndex = null;
                
                // Check for another available gamepad
                const gamepads = navigator.getGamepads();
                for (let i = 0; i < gamepads.length; i++) {
                    if (gamepads[i] && gamepads[i].connected) {
                        this.gamepadIndex = gamepads[i].index;
                        console.log('Switched to another connected gamepad:', gamepads[i]);
                        break;
                    }
                }

                // If no other gamepad found, remove gamepad mode
                if (this.gamepadIndex === null) {
                    document.body.classList.remove('gamepad-active');
                    this.clearSelection();
                }
            }
        };

        window.addEventListener('gamepadconnected', handleGamepadConnected);
        window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

        // Check for already connected gamepads
        const initialGamepads = navigator.getGamepads();
        for (let i = 0; i < initialGamepads.length; i++) {
            if (initialGamepads[i] && initialGamepads[i].connected) {
                this.gamepadIndex = initialGamepads[i].index;
                document.body.classList.add('gamepad-active');
                console.log('Initially connected gamepad:', initialGamepads[i]);
                this.updateSelection();
                break;
            }
        }
    }

    gamepadLoop() {
        const gamepads = navigator.getGamepads();

        if (this.gamepadIndex !== null && gamepads[this.gamepadIndex]) {
            this.handleGamepadInput(gamepads[this.gamepadIndex]);
        }

        requestAnimationFrame(() => this.gamepadLoop());
    }

handleGamepadInput(gamepad) {
    const buttonA = gamepad.buttons[1]?.pressed || false;  // Right button (Confirm)
    const buttonB = gamepad.buttons[2]?.pressed || false;  // Bottom button (Cancel)
    const buttonX = gamepad.buttons[0]?.pressed || false;  // Left button
    const buttonY = gamepad.buttons[3]?.pressed || false;  // Top button
    const buttonSelect = gamepad.buttons[8]?.pressed || false;
    const buttonStart = gamepad.buttons[9]?.pressed || false;

    const axis0 = gamepad.axes[0];
    const axis1 = gamepad.axes[1];
    const axisThreshold = 0.5;

    const dpadUp = axis1 < -axisThreshold;
    const dpadDown = axis1 > axisThreshold;
    const dpadLeft = axis0 < -axisThreshold;
    const dpadRight = axis0 > axisThreshold;

    // Handle input changes (only on press, not hold)
    if (dpadUp && !this.buttonStates.dpadUp) {
        this.handleUp();
    }
    if (dpadDown && !this.buttonStates.dpadDown) {
        this.handleDown();
    }
    if (dpadLeft && !this.buttonStates.dpadLeft) {
        this.handleLeft();
    }
    if (dpadRight && !this.buttonStates.dpadRight) {
        this.handleRight();
    }

    if (buttonA && !this.buttonStates.buttonA) {
        this.handleAnswerButton('A');  // A button (right) is A
    }
    if (buttonB && !this.buttonStates.buttonB) {
        this.handleAnswerButton('B');  // B button (bottom) is B
    }
    if (buttonX && !this.buttonStates.buttonX) {
        this.handleAnswerButton('X');  // X button (left) is X
    }
    if (buttonY && !this.buttonStates.buttonY) {
        this.handleAnswerButton('Y');  // Y button (top) is Y
    }

    if (buttonSelect && !this.buttonStates.buttonSelect) {
        this.handleSelect();
    }
    if (buttonStart && !this.buttonStates.buttonStart) {
        this.handleStart();
    }

    // Update button states
    this.buttonStates = {
        dpadUp, dpadDown, dpadLeft, dpadRight,
        buttonA, buttonB, buttonX, buttonY,
        buttonSelect, buttonStart
    };
}

    handleUp() {
        const context = this.contexts[this.currentContext];
        
        if (context === 'items') {
            // Click item slot 1 (index 0)
            this.clickItemSlot(0);
        } else if (context === 'playerlist') {
            // Navigate up through players, cycling back to bottom
            const playerElements = document.querySelectorAll('.c-player-item');
            if (playerElements.length > 0) {
                this.currentPlayerIndex = (this.currentPlayerIndex - 1 + playerElements.length) % playerElements.length;
                this.updateSelection();
            }
        }
    }

    handleDown() {
        const now = Date.now();
        const context = this.contexts[this.currentContext];
        
        // Check for double press
        if (now - this.lastDownPress < this.doublePressThreshold) {
            // Double press behavior depends on current context
            if (context === 'items' || context === 'question' || context === 'answers') {
                // Go to players
                this.currentContext = 3; // playerlist
                this.currentPlayerIndex = 0;
            } else if (context === 'playerlist') {
                // Go back to items
                this.currentContext = 0; // items
                this.currentItemIndex = 0;
            }
            
            this.updateSelection();
            this.lastDownPress = 0; // Reset to prevent triple press
            return;
        }
        
        this.lastDownPress = now;

        if (context === 'items') {
            // Go to question
            this.currentContext = 1;
        } else if (context === 'question') {
            // Go to answers
            this.currentContext = 2;
        } else if (context === 'answers') {
            // Cycle back to items
            this.currentContext = 0;
        } else if (context === 'playerlist') {
            // Navigate down through players, cycling back to top
            const playerElements = document.querySelectorAll('.c-player-item');
            if (playerElements.length > 0) {
                this.currentPlayerIndex = (this.currentPlayerIndex + 1) % playerElements.length;
            }
        }
        
        this.updateSelection();
    }

    handleLeft() {
        const context = this.contexts[this.currentContext];
        
        if (context === 'items') {
            // Click item slot 2 (index 1)
            this.clickItemSlot(1);
        }
    }

    handleRight() {
        const context = this.contexts[this.currentContext];
        
        if (context === 'items') {
            // Click item slot 3 (index 2)
            this.clickItemSlot(2);
        }
    }

    clickItemSlot(index) {
        const itemSlots = document.querySelectorAll('.c-item-slot');
        if (itemSlots[index]) {
            // Direct click on the item slot element
            itemSlots[index].click();
            console.log(`Clicked item slot ${index + 1}`);
        }
    }

    handleAnswerButton(buttonLetter) {
        // Find and click the corresponding answer button
        const answerBoxes = document.querySelectorAll('.answer-box');
        
        for (let box of answerBoxes) {
            const buttonLabel = box.querySelector('.button-label');
            if (buttonLabel && buttonLabel.textContent.trim() === buttonLetter) {
                const button = box.querySelector('.snes-button');
                if (button) {
                    button.click();
                    console.log(`${buttonLetter} button pressed - clicked answer:`, button);
                    break;
                }
            }
        }
    }

    handleSelect() {
        // Emergency exit - always go back to index.html
        console.log('Select button pressed - emergency exit to index.html');
        window.location.href = '/index.html';
    }

    handleStart() {
        // Refresh the page
        console.log('Start button pressed - reloading page...');
        location.reload();
    }

    updateSelection() {
        // Clear all existing selections
        this.clearSelection();

        if (this.gamepadIndex === null) return;

        const context = this.contexts[this.currentContext];
        let targetElement = null;

        switch (context) {
            case 'items':
                const itemsContainer = document.querySelector('.c-items-container');
                if (itemsContainer) {
                    itemsContainer.classList.add('quiz-gamepad-context-highlight');
                    targetElement = itemsContainer;
                }
                break;

            case 'question':
                const questionContainer = document.querySelector('.c-question-container');
                if (questionContainer) {
                    questionContainer.classList.add('quiz-gamepad-context-highlight');
                    targetElement = questionContainer;
                }
                break;

            case 'answers':
                const answersContainer = document.querySelector('.c-answers-container');
                if (answersContainer) {
                    answersContainer.classList.add('quiz-gamepad-context-highlight');
                    targetElement = answersContainer;
                }
                break;

            case 'playerlist':
                const playerElements = document.querySelectorAll('.c-player-item');
                if (playerElements[this.currentPlayerIndex]) {
                    targetElement = playerElements[this.currentPlayerIndex];
                    targetElement.classList.add('quiz-gamepad-context-highlight');
                    // Also highlight the entire players container
                    const playersContainer = document.querySelector('.c-players-container');
                    if (playersContainer) {
                        playersContainer.classList.add('quiz-gamepad-context-highlight');
                    }
                }
                break;
        }

        if (targetElement) {
            // Smooth scroll to the selected element
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    }

    clearSelection() {
        // Remove all selection classes
        document.querySelectorAll('.quiz-gamepad-selected').forEach(el => {
            el.classList.remove('quiz-gamepad-selected');
        });
        
        document.querySelectorAll('.quiz-gamepad-context-highlight').forEach(el => {
            el.classList.remove('quiz-gamepad-context-highlight');
        });
    }

    // Public method to get current context info (for debugging)
    getCurrentState() {
        return {
            context: this.contexts[this.currentContext],
            itemIndex: this.currentItemIndex,
            playerIndex: this.currentPlayerIndex,
            gamepadConnected: this.gamepadIndex !== null
        };
    }
}

// Initialize the gamepad navigator
document.addEventListener('DOMContentLoaded', () => {
    if (!window.quizGamepadNavigator) {
        window.quizGamepadNavigator = new QuizGamepadNavigator();
        console.log('Quiz Gamepad Navigator initialized. Connect a gamepad to start navigating!');
    }
});

// Also initialize if DOM is already loaded
if (document.readyState !== 'loading') {
    if (!window.quizGamepadNavigator) {
        window.quizGamepadNavigator = new QuizGamepadNavigator();
        console.log('Quiz Gamepad Navigator initialized. Connect a gamepad to start navigating!');
    }
}