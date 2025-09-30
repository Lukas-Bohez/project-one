// =============================================================================
// KINGDOM QUARRY - SAVE SYSTEM
// =============================================================================

class SaveSystem {
    constructor(authSystem) {
        this.authSystem = authSystem;
        this.localStorageKey = 'kingdomQuarrySave';
        this.lastSaveTime = 0;
        this.autoSaveInterval = null;
        this.isDirty = false; // Track if game state has changed
        
        this.setupAutoSave();
    }
    
    // Setup automatic saving
    setupAutoSave() {
        const autoSaveSeconds = parseInt(document.getElementById('autoSave')?.value || '60');
        
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        if (autoSaveSeconds > 0) {
            this.autoSaveInterval = setInterval(() => {
                if (this.isDirty) {
                    this.saveGame(false); // Auto-save without backup
                }
            }, autoSaveSeconds * 1000);
        }
    }
    
    // Mark game state as dirty (needs saving)
    markDirty() {
        this.isDirty = true;
    }
    
    // Save game state (local and/or cloud)
    async saveGame(createBackup = false, showNotification = true) {
        try {
            const gameState = this.getCurrentGameState();
            
            // Always save locally
            this.saveLocal(gameState);
            
            // Save to cloud if authenticated and not guest
            if (this.authSystem.isAuthenticated && !this.authSystem.isGuest) {
                await this.saveToCloud(gameState, createBackup);
            }
            
            this.lastSaveTime = Date.now();
            this.isDirty = false;
            
            if (showNotification) {
                this.showSaveNotification('Game saved successfully!');
            }
            
            return true;
            
        } catch (error) {
            console.error('Save failed:', error);
            if (showNotification) {
                this.showSaveNotification('Save failed: ' + error.message, 'error');
            }
            return false;
        }
    }
    
    // Load game state (cloud first, then local)
    async loadGame() {
        try {
            let gameState = null;
            
            // Try to load from cloud if authenticated and not guest
            if (this.authSystem.isAuthenticated && !this.authSystem.isGuest) {
                gameState = await this.loadFromCloud();
            }
            
            // Fallback to local save if cloud load failed or user is guest
            if (!gameState) {
                gameState = this.loadLocal();
            }
            
            // Use default state if no save found
            if (!gameState) {
                gameState = this.createDefaultGameState();
            }
            
            // Validate and migrate save data if needed
            gameState = this.validateAndMigrateSave(gameState);
            
            return gameState;
            
        } catch (error) {
            console.error('Load failed:', error);
            this.showSaveNotification('Load failed, using default save', 'warning');
            return this.createDefaultGameState();
        }
    }
    
    // Save to localStorage
    saveLocal(gameState) {
        try {
            const saveData = {
                version: GAME_CONFIG.version,
                timestamp: Date.now(),
                gameState: gameState,
                metadata: {
                    playtime: gameState.player.totalPlayTime,
                    prestigeLevel: gameState.player.prestigeLevel
                }
            };
            
            localStorage.setItem(this.localStorageKey, JSON.stringify(saveData));
            
        } catch (error) {
            console.error('Local save failed:', error);
            throw new Error('Failed to save locally: ' + error.message);
        }
    }
    
    // Load from localStorage
    loadLocal() {
        try {
            const savedData = localStorage.getItem(this.localStorageKey);
            if (!savedData) {
                return null;
            }
            
            const saveData = JSON.parse(savedData);
            return saveData.gameState;
            
        } catch (error) {
            console.error('Local load failed:', error);
            return null;
        }
    }
    
