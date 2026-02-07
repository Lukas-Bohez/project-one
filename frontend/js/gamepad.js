class GamepadNavigator {
    constructor() {
        this.gamepadIndex = null;
        this.navigableElements = [];
        this.currentSelectedIndex = 0;
        this.buttonStates = {
            dpadUp: false,
            dpadDown: false,
            dpadLeft: false,
            dpadRight: false,
            buttonA: false,
            buttonB: false,
            buttonX: false,
            buttonY: false,
            buttonL: false,
            buttonR: false,
            buttonSelect: false,
            buttonStart: false
        };

        this.updateTimeout = null;

        // Define STORAGE_KEYS as a class property for easier access
        this.STORAGE_KEYS = {
            USER: {
                USER_ID: 'user_user_id',
                FIRST_NAME: 'user_first_name',
                LAST_NAME: 'user_last_name',
                PASSWORD: 'user_password'
            }
        };

        this.init();
    }

    init() {
        this.addStyles();
        this.setupGamepadDetection();
        this.gamepadLoop();
        this.updateNavigableElements();
        this.observeDOMChanges();
        // The call to setupStorageKeys() is removed from here.
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .gamepad-selected {
                border: 2px solid #0d61aa !important;
                box-shadow: 0 0 5px rgba(13, 97, 170, 0.5) !important;
            }

            .gamepad-navigable {
                transition: border 0.2s ease, box-shadow 0.2s ease;
            }

            body.gamepad-active #lofi-player-icon,
            body.gamepad-active .c-chat-container {
                display: none !important;
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
                // Set storage keys on new connection
                this.setupStorageKeys();
            }
        };

        const handleGamepadDisconnected = (e) => {
            console.log('Gamepad disconnected');
            if (this.gamepadIndex === e.gamepad.index) {
                this.gamepadIndex = null; // Tentatively set to null
                
                // Check for another available gamepad
                const gamepads = navigator.getGamepads();
                for (let i = 0; i < gamepads.length; i++) {
                    if (gamepads[i] && gamepads[i].connected) {
                        this.gamepadIndex = gamepads[i].index; // Found a new one
                        console.log('Switched to another connected gamepad:', gamepads[i]);
                        break;
                    }
                }

                // If no other gamepad was found, finalize disconnection state
                if (this.gamepadIndex === null) {
                    document.body.classList.remove('gamepad-active');
                    this.updateSelection();
                    // Clear storage keys as no gamepad is active
                    this.clearStorageKeys();
                }
            }
        };


        window.addEventListener('gamepadconnected', handleGamepadConnected);
        window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

        // Check for already connected gamepads on initialization
        const initialGamepads = navigator.getGamepads();
        for (let i = 0; i < initialGamepads.length; i++) {
            if (initialGamepads[i] && initialGamepads[i].connected) {
                this.gamepadIndex = initialGamepads[i].index;
                document.body.classList.add('gamepad-active');
                console.log('Initially connected gamepad:', initialGamepads[i]);
                // Set storage keys for the initially found gamepad
                this.setupStorageKeys();
                break;
            }
        }
    }

    updateNavigableElements() {
        const gamepadElements = document.querySelectorAll('.gamepad');

        this.navigableElements = Array.from(gamepadElements).filter(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 &&
                style.visibility !== 'hidden' &&
                style.display !== 'none';
        });

        this.navigableElements = [...new Set(this.navigableElements)].sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            if (rectA.top !== rectB.top) {
                return rectA.top - rectB.top;
            }
            return rectA.left - rectB.left;
        });

        this.navigableElements.forEach(el => {
            el.classList.add('gamepad-navigable');
        });

        if (this.currentSelectedIndex >= this.navigableElements.length) {
            this.currentSelectedIndex = Math.max(0, this.navigableElements.length - 1);
        } else if (this.currentSelectedIndex < 0 && this.navigableElements.length > 0) {
            this.currentSelectedIndex = 0;
        }

        this.updateSelection();
    }

    observeDOMChanges() {
        const observer = new MutationObserver(() => {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = setTimeout(() => {
                this.updateNavigableElements();
            }, 100);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'tabindex']
        });
    }

    gamepadLoop() {
        const gamepads = navigator.getGamepads();

        if (this.gamepadIndex !== null && gamepads[this.gamepadIndex]) {
            this.handleGamepadInput(gamepads[this.gamepadIndex]);
        }

        requestAnimationFrame(() => this.gamepadLoop());
    }

    handleGamepadInput(gamepad) {
        const buttonA = gamepad.buttons[1]?.pressed || false;
        const buttonB = gamepad.buttons[2]?.pressed || false;
        const buttonX = gamepad.buttons[3]?.pressed || false;
        const buttonY = gamepad.buttons[0]?.pressed || false;
        const buttonL = gamepad.buttons[4]?.pressed || false;
        const buttonR = gamepad.buttons[5]?.pressed || false;
        const buttonSelect = gamepad.buttons[6]?.pressed || false;
        const buttonStart = gamepad.buttons[9]?.pressed || false;

        const axis0 = gamepad.axes[0];
        const axis1 = gamepad.axes[1];

        const axisThreshold = 0.5;

        const dpadUp = axis1 < -axisThreshold;
        const dpadDown = axis1 > axisThreshold;
        const dpadLeft = axis0 < -axisThreshold;
        const dpadRight = axis0 > axisThreshold;

        if (dpadUp && !this.buttonStates.dpadUp) {
            this.navigateUp();
        }
        if (dpadDown && !this.buttonStates.dpadDown) {
            this.navigateDown();
        }
        if (dpadLeft && !this.buttonStates.dpadLeft) {
            this.navigateLeft();
        }
        if (dpadRight && !this.buttonStates.dpadRight) {
            this.navigateRight();
        }

        if (buttonA && !this.buttonStates.buttonA) {
            this.handleAButton();
        }
        if (buttonB && !this.buttonStates.buttonB) {
            this.handleBButton();
        }
        if (buttonX && !this.buttonStates.buttonX) {
            this.handleXButton();
        }
        if (buttonY && !this.buttonStates.buttonY) {
            this.handleYButton();
        }
        if (buttonL && !this.buttonStates.buttonL) {
            this.handleLButton();
        }
        if (buttonR && !this.buttonStates.buttonR) {
            this.handleRButton();
        }
        if (buttonStart && !this.buttonStates.buttonStart) {
            console.log('Start button pressed - reloading page...');
            location.reload();
        }

        this.buttonStates = {
            dpadUp, dpadDown, dpadLeft, dpadRight,
            buttonA, buttonB, buttonX, buttonY,
            buttonL, buttonR, buttonSelect, buttonStart
        };
    }

    calculateDistance(rect1, rect2, direction) {
        let distance = 0;
        switch (direction) {
            case 'up':
                if (rect2.bottom < rect1.top) {
                    distance = (rect1.top - rect2.bottom) + Math.abs((rect1.left + rect1.width / 2) - (rect2.left + rect2.width / 2));
                } else {
                    distance = Infinity;
                }
                break;
            case 'down':
                if (rect2.top > rect1.bottom) {
                    distance = (rect2.top - rect1.bottom) + Math.abs((rect1.left + rect1.width / 2) - (rect2.left + rect2.width / 2));
                } else {
                    distance = Infinity;
                }
                break;
            case 'left':
                if (rect2.right < rect1.left) {
                    distance = (rect1.left - rect2.right) + Math.abs((rect1.top + rect1.height / 2) - (rect2.top + rect2.height / 2));
                } else {
                    distance = Infinity;
                }
                break;
            case 'right':
                if (rect2.left > rect1.right) {
                    distance = (rect2.left - rect1.right) + Math.abs((rect1.top + rect1.height / 2) - (rect2.top + rect2.height / 2));
                } else {
                    distance = Infinity;
                }
                break;
        }
        return distance;
    }

    navigateUp() {
        if (this.navigableElements.length === 0) return;

        const currentElement = this.navigableElements[this.currentSelectedIndex];
        const currentRect = currentElement.getBoundingClientRect();

        let bestIndex = -1;
        let bestDistance = Infinity;

        for (let i = 0; i < this.navigableElements.length; i++) {
            if (i === this.currentSelectedIndex) continue;

            const rect = this.navigableElements[i].getBoundingClientRect();
            const distance = this.calculateDistance(currentRect, rect, 'up');

            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = i;
            }
        }

        if (bestIndex !== -1 && bestIndex !== this.currentSelectedIndex) {
            this.currentSelectedIndex = bestIndex;
        } else {
            this.currentSelectedIndex = this.navigableElements.length - 1;
        }
        this.updateSelection();
    }

    navigateDown() {
        if (this.navigableElements.length === 0) return;

        const currentElement = this.navigableElements[this.currentSelectedIndex];
        const currentRect = currentElement.getBoundingClientRect();

        let bestIndex = -1;
        let bestDistance = Infinity;

        for (let i = 0; i < this.navigableElements.length; i++) {
            if (i === this.currentSelectedIndex) continue;

            const rect = this.navigableElements[i].getBoundingClientRect();
            const distance = this.calculateDistance(currentRect, rect, 'down');

            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = i;
            }
        }

        if (bestIndex !== -1 && bestIndex !== this.currentSelectedIndex) {
            this.currentSelectedIndex = bestIndex;
        } else {
            this.currentSelectedIndex = 0;
        }
        this.updateSelection();
    }

    navigateLeft() {
        if (this.navigableElements.length === 0) return;

        const currentElement = this.navigableElements[this.currentSelectedIndex];
        const currentRect = currentElement.getBoundingClientRect();

        let bestIndex = -1;
        let bestDistance = Infinity;

        for (let i = 0; i < this.navigableElements.length; i++) {
            if (i === this.currentSelectedIndex) continue;

            const rect = this.navigableElements[i].getBoundingClientRect();
            const distance = this.calculateDistance(currentRect, rect, 'left');

            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = i;
            }
        }

        if (bestIndex !== -1 && bestIndex !== this.currentSelectedIndex) {
            this.currentSelectedIndex = bestIndex;
        } else {
            this.currentSelectedIndex = this.navigableElements.length - 1;
        }
        this.updateSelection();
    }

    navigateRight() {
        if (this.navigableElements.length === 0) return;

        const currentElement = this.navigableElements[this.currentSelectedIndex];
        const currentRect = currentElement.getBoundingClientRect();

        let bestIndex = -1;
        let bestDistance = Infinity;

        for (let i = 0; i < this.navigableElements.length; i++) {
            if (i === this.currentSelectedIndex) continue;

            const rect = this.navigableElements[i].getBoundingClientRect();
            const distance = this.calculateDistance(currentRect, rect, 'right');

            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = i;
            }
        }

        if (bestIndex !== -1 && bestIndex !== this.currentSelectedIndex) {
            this.currentSelectedIndex = bestIndex;
        } else {
            this.currentSelectedIndex = 0;
        }
        this.updateSelection();
    }

    handleAButton() {
        if (this.navigableElements.length === 0) return;

        const selectedElement = this.navigableElements[this.currentSelectedIndex];
        selectedElement.click();

        if (selectedElement.focus) {
            selectedElement.focus();
        }

        console.log('A button pressed - clicked:', selectedElement);
    }

    handleBButton() {
        console.log('B button pressed - Right mouse button action (not implemented in JS)');
    }

    handleXButton() {
        console.log('X button pressed - "j" key action (not implemented in JS)');
    }

    handleYButton() {
        console.log('Y button pressed - "l" key action (not implemented in JS)');
    }

    handleLButton() {
        console.log('L button pressed - Volume up action (not implemented in JS)');
    }

    handleRButton() {
        console.log('R button pressed - Volume down action (not implemented in JS)');
    }

    updateSelection() {
        document.querySelectorAll('.gamepad-selected').forEach(el => {
            el.classList.remove('gamepad-selected');
        });

        if (this.gamepadIndex !== null && this.navigableElements.length > 0 && this.navigableElements[this.currentSelectedIndex]) {
            const selectedElement = this.navigableElements[this.currentSelectedIndex];
            selectedElement.classList.add('gamepad-selected');

            selectedElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    }

    selectElement(element) {
        const index = this.navigableElements.indexOf(element);
        if (index !== -1) {
            this.currentSelectedIndex = index;
            this.updateSelection();
        }
    }

    getCurrentElement() {
        return this.navigableElements[this.currentSelectedIndex] || null;
    }
    
    // This method now sets the storage keys.
    setupStorageKeys() {
        localStorage.setItem(this.STORAGE_KEYS.USER.FIRST_NAME, 'gamepad');
        localStorage.setItem(this.STORAGE_KEYS.USER.LAST_NAME, 'user');
        localStorage.setItem(this.STORAGE_KEYS.USER.PASSWORD, 'gamepaduser');
        console.log('Local Storage credentials updated for Gamepad Navigator.');
    }

    // New method to clear the storage keys.
    clearStorageKeys() {
        localStorage.removeItem(this.STORAGE_KEYS.USER.FIRST_NAME);
        localStorage.removeItem(this.STORAGE_KEYS.USER.LAST_NAME);
        localStorage.removeItem(this.STORAGE_KEYS.USER.PASSWORD);
        console.log('Local Storage credentials for Gamepad Navigator cleared.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!window.gamepadNavigator) {
        window.gamepadNavigator = new GamepadNavigator();
        console.log('Gamepad Navigator initialized. Connect a gamepad to start navigating!');
    }
});

if (document.readyState !== 'loading') {
    if (!window.gamepadNavigator) {
        window.gamepadNavigator = new GamepadNavigator();
        console.log('Gamepad Navigator initialized. Connect a gamepad to start navigating!');
    }
}