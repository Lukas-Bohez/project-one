/**
 * SaveManager.js - Manages game saving/loading with localStorage and server sync
 * Handles offline play, conflict resolution, and data persistence
 */

class SaveManager {
    constructor(gameEngine, apiClient) {
        this.gameEngine = gameEngine;
        this.apiClient = apiClient;
        this.localStorageKey = 'mineEmpire_save';
        this.playerKey = 'mineEmpire_player';
        this.settingsKey = 'mineEmpire_settings';
        
        // Auto-save settings
        this.autoSaveEnabled = true;
        this.autoSaveInterval = 30000; // 30 seconds
        this.autoSaveTimer = null;
        
        // Cloud sync settings
        this.cloudSyncEnabled = false;
        this.syncInterval = 300000; // 5 minutes
        this.syncTimer = null;
        this.lastSyncTime = 0;
        
        // Conflict resolution
        this.conflictResolutionStrategy = 'merge'; // 'local', 'server', 'merge'
        
        this.initialize();
    }
    
    initialize() {
        this.loadSettings();
        this.startAutoSave();
        
        // Check for existing player data
        const playerData = this.getPlayerData();
        if (playerData) {
            this.cloudSyncEnabled = true;
            this.startCloudSync();
        }
        
        // Handle page visibility changes for smart saving
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveToLocal();
            }
        });
        
        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.saveToLocal();
        });
        
        console.log('SaveManager initialized');
    }
    
    // Settings management
    loadSettings() {
        try {
            const settings = localStorage.getItem(this.settingsKey);
            if (settings) {
                const parsed = JSON.parse(settings);
                this.autoSaveEnabled = parsed.autoSaveEnabled ?? true;
                this.cloudSyncEnabled = parsed.cloudSyncEnabled ?? false;
                this.conflictResolutionStrategy = parsed.conflictResolutionStrategy ?? 'merge';
                
                console.log('Settings loaded');
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
    
    saveSettings() {
        try {
            const settings = {
                autoSaveEnabled: this.autoSaveEnabled,
                cloudSyncEnabled: this.cloudSyncEnabled,
                conflictResolutionStrategy: this.conflictResolutionStrategy
            };
            
            localStorage.setItem(this.settingsKey, JSON.stringify(settings));
            console.log('Settings saved');
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }
    
    // Local storage operations
    saveToLocal() {
        try {
            if (!this.gameEngine) return false;
            
            const saveData = this.gameEngine.getSaveData();
            localStorage.setItem(this.localStorageKey, JSON.stringify(saveData));
            
            this.updateSaveStatus('local');
            console.log('Game saved locally');
            return true;
        } catch (error) {
            console.error('Failed to save locally:', error);
            this.updateSaveStatus('error');
            return false;
        }
    }
    
    loadFromLocal() {
        try {
            const saveData = localStorage.getItem(this.localStorageKey);
            if (saveData) {
                const parsed = JSON.parse(saveData);
                
                if (this.gameEngine) {
                    this.gameEngine.loadSaveData(parsed);
                    console.log('Game loaded from local storage');
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Failed to load from local storage:', error);
            return false;
        }
    }
    
    // Cloud save operations
    async saveToCloud(playerId = null) {
        if (!this.cloudSyncEnabled || !this.apiClient) return false;
        
        try {
            this.updateSaveStatus('saving');
            
            const saveData = this.gameEngine.getSaveData();
            const playerData = this.getPlayerData();
            const id = playerId || (playerData ? playerData.id : null);
            
            await this.apiClient.saveGame(saveData, id);
            
            this.lastSyncTime = Date.now();
            this.updateSaveStatus('synced');
            console.log('Game saved to cloud');
            return true;
        } catch (error) {
            console.error('Failed to save to cloud:', error);
            this.updateSaveStatus('error');
            return false;
        }
    }
    
    async loadFromCloud(playerId = null) {
        if (!this.apiClient) return false;
        
        try {
            this.updateSaveStatus('loading');
            
            const playerData = this.getPlayerData();
            const id = playerId || (playerData ? playerData.id : null);
            
            const serverData = await this.apiClient.loadGame(id);
            
            if (serverData && serverData.gameData) {
                // Check for conflicts with local data
                const localData = localStorage.getItem(this.localStorageKey);
                
                if (localData) {
                    const resolvedData = await this.resolveConflict(JSON.parse(localData), serverData.gameData);
                    
                    if (this.gameEngine) {
                        this.gameEngine.loadSaveData(resolvedData);
                    }
                } else {
                    if (this.gameEngine) {
                        this.gameEngine.loadSaveData(serverData.gameData);
                    }
                }
                
                this.lastSyncTime = Date.now();
                this.updateSaveStatus('synced');
                console.log('Game loaded from cloud');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Failed to load from cloud:', error);
            this.updateSaveStatus('error');
            return false;
        }
    }
    
    // Conflict resolution
    async resolveConflict(localData, serverData) {
        console.log('Resolving save conflict...');
        
        switch (this.conflictResolutionStrategy) {
            case 'local':
                console.log('Using local data');
                return localData;
                
            case 'server':
                console.log('Using server data');
                return serverData;
                
            case 'merge':
            default:
                return this.mergeGameData(localData, serverData);
        }
    }
    
    mergeGameData(localData, serverData) {
        console.log('Merging game data...');
        
        // Use the data with the most progress (highest total stone mined or game time)
        const localProgress = (localData.totalStoneMined || 0) + (localData.gameTime || 0);
        const serverProgress = (serverData.totalStoneMined || 0) + (serverData.gameTime || 0);
        
        if (localProgress > serverProgress) {
            console.log('Local data has more progress, using local');
            return localData;
        } else if (serverProgress > localProgress) {
            console.log('Server data has more progress, using server');
            return serverData;
        } else {
            // If progress is similar, merge by taking the maximum values
            const merged = { ...serverData };
            
            // Take maximum values for resources and stats
            merged.stone = Math.max(localData.stone || 0, serverData.stone || 0);
            merged.totalStoneMined = Math.max(localData.totalStoneMined || 0, serverData.totalStoneMined || 0);
            merged.totalStoneSold = Math.max(localData.totalStoneSold || 0, serverData.totalStoneSold || 0);
            merged.totalGoldEarned = Math.max(localData.totalGoldEarned || 0, serverData.totalGoldEarned || 0);
            merged.gameTime = Math.max(localData.gameTime || 0, serverData.gameTime || 0);
            
            // Take maximum counts for workers and marketers
            merged.miners = Math.max(localData.miners || 0, serverData.miners || 0);
            merged.housing = Math.max(localData.housing || 0, serverData.housing || 0);
            merged.housingCapacity = Math.max(localData.housingCapacity || 0, serverData.housingCapacity || 0);
            merged.basicMarketers = Math.max(localData.basicMarketers || 0, serverData.basicMarketers || 0);
            merged.advancedMarketers = Math.max(localData.advancedMarketers || 0, serverData.advancedMarketers || 0);
            merged.expertMarketers = Math.max(localData.expertMarketers || 0, serverData.expertMarketers || 0);
            
            // Merge upgrades (use OR operation - if either has the upgrade, keep it)
            merged.upgrades = {
                ...serverData.upgrades,
                ...localData.upgrades
            };
            
            // Take maximum prestige values
            merged.prestigePoints = Math.max(localData.prestigePoints || 0, serverData.prestigePoints || 0);
            merged.totalPrestigeResets = Math.max(localData.totalPrestigeResets || 0, serverData.totalPrestigeResets || 0);
            
            console.log('Data merged successfully');
            return merged;
        }
    }
    
    // Player management
    getPlayerData() {
        try {
            const playerData = localStorage.getItem(this.playerKey);
            return playerData ? JSON.parse(playerData) : null;
        } catch (error) {
            console.error('Failed to get player data:', error);
            return null;
        }
    }
    
    setPlayerData(playerData) {
        try {
            localStorage.setItem(this.playerKey, JSON.stringify(playerData));
            console.log('Player data saved');
        } catch (error) {
            console.error('Failed to save player data:', error);
        }
    }
    
    async createPlayer(playerName, email = null) {
        try {
            if (!this.apiClient) throw new Error('API client not available');
            
            const playerData = await this.apiClient.createPlayer(playerName, email);
            this.setPlayerData(playerData);
            
            this.cloudSyncEnabled = true;
            this.saveSettings();
            this.startCloudSync();
            
            console.log('Player created and cloud sync enabled');
            return playerData;
        } catch (error) {
            console.error('Failed to create player:', error);
            throw error;
        }
    }
    
    // Auto-save management
    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        if (this.autoSaveEnabled) {
            this.autoSaveTimer = setInterval(() => {
                this.saveToLocal();
            }, this.autoSaveInterval);
            
            console.log('Auto-save started');
        }
    }
    
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
            console.log('Auto-save stopped');
        }
    }
    
    // Cloud sync management
    startCloudSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        
        if (this.cloudSyncEnabled) {
            this.syncTimer = setInterval(() => {
                this.saveToCloud();
            }, this.syncInterval);
            
            console.log('Cloud sync started');
        }
    }
    
    stopCloudSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('Cloud sync stopped');
        }
    }
    
    // Manual save/load operations
    async manualSave() {
        const success = this.saveToLocal();
        
        if (this.cloudSyncEnabled) {
            await this.saveToCloud();
        }
        
        return success;
    }
    
    async manualLoad() {
        if (this.cloudSyncEnabled) {
            const success = await this.loadFromCloud();
            if (success) {
                this.saveToLocal(); // Update local copy
                return true;
            }
        }
        
        return this.loadFromLocal();
    }
    
    // Game reset with confirmation
    resetGame() {
        if (confirm('Are you sure you want to reset your game? This cannot be undone!')) {
            localStorage.removeItem(this.localStorageKey);
            
            if (this.gameEngine) {
                this.gameEngine.reset();
            }
            
            console.log('Game reset');
            return true;
        }
        return false;
    }
    
    // Export/import functionality
    exportSave() {
        try {
            const saveData = this.gameEngine ? this.gameEngine.getSaveData() : null;
            if (!saveData) return null;
            
            const exportData = {
                version: '1.0.0',
                exported: Date.now(),
                gameData: saveData
            };
            
            const dataString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `mine-empire-save-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            console.log('Save exported');
            return true;
        } catch (error) {
            console.error('Failed to export save:', error);
            return false;
        }
    }
    
    importSave(fileInput) {
        return new Promise((resolve, reject) => {
            const file = fileInput.files[0];
            if (!file) {
                reject(new Error('No file selected'));
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    
                    if (importData.gameData && this.gameEngine) {
                        this.gameEngine.loadSaveData(importData.gameData);
                        this.saveToLocal();
                        console.log('Save imported successfully');
                        resolve(true);
                    } else {
                        reject(new Error('Invalid save file format'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }
    
    // UI status updates
    updateSaveStatus(status) {
        const saveStatusElement = document.getElementById('save-status');
        if (!saveStatusElement) return;
        
        switch (status) {
            case 'saving':
                saveStatusElement.textContent = 'Saving...';
                saveStatusElement.className = 'saving';
                break;
                
            case 'loading':
                saveStatusElement.textContent = 'Loading...';
                saveStatusElement.className = 'saving';
                break;
                
            case 'local':
                saveStatusElement.textContent = 'Saved';
                saveStatusElement.className = '';
                break;
                
            case 'synced':
                saveStatusElement.textContent = 'Synced';
                saveStatusElement.className = '';
                break;
                
            case 'error':
                saveStatusElement.textContent = 'Error';
                saveStatusElement.className = 'error';
                setTimeout(() => {
                    saveStatusElement.textContent = 'Saved';
                    saveStatusElement.className = '';
                }, 3000);
                break;
        }
    }
    
    // Cleanup
    destroy() {
        this.stopAutoSave();
        this.stopCloudSync();
        console.log('SaveManager destroyed');
    }
}

// Export for use in other modules
window.SaveManager = SaveManager;