    // Save to cloud via API
    async saveToCloud(gameState, createBackup = false) {
        // Check if cloud saves are available
        if (!this.authSystem.gameEndpointsAvailable) {
            console.log('Cloud saves not available - PyJWT not installed');
            return; // Skip cloud save silently
        }
        
        try {
            const saveRequest = {
                save_data: {
                    version: GAME_CONFIG.version,
                    player_name: gameState.player.name,
                    prestige_level: gameState.player.prestigeLevel,
                    total_play_time: gameState.player.totalPlayTime,
                    resources: gameState.resources,
                    characters: gameState.characters,
                    transport: gameState.transport,
                    market: gameState.market,
                    achievements: gameState.achievements,
                    statistics: gameState.statistics,
                    settings: gameState.settings,
                    game_version: GAME_CONFIG.version,
                    last_save: Date.now()
                },
                backup: createBackup
            };
            
            const response = await this.authSystem.makeAuthenticatedRequest(
                API_CONFIG.endpoints.save,
                {
                    method: 'POST',
                    body: JSON.stringify(saveRequest)
                }
            );
            
            if (!response || !response.ok) {
                const errorData = await response?.json();
                throw new Error(errorData?.detail || 'Cloud save failed');
            }
            
            const result = await response.json();
            console.log('Cloud save successful:', result);
            
        } catch (error) {
            console.error('Cloud save failed:', error);
            throw error;
        }
    }
    
    // Load from cloud via API
    async loadFromCloud() {
        // Check if cloud saves are available
        if (!this.authSystem.gameEndpointsAvailable) {
            console.log('Cloud saves not available - PyJWT not installed');
            return null;
        }
        
        try {
            const response = await this.authSystem.makeAuthenticatedRequest(
                API_CONFIG.endpoints.save,
                { method: 'GET' }
            );
            
            if (!response || !response.ok) {
                if (response?.status === 404) {
                    // No cloud save found, this is normal for new accounts
                    return null;
                }
                throw new Error('Failed to load from cloud');
            }
            
            const result = await response.json();
            
            if (!result.has_save) {
                return null;
            }
            
            // Convert cloud save format to local format
            const cloudSave = result.save_data;
            const gameState = {
                version: cloudSave.game_version || GAME_CONFIG.version,
                player: {
                    name: cloudSave.player_name || 'Noble',
                    prestigeLevel: cloudSave.prestige_level || 1,
                    totalPlayTime: cloudSave.total_play_time || 0,
                    lastSave: cloudSave.last_save || Date.now()
                },
                resources: cloudSave.resources || { stone: 0, gold: 0, crystals: 0 },
                characters: cloudSave.characters || DEFAULT_GAME_STATE.characters,
                transport: cloudSave.transport || DEFAULT_GAME_STATE.transport,
                market: cloudSave.market || DEFAULT_GAME_STATE.market,
                achievements: cloudSave.achievements || DEFAULT_GAME_STATE.achievements,
                statistics: cloudSave.statistics || DEFAULT_GAME_STATE.statistics,
                settings: cloudSave.settings || DEFAULT_GAME_STATE.settings
            };
            
            console.log('Cloud save loaded successfully');
            return gameState;
            
        } catch (error) {
            console.error('Cloud load failed:', error);
            return null;
        }
    }
    
    // Get current game state from game engine
    getCurrentGameState() {
        if (window.gameEngine) {
            return window.gameEngine.getGameState();
        }
        
        // Fallback to default state if game engine not available
        return this.createDefaultGameState();
    }
    
    // Create default game state
    createDefaultGameState() {
        return CONFIG_UTILS.deepMerge({}, DEFAULT_GAME_STATE);
    }
    
    // Validate and migrate save data for version compatibility
    validateAndMigrateSave(gameState) {
        try {
            // Ensure all required properties exist
            const migratedState = CONFIG_UTILS.deepMerge(this.createDefaultGameState(), gameState);
            
            // Version-specific migrations
            if (!migratedState.version || migratedState.version !== GAME_CONFIG.version) {
                console.log(`Migrating save from ${migratedState.version} to ${GAME_CONFIG.version}`);
                
                // Add any migration logic here for future versions
                migratedState.version = GAME_CONFIG.version;
            }
            
            // Validate resource values
            if (!migratedState.resources) {
                migratedState.resources = { stone: 0, gold: 0, crystals: 0 };
            }
            
            // Ensure resources are numbers
            for (const resource of ['stone', 'gold', 'crystals']) {
                if (typeof migratedState.resources[resource] !== 'number' || isNaN(migratedState.resources[resource])) {
                    migratedState.resources[resource] = 0;
                }
            }
            
            // Validate prestige level
            if (!migratedState.player.prestigeLevel || migratedState.player.prestigeLevel < 1) {
                migratedState.player.prestigeLevel = 1;
            }
            
            return migratedState;
            
        } catch (error) {
            console.error('Save validation/migration failed:', error);
            return this.createDefaultGameState();
        }
    }
    
