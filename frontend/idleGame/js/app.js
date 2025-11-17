/**
 * app.js - Main application controller for Industrial Empire
 * Simplified version that works with the new multi-resource system
 */

class IndustrialEmpireApp {
    constructor() {
        this.gameEngine = null;
        this.currentTab = 'mining';
        this.isInitialized = false;
        
        // Bind methods to preserve 'this' context
        this.switchTab = this.switchTab.bind(this);
    }

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
        
        console.log('Game engine initialized');
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
                
                // If switching to arcade tab, update arcade UI
                if (tabName === 'arcade') {
                    this.updateArcadeUI();
                }
            });
        });
        
        // Initialize with mining tab
        this.switchTab('mining');
        
        console.log('Tab system initialized');
    }
    
    updateArcadeUI() {
        if (!this.gameEngine || !this.gameEngine.arcadeManager) return;
        
        const arcadeManager = this.gameEngine.arcadeManager;
        const container = document.getElementById('arcade-games-container');
        
        if (!container) return;
        
        // Clear container
        container.innerHTML = '';
        
        // Get available games
        const games = arcadeManager.getAvailableGames();
        
        // Create buttons for each game
        games.forEach(game => {
            const button = document.createElement('button');
            button.className = game.unlocked ? 'action-btn success-btn' : (game.canUnlock ? 'action-btn' : 'action-btn disabled');
            button.disabled = !game.unlocked && !game.canUnlock;
            
            const title = document.createElement('div');
            title.className = 'btn-title';
            title.textContent = `${game.icon} ${game.name}`;
            button.appendChild(title);
            
            if (game.unlocked) {
                const playTime = document.createElement('div');
                playTime.className = 'btn-cost';
                playTime.textContent = `Played: ${game.playTime}`;
                button.appendChild(playTime);
                
                const bonus = document.createElement('div');
                bonus.className = 'btn-description';
                const playTimeHours = (arcadeManager.state.arcade.playTime[game.id] || 0) / 3600;
                const effectiveHours = Math.min(10, playTimeHours);
                const bonusPercent = Math.round(effectiveHours * game.bonusAmount * 100);
                bonus.textContent = `${game.description} | Bonus: +${bonusPercent}%`;
                button.appendChild(bonus);
                
                button.onclick = () => openDosGame(game.id);
            } else {
                const cost = document.createElement('div');
                cost.className = 'btn-cost';
                cost.textContent = `Unlock: ${game.unlockCost} gold`;
                button.appendChild(cost);
                
                const desc = document.createElement('div');
                desc.className = 'btn-description';
                desc.textContent = game.description;
                button.appendChild(desc);
                
                if (game.canUnlock) {
                    button.onclick = () => {
                        if (arcadeManager.unlockGame(game.id)) {
                            this.updateArcadeUI();
                            this.updateArcadeStats();
                        }
                    };
                }
            }
            
            container.appendChild(button);
        });
        
        // Update stats
        this.updateArcadeStats();
    }
    
    updateArcadeStats() {
        if (!this.gameEngine || !this.gameEngine.arcadeManager) return;
        
        const arcadeManager = this.gameEngine.arcadeManager;
        const bonuses = arcadeManager.getArcadeBonuses();
        
        // Update total play time
        const totalTime = arcadeManager.state.arcade.totalPlayTime;
        const hours = Math.floor(totalTime / 3600);
        const minutes = Math.floor((totalTime % 3600) / 60);
        const totalTimeEl = document.getElementById('arcade-total-time');
        if (totalTimeEl) {
            totalTimeEl.textContent = `${hours}h ${minutes}m`;
        }
        
        // Update bonuses
        const resourceBonusEl = document.getElementById('arcade-resource-bonus');
        if (resourceBonusEl) {
            resourceBonusEl.textContent = `+${Math.round((bonuses.resourceBonus - 1) * 100)}%`;
        }
        
        const efficiencyBonusEl = document.getElementById('arcade-efficiency-bonus');
        if (efficiencyBonusEl) {
            efficiencyBonusEl.textContent = `+${Math.round((bonuses.efficiencyBonus - 1) * 100)}%`;
        }
        
        const goldBonusEl = document.getElementById('arcade-gold-bonus');
        if (goldBonusEl) {
            goldBonusEl.textContent = `+${Math.round((bonuses.goldBonus - 1) * 100)}%`;
        }
        
        const craftingBonusEl = document.getElementById('arcade-crafting-bonus');
        if (craftingBonusEl) {
            craftingBonusEl.textContent = `+${Math.round((bonuses.craftingBonus - 1) * 100)}%`;
        }
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
        
        // Fix arcade text when switching to arcade tab in Sterile theme
        if (tabName === 'arcade' && this.themeManager && this.themeManager.currentTheme) {
            if (this.themeManager.currentTheme.atmosphere === 'sterile') {
                setTimeout(() => this.themeManager.fixArcadeTextForSterile(), 50);
            }
        }
    }

    setupActionListeners() {
        // Mining tab actions
        this.bindButton('mine-stone-btn', () => this.gameEngine.mineStone());
        this.bindButton('hire-stone-miner-btn', () => this.gameEngine.hireWorker('stoneMiner'));
        this.bindButton('hire-coal-miner-btn', () => this.gameEngine.hireWorker('coalMiner'));
        this.bindButton('hire-iron-miner-btn', () => this.gameEngine.hireWorker('ironMiner'));
        this.bindButton('hire-silver-miner-btn', () => this.gameEngine.hireWorker('silverMiner'));
        
        // Processing tab actions - OLD SYSTEM (now replaced with manual crafting)
        this.bindButton('build-smelter-btn', () => this.gameEngine.buildProcessor('smelter'));
        this.bindButton('build-forge-btn', () => this.gameEngine.buildProcessor('forge'));
        this.bindButton('build-refinery-btn', () => this.gameEngine.buildProcessor('refinery'));
        this.bindButton('build-mint-btn', () => this.gameEngine.buildProcessor('mint'));
    this.bindButton('build-polisher-btn', () => this.gameEngine.buildProcessor('polishers'));
    this.bindButton('build-coker-btn', () => this.gameEngine.buildProcessor('cokers'));
    this.bindButton('build-chemplant-btn', () => this.gameEngine.buildProcessor('chemPlants'));
    this.bindButton('build-chipfab-btn', () => this.gameEngine.buildProcessor('chipFabs'));
    this.bindButton('build-jeweler-btn', () => this.gameEngine.buildProcessor('jewelers'));
    this.bindButton('build-assembly-btn', () => this.gameEngine.buildProcessor('assemblies'));
    this.bindButton('build-autoplant-btn', () => this.gameEngine.buildProcessor('autoPlants'));
        
        // NEW Manual Crafting System
        this.bindButton('craft-basic-btn', () => this.gameEngine.craftItem('basic'));
        this.bindButton('craft-intermediate-btn', () => this.gameEngine.craftItem('intermediate'));
        this.bindButton('craft-advanced-btn', () => this.gameEngine.craftItem('advanced'));
        this.bindButton('craft-premium-btn', () => this.gameEngine.craftItem('premium'));
        this.bindButton('toggle-autocraft-btn', () => this.gameEngine.toggleAutoCraft());
        
        // Toggle auto-transport for crafted items
        this.bindButton('transport-basic-btn', () => this.gameEngine.toggleTransportCrafted('basic'));
        this.bindButton('transport-intermediate-btn', () => this.gameEngine.toggleTransportCrafted('intermediate'));
        this.bindButton('transport-advanced-btn', () => this.gameEngine.toggleTransportCrafted('advanced'));
        this.bindButton('transport-premium-btn', () => this.gameEngine.toggleTransportCrafted('premium'));
        
        // Sell crafted items from city
        this.bindButton('sell-city-basic-btn', () => this.gameEngine.sellAllCraftedFromCity('basic'));
        this.bindButton('sell-city-intermediate-btn', () => this.gameEngine.sellAllCraftedFromCity('intermediate'));
        this.bindButton('sell-city-advanced-btn', () => this.gameEngine.sellAllCraftedFromCity('advanced'));
        this.bindButton('sell-city-premium-btn', () => this.gameEngine.sellAllCraftedFromCity('premium'));
        
        // Market tab actions
        this.bindButton('sell-stone-btn', () => this.gameEngine.sellResource('stone'));
        this.bindButton('sell-coal-btn', () => this.gameEngine.sellResource('coal'));
        this.bindButton('sell-iron-btn', () => this.gameEngine.sellResource('iron'));
        this.bindButton('sell-silver-btn', () => this.gameEngine.sellResource('silver'));
        this.bindButton('hire-stone-trader-btn', () => this.gameEngine.hireTrader('stoneTrader'));
        this.bindButton('hire-coal-trader-btn', () => this.gameEngine.hireTrader('coalTrader'));
        this.bindButton('hire-metal-trader-btn', () => this.gameEngine.hireTrader('metalTrader'));

    // Transport tab actions
    this.bindButton('transport-next-btn', () => this.gameEngine.transportNext());

    // City tab actions (removed sell-finished-btn - no longer needed)

        // Research unlocks
        const unlockButtons = document.querySelectorAll('[data-unlock]');
        unlockButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-unlock');
                this.gameEngine.unlockFeature(key);
            });
        });
        
        // Transport tab actions
        this.bindButton('buy-cart-btn', () => this.gameEngine.buyTransport('cart'));
        this.bindButton('buy-wagon-btn', () => this.gameEngine.buyTransport('wagon'));
        this.bindButton('buy-train-btn', () => this.gameEngine.buyTransport('train'));
        
        // City tab actions
        this.bindButton('hire-police-btn', () => this.gameEngine.hireService('police'));
    this.bindButton('hire-politician-btn', () => this.gameEngine.hireService('politician'));
        this.bindButton('build-bank-btn', () => this.gameEngine.buildCity('bank'));
        this.bindButton('build-market-btn', () => this.gameEngine.buildCity('market'));
        this.bindButton('build-university-btn', () => this.gameEngine.buildCity('university'));
        this.bindButton('build-sales-dept-btn', () => this.gameEngine.buildCity('salesDepartment'));
        this.bindButton('build-mining-academy-btn', () => this.gameEngine.buildCity('miningAcademy'));
        this.bindButton('build-automation-lab-btn', () => this.gameEngine.buildCity('automationLab'));
    this.bindButton('rebirth-btn', () => this.gameEngine.rebirth());
        
        // Research tab actions
        this.bindButton('research-mining-btn', () => this.gameEngine.purchaseResearch('mining'));
        this.bindButton('research-processing-btn', () => this.gameEngine.purchaseResearch('processing'));
        this.bindButton('research-automation-btn', () => this.gameEngine.purchaseResearch('automation'));
        this.bindButton('research-logistics-btn', () => this.gameEngine.purchaseResearch('logistics'));
        
        // Prestige tab actions
        this.bindButton('prestige-btn', () => this.gameEngine.prestige());
        this.bindButton('prestige-mining-btn', () => this.gameEngine.applyPrestigeBonus('mining'));
        this.bindButton('prestige-processing-btn', () => this.gameEngine.applyPrestigeBonus('processing'));
        this.bindButton('prestige-trading-btn', () => this.gameEngine.applyPrestigeBonus('trading'));
        this.bindButton('prestige-transport-btn', () => this.gameEngine.applyPrestigeBonus('transport'));
        this.bindButton('prestige-city-btn', () => this.gameEngine.applyPrestigeBonus('city'));
        
        // Advertisement/Monetization actions
        this.bindButton('ad-double-resources-btn', () => this.gameEngine.watchAdForDoubleResources());
        this.bindButton('ad-convert-resources-btn', () => this.gameEngine.watchAdForResourceConversion());
        this.bindButton('ad-gold-bonus-btn', () => this.gameEngine.watchAdForGoldBonus());
        this.bindButton('ad-efficiency-boost-btn', () => this.gameEngine.watchAdForEfficiencyBoost());
    }
    
    bindButton(id, handler) {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', handler);
        }
    }

    showErrorMessage(message) {
        console.error(message);
        // You could add a UI notification here
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing Industrial Empire...');
    
    window.app = new IndustrialEmpireApp();
    await window.app.initialize();
    
    // Wait a bit to ensure all DOM elements are ready
    setTimeout(() => {
        // Initialize Developer Menu
        if (window.DeveloperMenu && window.app.gameEngine) {
            window.devMenu = new DeveloperMenu(window.app.gameEngine);
            console.log('Developer Menu initialized');
        } else {
            console.error('DeveloperMenu class not found or gameEngine not available');
            console.log('window.DeveloperMenu:', window.DeveloperMenu);
            console.log('window.app.gameEngine:', window.app.gameEngine);
        }
    }, 100);
    
    // Initialize UI toggles from state
    // UI state initialization removed - no longer using checkbox
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
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});