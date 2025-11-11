/**
 * devMenu.js - Developer Menu for rebirth testing
 * Unlocked with password "CapitalismIsDead" - revealed as reward for reaching final rebirth
 */

class DeveloperMenu {
    constructor(gameEngine) {
        console.log('DeveloperMenu constructor called');
        this.gameEngine = gameEngine;
        this.isUnlocked = false;
        this.password = "CapitalismIsDead";
        
        this.initializeEventListeners();
        this.checkFinalRebirthReward();
        console.log('DeveloperMenu initialized successfully');
    }
    
    initializeEventListeners() {
        console.log('Initializing dev menu event listeners...');
        // Open developer menu
        const devMenuBtn = document.getElementById('dev-menu-btn');
        console.log('Dev menu button found:', devMenuBtn);
        if (devMenuBtn) {
            devMenuBtn.addEventListener('click', () => {
                console.log('Dev menu button clicked!');
                this.openDevMenu();
            });
            console.log('Click listener added to dev menu button');
        } else {
            console.error('Dev menu button not found!');
        }
        
        // Close developer menu
        const closeDevMenu = document.getElementById('close-dev-menu');
        const closeDevMenuBtn = document.getElementById('close-dev-menu-btn');
        if (closeDevMenu) {
            closeDevMenu.addEventListener('click', () => this.closeDevMenu());
        }
        if (closeDevMenuBtn) {
            closeDevMenuBtn.addEventListener('click', () => this.closeDevMenu());
        }
        
        // Unlock button
        const unlockBtn = document.getElementById('dev-unlock-btn');
        if (unlockBtn) {
            unlockBtn.addEventListener('click', () => this.attemptUnlock());
        }
        
        // Allow Enter key to unlock
        const passwordInput = document.getElementById('dev-password');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.attemptUnlock();
                }
            });
        }
        
        // Apply rebirth button
        const applyRebirthBtn = document.getElementById('apply-rebirth-btn');
        if (applyRebirthBtn) {
            applyRebirthBtn.addEventListener('click', () => this.applyRebirth());
        }
        
        // Close modal on outside click
        const modal = document.getElementById('dev-menu-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeDevMenu();
                }
            });
        }
    }
    
    checkFinalRebirthReward() {
        // Check every second if player has reached final rebirth (rebirth 9 = The Void)
        setInterval(() => {
            const rebirths = this.gameEngine?.state?.city?.rebirths || 0;
            const rewardDiv = document.getElementById('final-rebirth-reward');
            
            if (rebirths >= 9 && rewardDiv) {
                rewardDiv.style.display = 'block';
            }
        }, 1000);
    }
    
    openDevMenu() {
        console.log('openDevMenu called');
        const modal = document.getElementById('dev-menu-modal');
        console.log('Modal element:', modal);
        if (modal) {
            console.log('Setting modal to display flex');
            modal.classList.add('show');
            modal.style.display = 'flex';
            console.log('Modal display set to:', modal.style.display);
        } else {
            console.error('Modal element not found!');
        }
    }
    
    closeDevMenu() {
        const modal = document.getElementById('dev-menu-modal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
        }
        
        // Clear password input
        const passwordInput = document.getElementById('dev-password');
        if (passwordInput) {
            passwordInput.value = '';
        }
        
        // Hide error
        const errorMsg = document.getElementById('dev-password-error');
        if (errorMsg) {
            errorMsg.style.display = 'none';
        }
    }
    
    attemptUnlock() {
        const passwordInput = document.getElementById('dev-password');
        const errorMsg = document.getElementById('dev-password-error');
        const passwordSection = document.getElementById('dev-password-section');
        const contentSection = document.getElementById('dev-menu-content');
        
        if (!passwordInput) return;
        
        const enteredPassword = passwordInput.value;
        
        if (enteredPassword === this.password) {
            // Correct password!
            this.isUnlocked = true;
            
            if (passwordSection) passwordSection.style.display = 'none';
            if (contentSection) contentSection.style.display = 'block';
            if (errorMsg) errorMsg.style.display = 'none';
            
            // Update selector to current rebirth
            this.updateRebirthSelector();
            
            console.log('Developer menu unlocked!');
        } else {
            // Wrong password
            if (errorMsg) {
                errorMsg.style.display = 'block';
            }
            
            // Shake animation
            if (passwordInput) {
                passwordInput.style.animation = 'shake 0.5s';
                setTimeout(() => {
                    passwordInput.style.animation = '';
                }, 500);
            }
        }
    }
    
    updateRebirthSelector() {
        const selector = document.getElementById('rebirth-selector');
        if (selector && this.gameEngine?.state?.city) {
            const currentRebirths = this.gameEngine.state.city.rebirths || 0;
            selector.value = currentRebirths.toString();
        }
    }
    
    applyRebirth() {
        const selector = document.getElementById('rebirth-selector');
        if (!selector || !this.gameEngine?.state?.city) return;
        
        const targetRebirth = parseInt(selector.value);
        const currentRebirth = this.gameEngine.state.city.rebirths || 0;
        
        if (targetRebirth === currentRebirth) {
            if (this.gameEngine.showNotification) {
                this.gameEngine.showNotification('ℹ️ Already at this rebirth level');
            }
            return;
        }
        
        // Set the rebirth count
        this.gameEngine.state.city.rebirths = targetRebirth;
        
        // Force theme update
        if (this.gameEngine.themeManager) {
            this.gameEngine.themeManager.currentTheme = null; // Force refresh
            this.gameEngine.themeManager.updateTheme();
        }
        
        // Update UI
        if (this.gameEngine.updateUI) {
            this.gameEngine.updateUI();
        }
        
        // Show notification
        if (this.gameEngine.showNotification) {
            const themeName = this.gameEngine.rebirthThemes?.getTheme(targetRebirth)?.name || 'Unknown';
            this.gameEngine.showNotification(`🔧 Jumped to Rebirth ${targetRebirth}: ${themeName}`);
        }
        
        console.log(`Developer: Set rebirth to ${targetRebirth}`);
        
        // Close menu
        this.closeDevMenu();
    }
}

// Add shake animation to CSS if not already present
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
        20%, 40%, 60%, 80% { transform: translateX(10px); }
    }
    
    #dev-menu-modal {
        display: none;
        position: fixed;
        z-index: 10000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(5px);
        align-items: center;
        justify-content: center;
    }
    
    #dev-menu-modal.show {
        display: flex !important;
    }
    
    #dev-menu-modal .modal-content {
        background: linear-gradient(135deg, rgba(26, 26, 46, 0.98), rgba(22, 33, 62, 0.98));
        backdrop-filter: blur(10px);
        border: 1px solid rgba(100, 255, 218, 0.3);
        border-radius: 15px;
        padding: 0;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        animation: modalSlideIn 0.3s ease-out;
    }
    
    @keyframes modalSlideIn {
        from {
            opacity: 0;
            transform: scale(0.9);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
`;
document.head.appendChild(style);