    // Check for save conflicts (when both local and cloud saves exist)
    async checkForConflicts() {
        try {
            const localSave = this.loadLocal();
            
            if (!localSave || this.authSystem.isGuest || !this.authSystem.gameEndpointsAvailable) {
                return null; // No conflict possible
            }
            
            const response = await this.authSystem.makeAuthenticatedRequest(
                API_CONFIG.endpoints.save + '/conflict',
                { method: 'GET' }
            );
            
            if (!response || !response.ok) {
                return null; // No cloud save or error
            }
            
            const conflictData = await response.json();
            
            // Compare timestamps to detect conflicts
            const localTimestamp = localSave.player?.lastSave || 0;
            const cloudTimestamp = new Date(conflictData.cloud_timestamp).getTime();
            
            if (Math.abs(localTimestamp - cloudTimestamp) > 60000) { // More than 1 minute difference
                return {
                    localSave: localSave,
                    cloudSave: conflictData.cloud_save,
                    localTimestamp: localTimestamp,
                    cloudTimestamp: cloudTimestamp
                };
            }
            
            return null; // No significant conflict
            
        } catch (error) {
            console.error('Conflict check failed:', error);
            return null;
        }
    }
    
    // Resolve save conflicts by showing user choice dialog
    async resolveSaveConflict(conflictData) {
        return new Promise((resolve) => {
            const modal = this.createConflictModal(conflictData);
            document.body.appendChild(modal);
            
            modal.querySelector('.use-local-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(conflictData.localSave);
            });
            
            modal.querySelector('.use-cloud-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(conflictData.cloudSave);
            });
            
            modal.querySelector('.merge-saves-btn').addEventListener('click', () => {
                const mergedSave = this.mergeSaves(conflictData.localSave, conflictData.cloudSave);
                document.body.removeChild(modal);
                resolve(mergedSave);
            });
        });
    }
    
    // Create conflict resolution modal
    createConflictModal(conflictData) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content conflict-modal">
                <h2>⚠️ Save Conflict Detected</h2>
                <p>Both local and cloud saves exist with different timestamps:</p>
                
                <div class="conflict-options">
                    <div class="save-option">
                        <h3>💾 Local Save</h3>
                        <p>Last saved: ${new Date(conflictData.localTimestamp).toLocaleString()}</p>
                        <p>Stone: ${CONFIG_UTILS.formatNumber(conflictData.localSave.resources?.stone || 0)}</p>
                        <p>Prestige: Level ${conflictData.localSave.player?.prestigeLevel || 1}</p>
                        <button class="auth-btn primary use-local-btn">Use Local</button>
                    </div>
                    
                    <div class="save-option">
                        <h3>☁️ Cloud Save</h3>
                        <p>Last saved: ${new Date(conflictData.cloudTimestamp).toLocaleString()}</p>
                        <p>Stone: ${CONFIG_UTILS.formatNumber(conflictData.cloudSave.resources?.stone || 0)}</p>
                        <p>Prestige: Level ${conflictData.cloudSave.player?.prestigeLevel || 1}</p>
                        <button class="auth-btn primary use-cloud-btn">Use Cloud</button>
                    </div>
                </div>
                
                <div class="conflict-actions">
                    <button class="auth-btn secondary merge-saves-btn">🔄 Smart Merge</button>
                    <p class="merge-info">Combines the best of both saves (higher resources, unlocked content)</p>
                </div>
            </div>
        `;
        
        return modal;
    }
    
    // Merge two saves intelligently
    mergeSaves(localSave, cloudSave) {
        const merged = CONFIG_UTILS.deepMerge(this.createDefaultGameState(), localSave);
        
        // Take the higher values for resources
        merged.resources.stone = Math.max(localSave.resources?.stone || 0, cloudSave.resources?.stone || 0);
        merged.resources.gold = Math.max(localSave.resources?.gold || 0, cloudSave.resources?.gold || 0);
        merged.resources.crystals = Math.max(localSave.resources?.crystals || 0, cloudSave.resources?.crystals || 0);
        
        // Take higher prestige level
        merged.player.prestigeLevel = Math.max(localSave.player?.prestigeLevel || 1, cloudSave.player?.prestigeLevel || 1);
        
        // Combine character counts (take higher)
        for (const [characterType, localData] of Object.entries(localSave.characters || {})) {
            const cloudData = cloudSave.characters?.[characterType] || { count: 0, unlocked: false };
            merged.characters[characterType] = {
                count: Math.max(localData.count || 0, cloudData.count || 0),
                unlocked: localData.unlocked || cloudData.unlocked
            };
        }
        
        // Combine transport levels (take higher)
        for (const [transportType, localData] of Object.entries(localSave.transport || {})) {
            const cloudData = cloudSave.transport?.[transportType] || { level: 0, unlocked: false };
            merged.transport[transportType] = {
                level: Math.max(localData.level || 0, cloudData.level || 0),
                unlocked: localData.unlocked || cloudData.unlocked
            };
        }
        
        // Combine achievements
        const allAchievements = [...(localSave.achievements?.unlocked || []), ...(cloudSave.achievements?.unlocked || [])];
        merged.achievements.unlocked = [...new Set(allAchievements)]; // Remove duplicates
        
        // Use the most recent timestamp
        merged.player.lastSave = Math.max(localSave.player?.lastSave || 0, cloudSave.player?.lastSave || 0);
        
        console.log('Saves merged successfully');
        return merged;
    }
    
    // Export save data for backup
    exportSave() {
        try {
            const gameState = this.getCurrentGameState();
            const exportData = {
                version: GAME_CONFIG.version,
                exported: Date.now(),
                gameState: gameState
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `kingdom-quarry-save-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            this.showSaveNotification('Save exported successfully!');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.showSaveNotification('Export failed: ' + error.message, 'error');
        }
    }
    
    // Import save data from file
    async importSave(file) {
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            if (!importData.gameState) {
                throw new Error('Invalid save file format');
            }
            
            const gameState = this.validateAndMigrateSave(importData.gameState);
            
            // Apply imported state to game
            if (window.gameEngine) {
                window.gameEngine.loadGameState(gameState);
            }
            
            this.showSaveNotification('Save imported successfully!');
            
        } catch (error) {
            console.error('Import failed:', error);
            this.showSaveNotification('Import failed: ' + error.message, 'error');
        }
    }
    
    // Clear all save data
    clearAllSaves() {
        if (confirm('Are you sure you want to delete all save data? This cannot be undone!')) {
            localStorage.removeItem(this.localStorageKey);
            
            if (window.gameEngine) {
                window.gameEngine.resetGame();
            }
            
            this.showSaveNotification('All saves cleared');
        }
    }
    
    // Show save notification
    showSaveNotification(message, type = 'success') {
        console.log(`Save System [${type}]:`, message);
        
        // Enhanced save button feedback
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            const isCloudEnabled = this.authSystem.isAuthenticated && !this.authSystem.isGuest && this.authSystem.gameEndpointsAvailable;
            
            if (type === 'success') {
                saveBtn.textContent = isCloudEnabled ? '☁️ Saved' : '💾 Saved';
                saveBtn.className = 'action-btn save-btn success';
            } else {
                saveBtn.textContent = '✗ Error';
                saveBtn.className = 'action-btn save-btn error';
            }
            
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.className = 'action-btn save-btn';
            }, 2000);
        }
        
        // Use game engine notification system if available
        if (window.gameEngine && window.gameEngine.showNotification) {
            const notificationType = type === 'success' ? 'info' : type;
            window.gameEngine.showNotification(message, notificationType);
        }
    }
    
    // Update settings and restart auto-save if needed
    updateSettings() {
        this.setupAutoSave();
    }
    
    // Clean up resources
    destroy() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SaveSystem;
}