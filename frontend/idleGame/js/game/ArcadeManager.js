/**
 * ArcadeManager.js - Manages DOS games arcade integration
 * Players can play classic DOS games to boost their idle game progress
 */

class ArcadeManager {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.state = gameEngine.state;
        
        // Initialize arcade state
        if (!this.state.arcade) {
            this.state.arcade = {
                unlockedGames: ['doom', 'digger', 'commander', 'prince'], // All unlocked for playtesting
                playTime: {}, // Track time played per game
                highScores: {}, // Future: track high scores
                totalPlayTime: 0,
                activeGame: null,
                gameStartTime: null
            };
        }
        
        // Define available games
        this.games = {
            doom: {
                id: 'doom',
                name: 'DOOM',
                icon: '👾',
                cost: 0,  // FREE for playtesting
                unlockCost: 0,
                unlockLevel: 0,
                description: 'Classic FPS that defined a generation',
                zipUrl: 'dos-games/doom.zip',
                executable: 'cd DOOM && DOOM.COM',
                bonus: { type: 'mining', value: 0.05 }, // 5% mining speed per hour
                bonusAmount: 0.05
            },
            digger: {
                id: 'digger',
                name: 'Digger',
                icon: '⛏️',
                cost: 0,  // FREE for playtesting
                unlockCost: 0,
                unlockLevel: 0,
                description: 'Classic arcade digging action',
                zipUrl: 'dos-games/digger.zip',
                executable: 'DIGGER.COM',
                bonus: { type: 'trading', value: 0.03 }, // 3% trading bonus per hour
                bonusAmount: 0.03
            },
            commander: {
                id: 'commander',
                name: 'Commander Keen',
                icon: '🚀',
                cost: 0,  // FREE for playtesting
                unlockCost: 0,
                unlockLevel: 0,
                description: 'Side-scrolling platform adventure',
                zipUrl: 'dos-games/keen4.zip',
                executable: 'cd KEEN4 && KEEN4E.EXE',
                bonus: { type: 'processing', value: 0.04 }, // 4% processing speed per hour
                bonusAmount: 0.04
            },
            prince: {
                id: 'prince',
                name: 'Prince of Persia',
                icon: '🔱',
                cost: 0,  // FREE for playtesting
                unlockCost: 0,
                unlockLevel: 0,
                description: 'Legendary platformer with fluid animation',
                zipUrl: 'dos-games/prince.zip',
                executable: 'cd Ppersia && PRINCE.EXE',
                bonus: { type: 'global', value: 0.02 }, // 2% global efficiency per hour
                bonusAmount: 0.02
            }
        };
    }
    
    // Check if a game is unlocked
    isGameUnlocked(gameId) {
        return this.state.arcade.unlockedGames.includes(gameId);
    }
    
    // Check if a game can be unlocked
    canUnlockGame(gameId) {
        const game = this.games[gameId];
        if (!game) return false;
        
        const rebirths = this.state.city?.rebirths || 0;
        return !this.isGameUnlocked(gameId) && 
               rebirths >= game.unlockLevel && 
               this.state.resources.gold >= game.unlockCost;
    }
    
    // Unlock a game
    unlockGame(gameId) {
        if (!this.canUnlockGame(gameId)) return false;
        
        const game = this.games[gameId];
        this.state.resources.gold -= game.unlockCost;
        this.state.arcade.unlockedGames.push(gameId);
        this.state.arcade.playTime[gameId] = 0;
        
        console.log(`🎮 Unlocked arcade game: ${game.name}`);
        if (this.gameEngine.showNotification) {
            this.gameEngine.showNotification(`🎮 Unlocked: ${game.name}!`);
        }
        
        return true;
    }
    
    // Start playing a game
    startGame(gameId) {
        if (!this.isGameUnlocked(gameId)) return false;
        
        this.state.arcade.activeGame = gameId;
        this.state.arcade.gameStartTime = Date.now();
        
        const game = this.games[gameId];
        console.log(`🎮 Starting game: ${game.name}`);
        
        return true;
    }
    
    // Stop playing a game
    stopGame() {
        if (!this.state.arcade.activeGame) return;
        
        const gameId = this.state.arcade.activeGame;
        const game = this.games[gameId];
        
        if (this.state.arcade.gameStartTime) {
            const playTime = (Date.now() - this.state.arcade.gameStartTime) / 1000; // in seconds
            this.state.arcade.playTime[gameId] = (this.state.arcade.playTime[gameId] || 0) + playTime;
            this.state.arcade.totalPlayTime += playTime;
            
            console.log(`🎮 Stopped ${game.name}. Played for ${Math.round(playTime)}s`);
        }
        
        this.state.arcade.activeGame = null;
        this.state.arcade.gameStartTime = null;
    }
    
    // Update arcade bonuses (called each game tick)
    update(deltaTime) {
        // If a game is active, accumulate play time
        if (this.state.arcade.activeGame && this.state.arcade.gameStartTime) {
            const gameId = this.state.arcade.activeGame;
            this.state.arcade.playTime[gameId] = (this.state.arcade.playTime[gameId] || 0) + deltaTime;
            this.state.arcade.totalPlayTime += deltaTime;
        }
    }
    
    // Calculate total arcade bonuses
    getArcadeBonuses() {
        const bonuses = {
            resourceBonus: 1.0,
            efficiencyBonus: 1.0,
            goldBonus: 1.0,
            craftingBonus: 1.0
        };
        
        // Get rebirth upgrade arcade bonus multiplier
        const rebirthEffects = this.gameEngine.rebirthRewards ? 
            this.gameEngine.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { arcadeBonus: 1, arcadeResourceGen: 0 };
        
        // Calculate bonuses from each game based on play time
        Object.keys(this.games).forEach(gameId => {
            if (this.isGameUnlocked(gameId)) {
                const game = this.games[gameId];
                const playTimeHours = (this.state.arcade.playTime[gameId] || 0) / 3600; // Convert to hours
                
                // Each hour played adds the bonus amount, with diminishing returns (cap at 10 hours)
                const effectiveHours = Math.min(10, playTimeHours);
                const bonus = effectiveHours * game.bonusAmount * rebirthEffects.arcadeBonus;
                
                switch (game.bonusType) {
                    case 'combat':
                        bonuses.resourceBonus += bonus;
                        break;
                    case 'survival':
                        bonuses.efficiencyBonus += bonus;
                        break;
                    case 'power':
                        bonuses.goldBonus += bonus;
                        break;
                    case 'precision':
                        bonuses.craftingBonus += bonus;
                        break;
                }
            }
        });
        
        // Passive resource generation from playing arcade (if upgrade purchased)
        if (rebirthEffects.arcadeResourceGen > 0 && this.state.arcade.activeGame) {
            bonuses.passiveGen = rebirthEffects.arcadeResourceGen;
        }
        
        return bonuses;
    }
    
    // Get formatted play time for a game
    getFormattedPlayTime(gameId) {
        const seconds = this.state.arcade.playTime[gameId] || 0;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
    
    // Get available games to unlock
    getAvailableGames() {
        const rebirths = this.state.city?.rebirths || 0;
        return Object.entries(this.games)
            .filter(([id, game]) => rebirths >= game.unlockLevel)
            .map(([id, game]) => ({
                id,
                ...game,
                unlocked: this.isGameUnlocked(id),
                canUnlock: this.canUnlockGame(id),
                playTime: this.getFormattedPlayTime(id)
            }));
    }
}

// Export for use in other modules
window.ArcadeManager = ArcadeManager;
