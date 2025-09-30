// =============================================================================
// KINGDOM QUARRY - MAIN GAME ENGINE
// =============================================================================

class GameEngine {
    constructor() {
        this.gameState = null;
        this.isRunning = false;
        this.lastUpdateTime = 0;
        this.saveSystem = null;
        
        // Game systems
        this.characterSystem = null;
        this.transportSystem = null;
        this.marketSystem = null;
        this.prestigeSystem = null;
        this.quarryRenderer = null;
        
        // Performance tracking
        this.frameCount = 0;
        this.lastFPSTime = 0;
        this.currentFPS = 0;
        
    // Initialization is now handled by async init()
    }
    
        // Initialize the game
    async init() {
        try {
            console.log('Initializing Kingdom Quarry...');
            
            // Initialize core systems
            this.authSystem = new AuthSystem();
            this.saveSystem = new SaveSystem(this.authSystem);
            
            // Check for save conflicts first
            await this.handleSaveConflicts();
            
            // Load game state
            await this.initializeGameState();
            
            // Initialize other systems
            this.initializeSystems();
            
            // Setup UI
            this.setupUI();
            
            // Start the game loop
            this.startGameLoop();
            
            console.log('Kingdom Quarry initialized successfully!');
            
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.showError('Failed to initialize game. Please refresh the page.');
        }
    }
    
    // Handle save conflicts on startup
    async handleSaveConflicts() {
        try {
            const conflictData = await this.saveSystem.checkForConflicts();
            
            if (conflictData) {
                console.log('Save conflict detected, showing resolution dialog...');
                const resolvedSave = await this.saveSystem.resolveSaveConflict(conflictData);
                
                // Apply the resolved save
                this.gameState = resolvedSave;
                this.saveSystem.saveLocal(); // Save the resolved version locally
                
                if (!this.authSystem.isGuest && this.authSystem.gameEndpointsAvailable) {
                    await this.saveSystem.saveToCloud(); // Sync to cloud
                }
                
                this.showNotification('Save conflict resolved successfully!', 'success');
            }
            
        } catch (error) {
            console.error('Error handling save conflicts:', error);
            // Continue with normal initialization
        }
    }
    
    // Wait for authentication system to be ready
    async waitForAuth() {
        return new Promise((resolve) => {
            const checkAuth = () => {
                if (window.authSystem) {
                    resolve();
                } else {
                    setTimeout(checkAuth, 100);
                }
            };
            checkAuth();
        });
    }
    
    // Initialize game state
    async initializeGameState() {
        // Load existing save or create new game
        this.gameState = await this.saveSystem.loadGame();
        
        // Update UI with loaded state
        this.updateUI();
        
        console.log('Game state initialized:', this.gameState);
    }
    
    // Initialize all game systems
    initializeSystems() {
        // Initialize quarry renderer
        this.quarryRenderer = new QuarryRenderer(document.getElementById('quarryCanvas'));
        
        // Initialize game systems
        this.characterSystem = new CharacterSystem(this);
        this.transportSystem = new TransportSystem(this);
        this.marketSystem = new MarketSystem(this);
        this.prestigeSystem = new PrestigeSystem(this);
        
        console.log('All game systems initialized');
    }

    // Setup UI elements and event handlers
    setupUI() {
        try {
            // Hide loading screen and show game
            document.getElementById('loadingScreen').classList.add('hidden');
            document.getElementById('gameContainer').classList.remove('hidden');
            
            // Bind UI event handlers
            this.bindUIEvents();
            
            // Initialize UI displays
            this.updateUI();
            
            // Show welcome message for new players
            if (this.gameState.statistics.totalStoneCollected === 0) {
                setTimeout(() => {
                    this.showNotification('Welcome to Kingdom Quarry! 🏰 Click the quarry to collect stone, then hire workers to automate production!', 'success', 8000);
                }, 1000);
            }
            
            console.log('UI setup completed');
        } catch (error) {
            console.error('Error setting up UI:', error);
            throw error;
        }
    }
    
    // Start main game loop
    startGameLoop() {
        this.isRunning = true;
        this.lastUpdateTime = performance.now();
        this.gameLoop();
    }
    
