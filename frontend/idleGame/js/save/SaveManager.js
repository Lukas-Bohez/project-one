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
            const response = await fetch(`${this.baseUrl}${this.apiEndpoint}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                    email: email
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
            // Prepare save data from game state
            const saveData = this.prepareSaveData();
            
            const response = await fetch(`${this.baseUrl}${this.apiEndpoint}/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify(saveData)
            });

            const data = await response.json();
            
            if (response.ok) {
                this.gameEngine.showNotification('💾 Game saved successfully!');
                return { success: true, message: 'Game saved successfully!' };
            } else {
                throw new Error(data.detail || 'Save failed');
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

        try {
            const response = await fetch(`${this.baseUrl}${this.apiEndpoint}/save`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            const data = await response.json();
            
            if (response.ok && data.save_data) {
                this.applySaveData(data.save_data);
                this.gameEngine.showNotification('📂 Game loaded successfully!');
                return { success: true, message: 'Game loaded successfully!' };
            } else if (response.status === 404) {
                // No save file exists - this is okay for new players
                console.log('No save file found - starting new game');
                return { success: true, message: 'Starting new game' };
            } else {
                throw new Error(data.detail || 'Load failed');
            }
        } catch (error) {
            console.error('Load error:', error);
            this.gameEngine.showNotification(`❌ Load failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    // ===================
    // Data Conversion
    // ===================

    prepareSaveData() {
        const state = this.gameEngine.state;
        
        return {
            game_version: "1.0.0",
            last_save: new Date().toISOString(),
            
            // Resources
            resources: {
                stone: Math.floor(state.resources.stone),
                coal: Math.floor(state.resources.coal),
                iron: Math.floor(state.resources.iron),
                silver: Math.floor(state.resources.silver),
                gold: Math.floor(state.resources.gold)
            },
            
            // Workers
            workers: {
                stone_miners: state.workers.stoneMiners,
                coal_miners: state.workers.coalMiners,
                iron_miners: state.workers.ironMiners,
                silver_miners: state.workers.silverMiners
            },
            
            // Processing
            processors: {
                smelters: state.processors.smelters,
                forges: state.processors.forges,
                refineries: state.processors.refineries,
                mints: state.processors.mints
            },
            
            // Trading
            traders: {
                stone_traders: state.traders.stoneTraders,
                coal_traders: state.traders.coalTraders,
                metal_traders: state.traders.metalTraders
            },
            
            // Transport
            transport: {
                carts: state.transport.carts,
                wagons: state.transport.wagons,
                trains: state.transport.trains,
                capacity: state.transport.capacity,
                usage: state.transport.usage
            },
            
            // City
            city: {
                police: state.city.police,
                banks: state.city.banks,
                markets: state.city.markets,
                universities: state.city.universities,
                corruption: state.city.corruption
            },
            
            // Research
            research: state.research,
            
            // Statistics
            stats: {
                total_resources_mined: state.stats.totalResourcesMined,
                total_gold_earned: state.stats.totalGoldEarned,
                total_gold_spent: state.stats.totalGoldSpent
            },
            
            // Prestige
            prestige: state.prestige,
            
            // Efficiency multipliers
            efficiency: state.efficiency,
            
            // Game time
            game_time: state.gameTime
        };
    }

    applySaveData(saveData) {
        const state = this.gameEngine.state;
        
        if (saveData.resources) {
            Object.assign(state.resources, saveData.resources);
        }
        
        if (saveData.workers) {
            state.workers.stoneMiners = saveData.workers.stone_miners || 0;
            state.workers.coalMiners = saveData.workers.coal_miners || 0;
            state.workers.ironMiners = saveData.workers.iron_miners || 0;
            state.workers.silverMiners = saveData.workers.silver_miners || 0;
        }
        
        if (saveData.processors) {
            Object.assign(state.processors, saveData.processors);
        }
        
        if (saveData.traders) {
            state.traders.stoneTraders = saveData.traders.stone_traders || 0;
            state.traders.coalTraders = saveData.traders.coal_traders || 0;
            state.traders.metalTraders = saveData.traders.metal_traders || 0;
        }
        
        if (saveData.transport) {
            Object.assign(state.transport, saveData.transport);
        }
        
        if (saveData.city) {
            Object.assign(state.city, saveData.city);
        }
        
        if (saveData.research) {
            Object.assign(state.research, saveData.research);
        }
        
        if (saveData.stats) {
            if (saveData.stats.total_resources_mined) {
                Object.assign(state.stats.totalResourcesMined, saveData.stats.total_resources_mined);
            }
            if (typeof saveData.stats.total_gold_earned === 'number') {
                state.stats.totalGoldEarned = saveData.stats.total_gold_earned;
            }
            if (typeof saveData.stats.total_gold_spent === 'number') {
                state.stats.totalGoldSpent = saveData.stats.total_gold_spent;
            }
        }
        
        if (saveData.prestige) {
            Object.assign(state.prestige, saveData.prestige);
        }
        
        if (saveData.efficiency) {
            Object.assign(state.efficiency, saveData.efficiency);
        }
        
        if (typeof saveData.game_time === 'number') {
            state.gameTime = saveData.game_time;
        }
        
        console.log('Save data applied successfully');
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

    // ===================
    // Leaderboard
    // ===================

    async getLeaderboard() {
        try {
            const response = await fetch(`${this.baseUrl}${this.apiEndpoint}/leaderboard`);
            const data = await response.json();
            
            if (response.ok) {
                return data.leaderboard || [];
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