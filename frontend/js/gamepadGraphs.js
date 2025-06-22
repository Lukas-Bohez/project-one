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
        this.init();
    }

    init() {
        this.addStyles();
        this.setupGamepadDetection();
        this.gamepadLoop();
        this.updateNavigableElements();
        this.observeDOMChanges();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .gamepad-selected {
                border: 2px solid #0d61aa !important;
                box-shadow: 0 0 5px rgba(13, 97, 170, 0.5) !important;
                position: relative;
            }
            .gamepad-selected::after {
                content: '';
                position: absolute;
                top: -4px;
                left: -4px;
                right: -4px;
                bottom: -4px;
                border: 2px dashed rgba(13, 97, 170, 0.5);
                border-radius: inherit;
                pointer-events: none;
                animation: pulse 1.5s infinite;
            }
            @keyframes pulse {
                0% { opacity: 0.7; }
                50% { opacity: 0.3; }
                100% { opacity: 0.7; }
            }
            .gamepad-navigable {
                transition: all 0.2s ease;
            }
            body.gamepad-active #lofi-player-icon,
            body.gamepad-active .c-chat-container {
                display: none !important;
            }
            .gamepad-scroll-indicator {
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(13, 97, 170, 0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                z-index: 1000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .gamepad-selected .gamepad-scroll-indicator {
                opacity: 1;
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
                const gamepads = navigator.getGamepads();
                for (let i = 0; i < gamepads.length; i++) {
                    if (gamepads[i] && gamepads[i].connected) {
                        this.gamepadIndex = gamepads[i].index;
                        console.log('Switched to another connected gamepad:', gamepads[i]);
                        break;
                    }
                }

                if (this.gamepadIndex === null) {
                    document.body.classList.remove('gamepad-active');
                    this.updateSelection();
                }
            }
        };

        window.addEventListener('gamepadconnected', handleGamepadConnected);
        window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

        const initialGamepads = navigator.getGamepads();
        for (let i = 0; i < initialGamepads.length; i++) {
            if (initialGamepads[i] && initialGamepads[i].connected) {
                this.gamepadIndex = initialGamepads[i].index;
                document.body.classList.add('gamepad-active');
                console.log('Initially connected gamepad:', initialGamepads[i]);
                break;
            }
        }
    }

    updateNavigableElements() {
        // Include toggle containers in the selectable elements
        const gamepadElements = document.querySelectorAll('.gamepad, .gamepad-chart-container, .toggle-container');

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
            
            // Add scroll indicator for toggle containers
            if (el.classList.contains('toggle-container') && !el.querySelector('.gamepad-scroll-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'gamepad-scroll-indicator';
                indicator.textContent = '← → Scroll';
                el.style.position = 'relative';
                el.appendChild(indicator);
            }
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

    // Check if the current element is a select element
    isSelectElement(element) {
        return element && element.tagName && element.tagName.toLowerCase() === 'select';
    }

    // Check if the current element is a toggle container
    isToggleContainer(element) {
        return element && element.classList && element.classList.contains('toggle-container');
    }

    // Navigate through select options
    navigateSelectOption(direction) {
        const selectedElement = this.navigableElements[this.currentSelectedIndex];
        if (!this.isSelectElement(selectedElement)) return false;

        const currentIndex = selectedElement.selectedIndex;
        const options = selectedElement.options;
        
        if (direction === 'left' && currentIndex > 0) {
            selectedElement.selectedIndex = currentIndex - 1;
            // Trigger change event
            const changeEvent = new Event('change', { bubbles: true });
            selectedElement.dispatchEvent(changeEvent);
            console.log('Select option changed to:', selectedElement.options[selectedElement.selectedIndex].text);
            return true;
        } else if (direction === 'right' && currentIndex < options.length - 1) {
            selectedElement.selectedIndex = currentIndex + 1;
            // Trigger change event
            const changeEvent = new Event('change', { bubbles: true });
            selectedElement.dispatchEvent(changeEvent);
            console.log('Select option changed to:', selectedElement.options[selectedElement.selectedIndex].text);
            return true;
        }
        
        return false;
    }

    // Scroll toggle container
    scrollToggleContainer(direction) {
        const selectedElement = this.navigableElements[this.currentSelectedIndex];
        if (!this.isToggleContainer(selectedElement)) return false;

        // Find the scrollable content within the toggle container
        const scrollableContent = selectedElement.querySelector('.toggle-content');
        if (!scrollableContent) return false;

        const scrollAmount = 50; // pixels to scroll
        const currentScrollTop = scrollableContent.scrollTop;
        const maxScrollTop = scrollableContent.scrollHeight - scrollableContent.clientHeight;

        if (direction === 'left') { // Scroll up
            const newScrollTop = Math.max(0, currentScrollTop - scrollAmount);
            scrollableContent.scrollTo({
                top: newScrollTop,
                behavior: 'smooth'
            });
            console.log('Toggle container scrolled up');
            return true;
        } else if (direction === 'right') { // Scroll down
            const newScrollTop = Math.min(maxScrollTop, currentScrollTop + scrollAmount);
            scrollableContent.scrollTo({
                top: newScrollTop,
                behavior: 'smooth'
            });
            console.log('Toggle container scrolled down');
            return true;
        }
        
        return false;
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

        // Check if current element is a select and handle option navigation
        if (this.navigateSelectOption('left')) {
            return; // Option was changed, don't navigate to another element
        }

        // Check if current element is a toggle container and handle scrolling
        if (this.scrollToggleContainer('left')) {
            return; // Container was scrolled, don't navigate to another element
        }

        // Normal left navigation between elements
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

        // Check if current element is a select and handle option navigation
        if (this.navigateSelectOption('right')) {
            return; // Option was changed, don't navigate to another element
        }

        // Check if current element is a toggle container and handle scrolling
        if (this.scrollToggleContainer('right')) {
            return; // Container was scrolled, don't navigate to another element
        }

        // Normal right navigation between elements
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
        
        // Special handling for chart containers
        if (selectedElement.classList.contains('gamepad-chart-container')) {
            // Just focus the chart container, don't zoom
            if (selectedElement.focus) {
                selectedElement.focus();
            }
            return;
        }

        // Special handling for toggle containers
        if (selectedElement.classList.contains('toggle-container')) {
            // Trigger the toggle functionality by clicking the header
            const header = selectedElement.querySelector('.toggle-header');
            if (header && header.click) {
                header.click();
            } else if (selectedElement.focus) {
                selectedElement.focus();
            }
            return;
        }

        // Default click behavior
        if (selectedElement.click) {
            selectedElement.click();
        }

        if (selectedElement.focus) {
            selectedElement.focus();
        }
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
}

// Initialize when DOM is ready
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