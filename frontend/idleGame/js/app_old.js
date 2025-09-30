/**
 * app.js - Main application controller
 * Ties all systems together and handles UI interactions
 */

class IndustrialEmpireApp {
    constructor() {
        this.gameEngine = null;
        this.currentTab = 'mining';
        this.isInitialized = false;
        
        // Bind methods to preserve 'this' context
        this.handleAction = this.handleAction.bind(this);
        this.switchTab = this.switchTab.bind(this);
        this.handleControl = this.handleControl.bind(this);
    }
    
    // Initialize the application
    async initialize() {
        console.log('Initializing Industrial Empire...');
        
        try {
            // Initialize game engine
            this.initializeGameEngine();
            this.setupEventListeners();
            this.setupTabs();
            
            // Start the game
            this.gameEngine.start();
            
            this.isInitialized = true;
            console.log('Industrial Empire initialized successfully!');
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.showErrorMessage('Failed to initialize game. Please refresh the page.');
        }
    }
    
    initializeGameEngine() {
        // Create game engine (now self-contained)
        this.gameEngine = new GameEngine();
        
        console.log('All systems initialized');
    }
    
    setupEventListeners() {
        // Set up action button listeners for all tabs
        this.setupActionListeners();
        
        console.log('Event listeners set up');
    }

    setupTabs() {
        // Set up tab navigation
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // Initialize with mining tab
        this.switchTab('mining');
        
        console.log('Tab system initialized');
    }

    switchTab(tabName) {
        // Hide all tab content
        const allTabs = document.querySelectorAll('.tab-content');
        allTabs.forEach(tab => tab.classList.remove('active'));
        
        // Remove active from all tab buttons
        const allTabBtns = document.querySelectorAll('.tab-btn');
        allTabBtns.forEach(btn => btn.classList.remove('active'));
        
        // Show selected tab
        const selectedTab = document.getElementById(`${tabName}-tab`);
        const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
        
        if (selectedTab) selectedTab.classList.add('active');
        if (selectedBtn) selectedBtn.classList.add('active');
        
        this.currentTab = tabName;
    }
    
    setupActionListeners() {
        // Mining tab actions
        this.bindButton('mine-stone-btn', () => this.gameEngine.mineStone());
        this.bindButton('hire-worker-btn', () => this.gameEngine.hireWorker('stone', 'miner'));
        
        // Processing tab actions
        this.bindButton('build-coal-processor-btn', () => this.gameEngine.buildProcessor('coal'));
        this.bindButton('build-iron-processor-btn', () => this.gameEngine.buildProcessor('iron'));
        this.bindButton('build-silver-processor-btn', () => this.gameEngine.buildProcessor('silver'));
        this.bindButton('build-gold-processor-btn', () => this.gameEngine.buildProcessor('gold'));
        
        // Market tab actions
        this.bindButton('hire-trader-btn', () => this.gameEngine.hireTrader('basic'));
        this.bindButton('sell-stone-btn', () => this.gameEngine.sellResource('stone'));
        this.bindButton('sell-coal-btn', () => this.gameEngine.sellResource('coal'));
        this.bindButton('sell-iron-btn', () => this.gameEngine.sellResource('iron'));
        this.bindButton('sell-silver-btn', () => this.gameEngine.sellResource('silver'));
        
        // Transport tab actions
        this.bindButton('buy-transport-btn', () => this.gameEngine.buyTransport('truck'));
        
        // City tab actions
        this.bindButton('build-city-btn', () => this.gameEngine.buildCity('housing'));
        
        // Research tab actions
        this.bindButton('research-efficiency-btn', () => this.gameEngine.purchaseResearch('efficiency'));
        this.bindButton('research-automation-btn', () => this.gameEngine.purchaseResearch('automation'));
        
        // Prestige tab actions
        this.bindButton('prestige-btn', () => this.gameEngine.prestige());
        this.bindButton('prestige-mining-btn', () => this.gameEngine.applyPrestigeBonus('mining'));
        this.bindButton('prestige-processing-btn', () => this.gameEngine.applyPrestigeBonus('processing'));
        this.bindButton('prestige-trading-btn', () => this.gameEngine.applyPrestigeBonus('trading'));
        this.bindButton('prestige-transport-btn', () => this.gameEngine.applyPrestigeBonus('transport'));
        this.bindButton('prestige-city-btn', () => this.gameEngine.applyPrestigeBonus('city'));
    }
    
