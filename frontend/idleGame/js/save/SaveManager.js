/**
 * SaveManager.js - Handle game save/load operations with backend API
 * Integrates with the existing Kingdom Quarry endpoints
 */

class SaveManager {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.baseUrl = window.location.origin; // Use same domain as the frontend
        this.apiEndpoint = '/api/v1/game';
        this.authToken = null;
        this.username = null;
        this.isAuthenticated = false;
        
        // Auto-save interval (every 30 seconds)
        this.autoSaveInterval = 30000;
        this.autoSaveTimer = null;
        
        // Load saved credentials on startup
        this.loadCredentials();
    }

    // ===================
    // Authentication
    // ===================

    async register(username, password, email = '') {
        try {
            // Backend requires email field
            const registerEmail = email || `${username}@game.local`;
            
            const response = await fetch(`${this.baseUrl}${this.apiEndpoint}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                    email: registerEmail
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                this.authToken = data.access_token;
                this.username = username;
                this.isAuthenticated = true;
                this.saveCredentials();
                this.startAutoSave();
                
                this.gameEngine.showNotification(`✅ Account created successfully! Welcome, ${username}!`);
                return { success: true, message: 'Account created successfully!' };
            } else {
                throw new Error(data.detail || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.gameEngine.showNotification(`❌ Registration failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    async login(username, password) {
        try {
            const response = await fetch(`${this.baseUrl}${this.apiEndpoint}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                this.authToken = data.access_token;
                this.username = username;
                this.isAuthenticated = true;
                this.saveCredentials();
                this.startAutoSave();
                
                this.gameEngine.showNotification(`✅ Welcome back, ${username}!`);
                
                // Try to load saved game
                await this.loadGame();
                
                return { success: true, message: 'Login successful!' };
            } else {
                throw new Error(data.detail || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.gameEngine.showNotification(`❌ Login failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    logout() {
        this.authToken = null;
        this.username = null;
        this.isAuthenticated = false;
        this.stopAutoSave();
        this.clearCredentials();
        this.gameEngine.showNotification('📤 Logged out successfully!');
    }

    // ===================
    // Save/Load Operations
    // ===================

    async saveGame() {
        if (!this.isAuthenticated) {
            this.gameEngine.showNotification('⚠️ Please login to save your game!');
            return { success: false, message: 'Not authenticated' };
        }

        try {
            // Prepare save data matching GameSaveData model
            const saveData = this.prepareSaveData();
            
            console.log('💾 SAVE: Prepared save data:', saveData);
            console.log('💾 SAVE: Resources being saved:', saveData.resources);
            console.log('💾 SAVE: Custom data exists:', !!saveData.custom_data);
            
            // Wrap in GameSaveRequest format: { save_data: GameSaveData, backup: bool }
            const requestPayload = {
                save_data: saveData,
                backup: false
            };
            
            console.log('💾 SAVE: Sending to:', `${this.baseUrl}${this.apiEndpoint}/save`);
            console.log('💾 SAVE: Payload size:', JSON.stringify(requestPayload).length, 'bytes');
            
            const response = await fetch(`${this.baseUrl}${this.apiEndpoint}/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify(requestPayload)
            });

            console.log('💾 SAVE: Response status:', response.status);

            // Parse response
            let data = null;
            try { data = await response.json(); } catch (_) { /* ignore parse errors */ }
            
            console.log('💾 SAVE: Response data:', data);
            
            if (response.ok) {
                this.gameEngine.showNotification('💾 Game saved successfully!');
                console.log('✅ Save successful! save_id:', data?.save_id);
                return { success: true, message: 'Game saved successfully!', data };
            } else {
                const detail = (data && (data.detail || data.message)) || 'Save failed';
                throw new Error(detail);
            }
        } catch (error) {
            console.error('Save error:', error);
            this.gameEngine.showNotification(`❌ Save failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    async loadGame() {
        if (!this.isAuthenticated) {
            this.gameEngine.showNotification('⚠️ Please login to load your game!');
            return { success: false, message: 'Not authenticated' };
        }

        // Prevent duplicate simultaneous loads
        if (this._isLoading) {
            console.log('⚠️ LOAD: Already loading, skipping duplicate call');
            return { success: false, message: 'Load already in progress' };
        }

        this._isLoading = true;

        try {
            console.log('🔍 LOAD: Fetching save from:', `${this.baseUrl}${this.apiEndpoint}/save`);
            console.log('🔍 LOAD: Using token:', this.authToken ? 'Token exists' : 'NO TOKEN');
            console.log('🔍 LOAD: Current user:', this.username);
            
            const response = await fetch(`${this.baseUrl}${this.apiEndpoint}/save`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            console.log('🔍 LOAD: Response status:', response.status);

            // Parse response - GameLoadResponse format
            let data = null;
            try { data = await response.json(); } catch (_) { /* ignore parse errors */ }

            console.log('🔍 LOAD: Response data:', data);
            console.log('🔍 LOAD: Response data FULL:', JSON.stringify(data, null, 2));
            console.log('🔍 LOAD: has_save:', data?.has_save);
            console.log('🔍 LOAD: save_data exists:', !!data?.save_data);
            console.log('🔍 LOAD: save_data type:', typeof data?.save_data);
            console.log('🔍 LOAD: save_data keys:', data?.save_data ? Object.keys(data.save_data) : 'N/A');

            if (response.status === 404 || (response.ok && data && data.has_save === false)) {
                // No save file exists - this is okay for new players
                console.log('No save file found - starting new game');
                this.gameEngine.showNotification('🎮 Starting new game!');
                return { success: true, message: 'Starting new game' };
            } else if (response.ok && data && data.has_save === true && data.save_data) {
                // GameLoadResponse structure: { save_data: GameSaveData, has_save: true, ... }
                console.log('Loading save data from server:', data.save_data);
                this.applySaveData(data.save_data);
                
                // Always force UI refresh after loading
                if (this.gameEngine.updateUI) {
                    this.gameEngine.updateUI();
                }
                
                this.gameEngine.showNotification('📂 Game loaded successfully!');
                console.log('Load successful - game state restored');
                return { success: true, message: 'Game loaded successfully!' };
            } else if (response.ok) {
                // Fallback: try to extract payload from other structures
                const payload = data?.save_data || data?.data || data || null;
                if (payload && typeof payload === 'object' && Object.keys(payload).length > 0) {
                    console.log('Loading save data from alternate structure:', payload);
                    this.applySaveData(payload);
                    
                    // Always force UI refresh after loading
                    if (this.gameEngine.updateUI) {
                        this.gameEngine.updateUI();
                    }
                    
                    this.gameEngine.showNotification('📂 Game loaded successfully!');
                    return { success: true, message: 'Game loaded successfully!' };
                } else {
                    console.log('Load response OK but no save data; starting fresh');
                    this.gameEngine.showNotification('🎮 Starting new game!');
                    return { success: true, message: 'No saved game yet' };
                }
            } else {
                const detail = (data && (data.detail || data.message)) || 'Load failed';
                throw new Error(detail);
            }
        } catch (error) {
            console.error('❌ LOAD ERROR:', error);
            this.gameEngine.showNotification(`❌ Load failed: ${error.message}`);
            return { success: false, message: error.message };
        } finally {
            this._isLoading = false;
            console.log('🔍 LOAD: Complete (loading flag cleared)');
        }
    }

    // ===================
    // Data Conversion
    // ===================

    prepareSaveData() {
        const state = this.gameEngine.state;
        
        // Match GameSaveData model from backend
        return {
            game_version: "1.0.0",
            play_time: Math.floor(state.gameTime || 0),
            last_save: new Date().toISOString(),
            
            // Resources (matching backend expectation)
            resources: {
                stone: Math.floor(state.resources.stone || 0),
                coal: Math.floor(state.resources.coal || 0),
                iron: Math.floor(state.resources.iron || 0),
                silver: Math.floor(state.resources.silver || 0),
                gold: Math.floor(state.resources.gold || 0),
                crystals: 0, // Map magical crystals if available
                royal_favor: 0 // Reserved for future use
            },
            
            // Game state data (custom fields for Industrial Empire)
            custom_data: {
                // Advanced inventories
                factory: state.factory || { raw: {}, processed: {}, finished: {} },
                city_inventory: state.cityInventory || { finished: {} },
                
                // Workers
                workers: {
                    stone_miners: state.workers.stoneMiners || 0,
                    coal_miners: state.workers.coalMiners || 0,
                    iron_miners: state.workers.ironMiners || 0,
                    silver_miners: state.workers.silverMiners || 0
                },
                
                // Processing
                processors: Object.assign({}, state.processors || {}),
                
                // Trading
                traders: {
                    stone_traders: state.traders.stoneTraders || 0,
                    coal_traders: state.traders.coalTraders || 0,
                    metal_traders: state.traders.metalTraders || 0
                },
                
                // Transport
                transport: {
                    carts: state.transport.carts || 0,
                    wagons: state.transport.wagons || 0,
                    trains: state.transport.trains || 0,
                    capacity: state.transport.capacity || 0,
                    usage: state.transport.usage || 0,
                    penaltyTrading: state.transport.penaltyTrading || 1.0,
                    penaltyProcessing: state.transport.penaltyProcessing || 1.0
                },
                
                // City
                city: {
                    police: state.city.police || 0,
                    banks: state.city.banks || 0,
                    markets: state.city.markets || 0,
                    universities: state.city.universities || 0,
                    corruption: state.city.corruption || 0,
                    theftRisk: state.city.theftRisk || 0,
                    theftLosses: state.city.theftLosses || 0,
                    theftProtection: state.city.theftProtection || 0,
                    decay: state.city.decay || 0,
                    maxDecay: state.city.maxDecay || 0,
                    rebirths: state.city.rebirths || 0,
                    taxRate: state.city.taxRate || 0,
                    politicians: state.city.politicians || 0,
                    autoSellFinished: state.city.autoSellFinished || false
                },
                
                // Research and unlocks
                research: state.research || {},
                unlocks: {
                    unlock_stone: state.unlock_stone || false,
                    unlock_coal: state.unlock_coal || false,
                    unlock_iron: state.unlock_iron || false,
                    unlock_silver: state.unlock_silver || false,
                    unlock_gold: state.unlock_gold || false,
                    unlock_oil: state.unlock_oil || false,
                    unlock_rubber: state.unlock_rubber || false,
                    unlock_processing: state.unlock_processing || false,
                    unlock_electronics: state.unlock_electronics || false,
                    unlock_jewelry: state.unlock_jewelry || false,
                    unlock_automotive: state.unlock_automotive || false
                },
                
                // Statistics
                stats: {
                    total_resources_mined: state.stats?.totalResourcesMined || {},
                    total_gold_earned: state.stats?.totalGoldEarned || 0,
                    total_gold_spent: state.stats?.totalGoldSpent || 0
                },
                
                // Efficiency multipliers
                efficiency: state.efficiency || {}
            },
            
            // Prestige level (used by backend for leaderboard)
            prestige_level: state.prestige?.level || 0,
            
            // Characters, buildings, upgrades (empty for now - Kingdom Quarry specific)
            characters: [],
            buildings: {},
            upgrades: {
                miner_level: 1,
                transport_level: 1,
                market_level: 1,
                storage_level: 1
            },
            unlocked_vehicles: ["hand_cart"],
            achievements: [],
            
            // Offline time
            offline_time: 0,
            
            // Settings
            settings: {
                sound_enabled: true,
                auto_save: true,
                notifications: true,
                graphics_quality: "high"
            }
        };
    }

    applySaveData(saveData) {
        const state = this.gameEngine.state;
        
        console.log('=== APPLYING SAVE DATA ===');
        console.log('Raw save data:', saveData);
        
        // Handle both new structure (with custom_data) and legacy/flat structure
        // New format: { resources: {...}, custom_data: { factory: {...}, ... } }
        // Legacy/flat format: { resources: {...}, factory: {...}, workers: {...}, ... }
        const customData = saveData.custom_data || saveData;
        
        console.log('Using custom data:', customData);
        
        // Restore resources
        if (saveData.resources) {
            console.log('Restoring resources:', saveData.resources);
            state.resources = state.resources || {};
            state.resources.stone = saveData.resources.stone || 0;
            state.resources.coal = saveData.resources.coal || 0;
            state.resources.iron = saveData.resources.iron || 0;
            state.resources.silver = saveData.resources.silver || 0;
            state.resources.gold = saveData.resources.gold || 0;
        }
        
        // Restore advanced inventories
        if (customData.factory) {
            console.log('Restoring factory:', customData.factory);
            state.factory = Object.assign({ raw: {}, processed: {}, finished: {} }, customData.factory);
        }
        if (customData.city_inventory) {
            console.log('Restoring city inventory:', customData.city_inventory);
            state.cityInventory = Object.assign({ finished: {} }, customData.city_inventory);
        }
        
        // Restore workers
        if (customData.workers) {
            console.log('Restoring workers:', customData.workers);
            state.workers = state.workers || {};
            state.workers.stoneMiners = customData.workers.stone_miners || 0;
            state.workers.coalMiners = customData.workers.coal_miners || 0;
            state.workers.ironMiners = customData.workers.iron_miners || 0;
            state.workers.silverMiners = customData.workers.silver_miners || 0;
        }
        
        // Restore processors
        if (customData.processors) {
            console.log('Restoring processors:', customData.processors);
            state.processors = Object.assign({}, customData.processors);
        }
        
        // Restore traders
        if (customData.traders) {
            console.log('Restoring traders:', customData.traders);
            state.traders = state.traders || {};
            state.traders.stoneTraders = customData.traders.stone_traders || 0;
            state.traders.coalTraders = customData.traders.coal_traders || 0;
            state.traders.metalTraders = customData.traders.metal_traders || 0;
        }
        
        // Restore transport
        if (customData.transport) {
            console.log('Restoring transport:', customData.transport);
            state.transport = Object.assign({}, customData.transport);
        }
        
        // Restore city
        if (customData.city) {
            console.log('Restoring city:', customData.city);
            state.city = Object.assign({}, customData.city);
        }
        
        // Restore research and unlocks
        if (customData.research) {
            state.research = Object.assign({}, customData.research);
        }
        if (customData.unlocks) {
            state.unlock_stone = !!customData.unlocks.unlock_stone;
            state.unlock_coal = !!customData.unlocks.unlock_coal;
            state.unlock_iron = !!customData.unlocks.unlock_iron;
            state.unlock_silver = !!customData.unlocks.unlock_silver;
            state.unlock_gold = !!customData.unlocks.unlock_gold;
            state.unlock_oil = !!customData.unlocks.unlock_oil;
            state.unlock_rubber = !!customData.unlocks.unlock_rubber;
            state.unlock_processing = !!customData.unlocks.unlock_processing;
            state.unlock_electronics = !!customData.unlocks.unlock_electronics;
            state.unlock_jewelry = !!customData.unlocks.unlock_jewelry;
            state.unlock_automotive = !!customData.unlocks.unlock_automotive;
        }
        
        // Restore statistics
        if (customData.stats) {
            state.stats = state.stats || { totalResourcesMined: {}, totalGoldEarned: 0, totalGoldSpent: 0 };
            if (customData.stats.total_resources_mined) {
                state.stats.totalResourcesMined = Object.assign({}, customData.stats.total_resources_mined);
            }
            if (typeof customData.stats.total_gold_earned === 'number') {
                state.stats.totalGoldEarned = customData.stats.total_gold_earned;
            }
            if (typeof customData.stats.total_gold_spent === 'number') {
                state.stats.totalGoldSpent = customData.stats.total_gold_spent;
            }
        }
        
        // Restore prestige
        if (saveData.prestige_level !== undefined) {
            state.prestige = state.prestige || {};
            state.prestige.level = saveData.prestige_level;
        } else if (customData.prestige) {
            state.prestige = Object.assign({}, customData.prestige);
        }
        
        // Restore efficiency
        if (customData.efficiency) {
            state.efficiency = Object.assign({}, customData.efficiency);
        }
        
        // Restore game time
        if (typeof saveData.play_time === 'number') {
            state.gameTime = saveData.play_time;
        } else if (typeof customData.game_time === 'number') {
            state.gameTime = customData.game_time;
        }
        
        // Ensure defaults for fields that may not exist
        state.factory = state.factory || { raw: {}, processed: {}, finished: {} };
        state.cityInventory = state.cityInventory || { finished: {} };
        state.transport = state.transport || {};
        if (typeof state.transport.penaltyTrading !== 'number') state.transport.penaltyTrading = 1.0;
        if (typeof state.transport.penaltyProcessing !== 'number') state.transport.penaltyProcessing = 1.0;
        state.city = state.city || {};
        if (typeof state.city.autoSellFinished !== 'boolean') state.city.autoSellFinished = false;
        
        console.log('=== SAVE DATA APPLIED SUCCESSFULLY ===');
        console.log('Final game state:', {
            resources: state.resources,
            workers: state.workers,
            transport: state.transport,
            gameTime: state.gameTime
        });
        
        // Trigger UI update
        if (this.gameEngine.updateUI) {
            console.log('Calling updateUI()');
            this.gameEngine.updateUI();
        } else {
            console.warn('updateUI method not available on gameEngine');
        }
    }

    // ===================
    // Auto-Save System
    // ===================

    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setInterval(() => {
            if (this.isAuthenticated) {
                this.saveGame();
            }
        }, this.autoSaveInterval);
        
        console.log('Auto-save started (every 30 seconds)');
    }

    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
            console.log('Auto-save stopped');
        }
    }

    // ===================
    // Local Storage for Credentials
    // ===================

    saveCredentials() {
        if (this.authToken && this.username) {
            localStorage.setItem('industrialEmpire_auth', JSON.stringify({
                token: this.authToken,
                username: this.username,
                timestamp: Date.now()
            }));
        }
    }

    loadCredentials() {
        try {
            const saved = localStorage.getItem('industrialEmpire_auth');
            if (saved) {
                const data = JSON.parse(saved);
                
                // Check if token is less than 24 hours old
                if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
                    this.authToken = data.token;
                    this.username = data.username;
                    this.isAuthenticated = true;
                    
                    console.log(`Restored session for user: ${this.username}`);
                    
                    // Try to load game data
                    setTimeout(() => this.loadGame(), 1000);
                    
                    // Start auto-save
                    this.startAutoSave();
                } else {
                    // Token expired
                    this.clearCredentials();
                }
            }
        } catch (error) {
            console.error('Error loading credentials:', error);
            this.clearCredentials();
        }
    }

    clearCredentials() {
        localStorage.removeItem('industrialEmpire_auth');
    }

    // Get current player data (for UI state restoration)
    getPlayerData() {
        if (this.isAuthenticated && this.username) {
            return {
                username: this.username,
                authToken: this.authToken,
                isAuthenticated: this.isAuthenticated
            };
        }
        return null;
    }

    // ===================
    // Leaderboard
    // ===================

    async getLeaderboard(limit = 100) {
        try {
            if (!this.isAuthenticated) {
                console.warn('Not authenticated - cannot fetch leaderboard');
                return [];
            }
            
            const response = await fetch(`${this.baseUrl}${this.apiEndpoint}/leaderboard?limit=${limit}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Backend returns GameLeaderboardResponse with entries array
                return data.entries || [];
            } else {
                console.error('Leaderboard fetch failed:', data);
                return [];
            }
        } catch (error) {
            console.error('Leaderboard error:', error);
            return [];
        }
    }
}

// Export for use in other modules
window.SaveManager = SaveManager;