    // Main game loop
    gameLoop() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastUpdateTime;
        
        // Update game logic
        this.update(deltaTime);
        
        // Render game
        this.render();
        
        // Update performance metrics
        this.updatePerformanceMetrics(currentTime);
        
        this.lastUpdateTime = currentTime;
        
        // Continue loop
        requestAnimationFrame(() => this.gameLoop());
    }
    
    // Update game logic
    update(deltaTime) {
        const deltaSeconds = deltaTime / 1000;
        
        // Update player playtime
        this.gameState.player.totalPlayTime += deltaSeconds;
        
        // Update character production
        this.updateResourceProduction(deltaSeconds);
        
        // Update all game systems
        this.characterSystem?.update(deltaSeconds);
        this.transportSystem?.update(deltaSeconds);
        this.marketSystem?.update(deltaSeconds);
        this.prestigeSystem?.update(deltaSeconds);
        
        // Check for achievements
        this.checkAchievements();
        
        // Update UI periodically
        if (Math.floor(this.lastUpdateTime / 1000) !== Math.floor((this.lastUpdateTime - deltaTime) / 1000)) {
            this.updateUI();
        }
        
        // Mark save system as dirty
        this.saveSystem?.markDirty();
    }
    
    // Render game graphics
    render() {
        // Update quarry renderer
        this.quarryRenderer?.render(this.gameState);
    }
    
    // Update resource production from characters
    updateResourceProduction(deltaSeconds) {
        const resources = this.gameState.resources;
        const characters = this.gameState.characters;
        const prestigeLevel = this.gameState.player.prestigeLevel;
        
        // Calculate production rates
        let totalProduction = { stone: 0, gold: 0, crystals: 0 };
        
        for (const [characterType, characterData] of Object.entries(characters)) {
            if (characterData.count > 0 && GAME_CONFIG.characters[characterType]) {
                const config = GAME_CONFIG.characters[characterType];
                const baseProduction = CONFIG_UTILS.calculateProduction(config.baseProduction, prestigeLevel);
                
                // Apply transport multipliers
                const transportMultiplier = this.transportSystem?.getTotalMultiplier() || 1;
                
                for (const [resource, amount] of Object.entries(baseProduction)) {
                    const production = amount * characterData.count * transportMultiplier * deltaSeconds;
                    totalProduction[resource] += production;
                }
            }
        }
        
        // Apply production to resources
        for (const [resource, amount] of Object.entries(totalProduction)) {
            if (resources[resource] !== undefined) {
                resources[resource] += amount;
            }
        }
        
        // Update statistics
        this.gameState.statistics.totalStoneCollected += totalProduction.stone;
        this.gameState.statistics.totalGoldEarned += totalProduction.gold;
        this.gameState.statistics.totalCrystalsFound += totalProduction.crystals;
    }
    
    // Handle manual stone collection (clicking)
    collectStone(clickEvent) {
        const clickPower = this.getClickPower();
        
        this.gameState.resources.stone += clickPower;
        this.gameState.statistics.totalStoneCollected += clickPower;
        this.gameState.statistics.totalClicks++;
        
        // Show click indicator
        this.showClickIndicator(clickEvent, clickPower);
        
        // Update UI immediately
        this.updateResourceDisplay();
        
        // Mark as dirty for saving
        this.saveSystem?.markDirty();
    }
    
    // Calculate click power based on prestige and upgrades
    getClickPower() {
        const basePower = GAME_CONFIG.baseStonePerClick;
        const prestigeBonus = 1 + (this.gameState.player.prestigeLevel - 1) * GAME_CONFIG.prestige.bonusPerLevel;
        
        return Math.floor(basePower * prestigeBonus);
    }
    
    // Show click indicator animation
    showClickIndicator(clickEvent, amount) {
        const indicator = document.getElementById('clickIndicator');
        if (!indicator) return;
        
        // Position indicator at click location
        const canvas = document.getElementById('quarryCanvas');
        const rect = canvas.getBoundingClientRect();
        const x = clickEvent.clientX - rect.left;
        const y = clickEvent.clientY - rect.top;
        
        indicator.style.left = x + 'px';
        indicator.style.top = y + 'px';
        indicator.textContent = '+' + CONFIG_UTILS.formatNumber(amount) + ' 🪨';
        
        // Add more prominent styling
        indicator.style.fontSize = '1.5rem';
        indicator.style.fontWeight = 'bold';
        indicator.style.color = '#FFD700';
        indicator.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
        
        // Show and animate
        indicator.classList.remove('hidden');
        
        // Hide after animation
        setTimeout(() => {
            indicator.classList.add('hidden');
        }, 1200);
        
        // Check for milestones
        if (this.gameState.statistics.totalClicks === 1) {
            setTimeout(() => {
                this.showNotification('Great! Keep clicking to gather more stone. You can hire workers when you have enough gold! 💰', 'info', 6000);
            }, 1500);
        }
    }
    
    // Check and unlock achievements
    checkAchievements() {
        const achievements = GAME_CONFIG.achievements;
        const stats = this.gameState.statistics;
        const unlocked = this.gameState.achievements.unlocked;
        
        // Check stone collector achievements
        this.checkAchievementSeries('stoneCollector', achievements.stoneCollector, stats.totalStoneCollected, unlocked, 'Stone Collector');
        
        // Check gold earner achievements
        this.checkAchievementSeries('goldEarner', achievements.goldEarner, stats.totalGoldEarned, unlocked, 'Gold Earner');
        
        // Check crystal finder achievements
        this.checkAchievementSeries('crystalFinder', achievements.crystalFinder, stats.totalCrystalsFound, unlocked, 'Crystal Finder');
        
        // Check worker manager achievements
        const totalWorkers = Object.values(this.gameState.characters).reduce((sum, char) => sum + char.count, 0);
        this.checkAchievementSeries('workerManager', achievements.workerManager, totalWorkers, unlocked, 'Worker Manager');
        
        // Check prestige master achievements
        this.checkAchievementSeries('prestigeMaster', achievements.prestigeMaster, this.gameState.player.prestigeLevel, unlocked, 'Prestige Master');
        
        // Check special achievements
        this.checkSpecialAchievements();
    }
    
    // Check achievement series helper
    checkAchievementSeries(name, thresholds, currentValue, unlockedList, displayName) {
        thresholds.forEach((threshold, index) => {
            const achievementId = `${name}_${index + 1}`;
            if (currentValue >= threshold && !unlockedList.includes(achievementId)) {
                this.unlockAchievement(achievementId, `${displayName} ${this.getRomanNumeral(index + 1)}`, threshold);
            }
        });
    }
    
    // Check special achievements
    checkSpecialAchievements() {
        const stats = this.gameState.statistics;
        const unlocked = this.gameState.achievements.unlocked;
        
        // First click achievement
        if (stats.totalClicks >= 1 && !unlocked.includes('first_click')) {
            this.unlockAchievement('first_click', 'First Steps', null, '⛏️');
        }
        
        // Stone collection milestones with helpful tips
        if (stats.totalStoneCollected >= 50 && !unlocked.includes('stone_50') && this.gameState.resources.gold < 15) {
            this.unlockAchievement('stone_50', 'Stone Gatherer', 50, '🪨');
            setTimeout(() => {
                this.showNotification('💡 Tip: Visit the Market to trade stone for gold, then hire your first worker!', 'info', 7000);
            }, 2000);
        }
        
        // Speed clicker (100 clicks in a minute)
        if (stats.totalClicks >= 100 && !unlocked.includes('speed_clicker')) {
            this.unlockAchievement('speed_clicker', 'Speed Clicker', null, '⚡');
        }
        
        // Idle master (earn 1000 stone without clicking)
        if (stats.totalStoneCollected >= 1000 && stats.totalClicks <= 10 && !unlocked.includes('idle_master')) {
            this.unlockAchievement('idle_master', 'Idle Master', null, '💤');
        }
        
        // Transport baron (unlock all transport)
        const allTransportUnlocked = Object.values(this.gameState.transport).every(t => t.unlocked);
        if (allTransportUnlocked && !unlocked.includes('transport_baron')) {
            this.unlockAchievement('transport_baron', 'Transport Baron', null, '🚛');
        }
    }
    
    // Get Roman numeral for achievement levels
    getRomanNumeral(num) {
        const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
        const numerals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
        let result = '';
        
        for (let i = 0; i < values.length; i++) {
            while (num >= values[i]) {
                result += numerals[i];
                num -= values[i];
            }
        }
        
        return result;
    }
    
    // Unlock achievement
    unlockAchievement(id, name, value = null, icon = '🏆') {
        this.gameState.achievements.unlocked.push(id);
        console.log('Achievement unlocked:', name);
        
        // Show achievement notification with icon and value
        let message = `${icon} ${name}`;
        if (value) {
            message += ` (${CONFIG_UTILS.formatNumber(value)})`;
        }
        
        this.showNotification(message, 'success', 5000);
        
        // Grant achievement reward (small resource bonus)
        this.grantAchievementReward(id);
    }
    
    // Grant small rewards for achievements
    grantAchievementReward(achievementId) {
        const resources = this.gameState.resources;
        
        // Grant different rewards based on achievement type
        if (achievementId.includes('stoneCollector')) {
            resources.gold += 10;
        } else if (achievementId.includes('goldEarner')) {
            resources.crystals += 1;
        } else if (achievementId.includes('crystalFinder')) {
            resources.stone += 1000;
        } else if (achievementId.includes('workerManager')) {
            resources.gold += 50;
        } else if (achievementId.includes('prestigeMaster')) {
            resources.crystals += 5;
        } else {
            // Special achievement rewards
            resources.stone += 100;
            resources.gold += 5;
        }
    }
    
    // Update UI elements
    updateUI() {
        if (!this.gameState) {
            console.warn('Cannot update UI: gameState is undefined');
            return;
        }
        
        this.updateResourceDisplay();
        this.updateStatsDisplay();
        this.updateSystemDisplays();
    }
    
    // Update resource display
    updateResourceDisplay() {
        if (!this.gameState || !this.gameState.resources) {
            console.warn('Cannot update resource display: gameState.resources is undefined');
            return;
        }
        
        const resources = this.gameState.resources;
        
        document.getElementById('stoneCount').textContent = CONFIG_UTILS.formatNumber(resources.stone);
        document.getElementById('goldCount').textContent = CONFIG_UTILS.formatNumber(resources.gold);
        document.getElementById('crystalCount').textContent = CONFIG_UTILS.formatNumber(resources.crystals);
        
        // Update prestige level
        if (this.gameState.player) {
            document.getElementById('prestigeLevel').textContent = `Level ${this.gameState.player.prestigeLevel}`;
            document.getElementById('currentPrestige').textContent = this.gameState.player.prestigeLevel;
        }
    }
    
    // Update stats display
    updateStatsDisplay() {
        const totalWorkers = Object.values(this.gameState.characters).reduce((sum, char) => sum + char.count, 0);
        document.getElementById('workerCount').textContent = totalWorkers;
        
        // Calculate stone per second
        const stonePerSecond = this.calculateResourcePerSecond('stone');
        document.getElementById('stonePerSecond').textContent = CONFIG_UTILS.formatNumber(stonePerSecond);
        
        document.getElementById('totalStone').textContent = CONFIG_UTILS.formatNumber(this.gameState.statistics.totalStoneCollected);
        
        // Update session time
        const sessionMinutes = Math.floor(this.gameState.player.totalPlayTime / 60);
        const sessionSeconds = Math.floor(this.gameState.player.totalPlayTime % 60);
        document.getElementById('sessionTime').textContent = `${sessionMinutes}:${sessionSeconds.toString().padStart(2, '0')}`;
    }
    
    // Update all system displays
    updateSystemDisplays() {
        this.characterSystem?.updateDisplay();
        this.transportSystem?.updateDisplay();
        this.marketSystem?.updateDisplay();
        this.prestigeSystem?.updateDisplay();
    }
    
    // Calculate resource production per second
    calculateResourcePerSecond(resource) {
        const characters = this.gameState.characters;
        const prestigeLevel = this.gameState.player.prestigeLevel;
        let totalPerSecond = 0;
        
        for (const [characterType, characterData] of Object.entries(characters)) {
            if (characterData.count > 0 && GAME_CONFIG.characters[characterType]) {
                const config = GAME_CONFIG.characters[characterType];
                if (config.baseProduction[resource]) {
                    const production = CONFIG_UTILS.calculateProduction(config.baseProduction, prestigeLevel);
                    const transportMultiplier = this.transportSystem?.getTotalMultiplier() || 1;
                    totalPerSecond += production[resource] * characterData.count * transportMultiplier;
                }
            }
        }
        
        return totalPerSecond;
    }
    
    // Bind UI events
    bindUIEvents() {
        // Quarry clicking
        const quarryCanvas = document.getElementById('quarryCanvas');
        if (quarryCanvas) {
            quarryCanvas.addEventListener('click', (e) => this.collectStone(e));
        }
        
        // Save button
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveGame(true, true));
        }
        
        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
        }
        
        // Settings modal events
        this.bindSettingsEvents();
    }
    
    // Bind settings modal events
    bindSettingsEvents() {
        const closeSettings = document.getElementById('closeSettings');
        if (closeSettings) {
            closeSettings.addEventListener('click', () => this.hideSettings());
        }
        
        // Auto-save interval change
        const autoSaveSelect = document.getElementById('autoSave');
        if (autoSaveSelect) {
            autoSaveSelect.addEventListener('change', () => {
                this.saveSystem?.updateSettings();
            });
        }
        
        // Graphics quality change
        const graphicsSelect = document.getElementById('graphicsQuality');
        if (graphicsSelect) {
            graphicsSelect.addEventListener('change', (e) => {
                this.gameState.settings.graphicsQuality = e.target.value;
                this.quarryRenderer?.updateQuality(e.target.value);
            });
        }
    }
    
    // Show/hide settings modal
    showSettings() {
        document.getElementById('settingsModal').classList.remove('hidden');
    }
    
    hideSettings() {
        document.getElementById('settingsModal').classList.add('hidden');
    }
    
    // Save game
    async saveGame(createBackup = false, showNotification = true) {
        if (this.saveSystem) {
            return await this.saveSystem.saveGame(createBackup, showNotification);
        }
        return false;
    }
    
    // Load cloud save
    async loadCloudSave() {
        if (this.saveSystem) {
            this.gameState = await this.saveSystem.loadGame();
            this.updateUI();
        }
    }
    
    // Initialize new game
    initializeNewGame() {
        this.gameState = this.saveSystem?.createDefaultGameState() || CONFIG_UTILS.deepMerge({}, DEFAULT_GAME_STATE);
        this.updateUI();
    }
    
    // Reset game
    resetGame() {
        this.gameState = CONFIG_UTILS.deepMerge({}, DEFAULT_GAME_STATE);
        this.updateUI();
    }
    
    // Get current game state
    getGameState() {
        return this.gameState;
    }
    
    // Load game state
    loadGameState(newState) {
        this.gameState = newState;
        this.updateUI();
    }
    
    // Update performance metrics
    updatePerformanceMetrics(currentTime) {
        this.frameCount++;
        
        if (currentTime - this.lastFPSTime >= 1000) {
            this.currentFPS = this.frameCount;
            this.frameCount = 0;
            this.lastFPSTime = currentTime;
        }
    }
    
    // Show notification
    showNotification(message, type = 'info', duration = 3000) {
        console.log(`Notification [${type}]:`, message);
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `game-notification ${type}`;
        notification.textContent = message;
        
        // Add to DOM
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Remove after duration
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }
    
    // Show error message
    showError(message) {
        console.error('Game Error:', message);
        this.showNotification(message, 'error');
    }
    
    // Stop game engine
    stop() {
        this.isRunning = false;
        
        // Save before stopping
        this.saveGame(false, false);
        
        // Cleanup
        this.saveSystem?.destroy();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameEngine;
}