    bindButton(id, handler) {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', handler);
        }
    }
    
    bindActionButtons() {
        // Add event listeners to all action buttons
        document.querySelectorAll('.action-btn').forEach(button => {
            button.addEventListener('click', this.handleAction);
        });
        
        // Add event listeners to marketer buttons specifically
        document.querySelectorAll('.marketer-btn').forEach(button => {
            button.addEventListener('click', this.handleAction);
        });
        
        console.log('Action buttons bound');
    }
    
    bindUpgradeButtons() {
        document.querySelectorAll('.upgrade-btn').forEach(button => {
            button.addEventListener('click', this.handleUpgrade);
        });
        
        console.log('Upgrade buttons bound');
    }
    
    bindControlButtons() {
        if (this.uiElements.saveBtn) {
            this.uiElements.saveBtn.addEventListener('click', this.handleControl);
        }
        if (this.uiElements.loadBtn) {
            this.uiElements.loadBtn.addEventListener('click', this.handleControl);
        }
        if (this.uiElements.resetBtn) {
            this.uiElements.resetBtn.addEventListener('click', this.handleControl);
        }
        
        // Prestige button
        const prestigeBtn = document.getElementById('prestige-btn');
        if (prestigeBtn) {
            prestigeBtn.addEventListener('click', this.handleControl);
        }
        
        console.log('Control buttons bound');
    }
    
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return; // Don't interfere with input fields
            }
            
            switch (e.key.toLowerCase()) {
                case ' ': // Spacebar for manual mining
                case 'x':
                    e.preventDefault();
                    this.gameEngine.mineStone();
                    break;
                case 'm':
                    e.preventDefault();
                    this.gameEngine.hireMiner();
                    break;
                case 'h':
                    e.preventDefault();
                    this.gameEngine.buyHousing();
                    break;
                case 's':
                    e.preventDefault();
                    this.gameEngine.sellStone();
                    break;
                case '1':
                    e.preventDefault();
                    this.gameEngine.hireMarketer('basic');
                    break;
                case '2':
                    e.preventDefault();
                    this.gameEngine.hireMarketer('advanced');
                    break;
                case '3':
                    e.preventDefault();
                    this.gameEngine.hireMarketer('expert');
                    break;
                case 'escape':
                    e.preventDefault();
                    this.togglePause();
                    break;
            }
        });
        
        console.log('Keyboard shortcuts bound');
    }
    
    // Event handlers
    handleAction(event) {
        const button = event.currentTarget;
        const action = button.dataset.action;
        
        if (!action || !this.gameEngine) return;
        
        switch (action) {
            case 'mineStone':
                this.gameEngine.mineStone();
                break;
            case 'hireMiner':
                this.gameEngine.hireMiner();
                break;
            case 'buyHousing':
                this.gameEngine.buyHousing();
                break;
            case 'sellStone':
                this.gameEngine.sellStone();
                break;
            case 'hireBasicMarketer':
                this.gameEngine.hireMarketer('basic');
                break;
            case 'hireAdvancedMarketer':
                this.gameEngine.hireMarketer('advanced');
                break;
            case 'hireExpertMarketer':
                this.gameEngine.hireMarketer('expert');
                break;
            case 'prestige':
                this.gameEngine.prestige();
                break;
        }
        
        // Add visual feedback
        this.addButtonFeedback(button);
    }
    
    handleUpgrade(event) {
        const button = event.currentTarget;
        const upgrade = button.dataset.upgrade;
        
        if (!upgrade || !this.gameEngine) return;
        
        this.gameEngine.purchaseUpgrade(upgrade);
        this.addButtonFeedback(button);
    }
    
    async handleControl(event) {
        const button = event.currentTarget;
        const buttonId = button.id;
        
        if (!this.saveManager) return;
        
        switch (buttonId) {
            case 'save-btn':
                await this.saveManager.manualSave();
                this.showNotification('Game saved!', 'success');
                break;
            case 'load-btn':
                const loaded = await this.saveManager.manualLoad();
                if (loaded) {
                    this.showNotification('Game loaded!', 'success');
                } else {
                    this.showNotification('No save data found', 'warning');
                }
                break;
            case 'reset-btn':
                if (this.saveManager.resetGame()) {
                    this.showNotification('Game reset!', 'info');
                }
                break;
            case 'prestige-btn':
                this.gameEngine.prestige();
                this.showNotification('Prestiged! Welcome to your new empire!', 'success');
                break;
        }
        
        this.addButtonFeedback(button);
    }
    
    // Game lifecycle
    async loadGame() {
        if (this.saveManager) {
            const loaded = this.saveManager.loadFromLocal();
            if (loaded) {
                console.log('Game loaded from local storage');
            } else {
                console.log('Starting new game');
            }
        }
    }
    
    startGame() {
        if (this.gameEngine) {
            this.gameEngine.start();
            console.log('Game started');
        }
    }
    
    stopGame() {
        if (this.gameEngine) {
            this.gameEngine.stop();
            console.log('Game stopped');
        }
    }
    
    togglePause() {
        if (!this.gameEngine) return;
        
        if (this.gameEngine.isRunning) {
            this.stopGame();
            this.showNotification('Game paused', 'info');
        } else {
            this.startGame();
            this.showNotification('Game resumed', 'info');
        }
    }
    
    // UI feedback and notifications
    addButtonFeedback(button) {
        button.classList.add('pulse');
        setTimeout(() => {
            button.classList.remove('pulse');
        }, 300);
    }
    
    showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(100, 255, 218, 0.9);
                color: #1a1a2e;
                padding: 15px 20px;
                border-radius: 8px;
                font-weight: bold;
                z-index: 1000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                max-width: 300px;
            `;
            document.body.appendChild(notification);
        }
        
        // Set notification style based on type
        switch (type) {
            case 'success':
                notification.style.background = 'rgba(100, 255, 218, 0.9)';
                break;
            case 'warning':
                notification.style.background = 'rgba(255, 193, 7, 0.9)';
                break;
            case 'error':
                notification.style.background = 'rgba(255, 65, 108, 0.9)';
                notification.style.color = 'white';
                break;
            default:
                notification.style.background = 'rgba(79, 172, 254, 0.9)';
        }
        
        // Show notification
        notification.textContent = message;
        notification.style.transform = 'translateX(0)';
        
        // Hide after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
        }, 3000);
    }
    
    showWelcomeMessage() {
        if (localStorage.getItem('mineEmpire_welcomed')) return;
        
        const welcomeMessage = `
            Welcome to Mine Empire! 🏭
            
            🚀 GET STARTED: Click "Mine Stone" to collect your first stone!
            
            • Start by manually mining stone (click or press SPACEBAR)
            • At 10 stone: Hire your first miner for automatic production
            • At 50 stone: Build housing to accommodate more miners  
            • At 100 stone: Hire marketers to increase stone sell value
            • Purchase upgrades to boost efficiency
            • Reach 1M total stone sold to unlock prestige!
            
            Keyboard shortcuts:
            SPACE/X - Mine Stone | M - Hire Miner | H - Build Housing | S - Sell Stone
            1,2,3 - Hire Marketers | ESC - Pause Game
        `;
        
        setTimeout(() => {
            alert(welcomeMessage);
            localStorage.setItem('mineEmpire_welcomed', 'true');
        }, 1000);
    }
    
    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 65, 108, 0.95);
            color: white;
            padding: 30px;
            border-radius: 16px;
            font-size: 1.2rem;
            text-align: center;
            z-index: 9999;
            max-width: 400px;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
    }
    
    // Debug methods
    enableDebugMode() {
        window.mineEmpire = {
            app: this,
            gameEngine: this.gameEngine,
            resourceManager: this.resourceManager,
            upgradeSystem: this.upgradeSystem,
            marketSystem: this.marketSystem,
            saveManager: this.saveManager,
            
            // Debug shortcuts
            addStone: (amount) => {
                if (this.gameEngine.state) {
                    this.gameEngine.state.stone += amount;
                    console.log(`Added ${amount} stone`);
                }
            },
            
            unlockAllUpgrades: () => {
                if (this.upgradeSystem) {
                    this.upgradeSystem.unlockAllUpgrades();
                }
            },
            
            skipToPrestige: () => {
                if (this.gameEngine.state) {
                    this.gameEngine.state.totalStoneSold = 1000000;
                    console.log('Skipped to prestige threshold');
                }
            },
            
            getStats: () => {
                return {
                    resource: this.resourceManager ? this.resourceManager.getResourceStatus() : null,
                    upgrades: this.upgradeSystem ? this.upgradeSystem.getUpgradeStats() : null,
                    market: this.marketSystem ? this.marketSystem.getMarketStats() : null
                };
            }
        };
        
        console.log('Debug mode enabled. Access via window.mineEmpire');
        this.showNotification('Debug mode enabled', 'info');
    }
    
    // Cleanup
    destroy() {
        this.stopGame();
        
        if (this.saveManager) {
            this.saveManager.destroy();
        }
        
        // Remove event listeners
        document.querySelectorAll('.action-btn, .upgrade-btn, .control-btn').forEach(button => {
            button.removeEventListener('click', this.handleAction);
            button.removeEventListener('click', this.handleUpgrade);
            button.removeEventListener('click', this.handleControl);
        });
        
        console.log('App destroyed');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, starting Mine Empire...');
    
    const app = new MineEmpireApp();
    await app.initialize();
    
    // Enable debug mode in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        app.enableDebugMode();
    }
    
    // Store app reference globally for debugging
    window.app = app;
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (window.app && window.app.gameEngine) {
        if (document.hidden) {
            console.log('Page hidden, game continues in background');
        } else {
            console.log('Page visible, resuming normal operation');
        }
    }
});

// Handle errors gracefully
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    
    if (window.app) {
        window.app.showNotification('An error occurred. Please refresh if the game stops working.', 'error');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    if (window.app) {
        window.app.showNotification('A background error occurred.', 'warning');
    }
});