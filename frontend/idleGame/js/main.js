// =============================================================================
// KINGDOM QUARRY - MAIN INITIALIZATION
// =============================================================================

// Global game instance
let gameEngine = null;

// Main initialization function
async function initializeGame() {
    try {
        console.log('Kingdom Quarry - Starting initialization...');
        
        // Wait for all systems to be ready
        await waitForSystems();
        
    // Initialize game engine
    gameEngine = new GameEngine();
    window.gameEngine = gameEngine; // Make globally available
    await gameEngine.init();
        
    console.log('Kingdom Quarry - Game initialized successfully!');
        
    } catch (error) {
        console.error('Failed to initialize game:', error);
        showInitializationError(error);
    }
}

// Wait for all required systems to be loaded
async function waitForSystems() {
    return new Promise((resolve) => {
        const checkSystems = () => {
            // Check if all required classes are available
            const requiredClasses = [
                'AuthSystem', 'SaveSystem', 'GameEngine', 'QuarryRenderer',
                'CharacterSystem', 'TransportSystem', 'MarketSystem', 'PrestigeSystem'
            ];
            
            const allLoaded = requiredClasses.every(className => window[className] || eval(`typeof ${className} !== 'undefined'`));
            
            if (allLoaded) {
                resolve();
            } else {
                setTimeout(checkSystems, 100);
            }
        };
        
        checkSystems();
    });
}

// Show initialization error
function showInitializationError(error) {
    const loadingScreen = document.getElementById('loadingScreen');
    const loadingText = loadingScreen.querySelector('.loading-text');
    
    if (loadingText) {
        loadingText.textContent = 'Failed to load game: ' + error.message;
        loadingText.style.color = '#B22222';
    }
    
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Retry';
    retryButton.className = 'auth-btn primary';
    retryButton.style.marginTop = '20px';
    retryButton.onclick = () => {
        window.location.reload();
    };
    
    loadingScreen.querySelector('.loading-content').appendChild(retryButton);
}

// Handle window events
window.addEventListener('beforeunload', (e) => {
    // Save game before leaving
    if (gameEngine && gameEngine.saveSystem) {
        gameEngine.saveSystem.saveGame(false, false);
    }
});

window.addEventListener('visibilitychange', () => {
    // Pause/resume game when tab becomes inactive/active
    if (document.hidden) {
        console.log('Game paused - tab inactive');
    } else {
        console.log('Game resumed - tab active');
    }
});

// Handle errors globally
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    
    // Show user-friendly error message
    if (gameEngine) {
        gameEngine.showNotification('An error occurred. Please refresh if issues persist.', 'error');
    }
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
});

// Expose useful functions globally for debugging
window.DEBUG = {
    addResources: (stone = 1000, gold = 1000, crystals = 10) => {
        if (gameEngine) {
            gameEngine.gameState.resources.stone += stone;
            gameEngine.gameState.resources.gold += gold;
            gameEngine.gameState.resources.crystals += crystals;
            gameEngine.updateUI();
            console.log(`Added ${stone} stone, ${gold} gold, ${crystals} crystals`);
        }
    },
    
    setPrestigeLevel: (level) => {
        if (gameEngine) {
            gameEngine.gameState.player.prestigeLevel = level;
            gameEngine.updateUI();
            console.log(`Set prestige level to ${level}`);
        }
    },
    
    unlockAll: () => {
        if (gameEngine) {
            // Unlock all characters
            for (const character of Object.keys(gameEngine.gameState.characters)) {
                gameEngine.gameState.characters[character].unlocked = true;
            }
            
            // Unlock all transport
            for (const transport of Object.keys(gameEngine.gameState.transport)) {
                gameEngine.gameState.transport[transport].unlocked = true;
            }
            
            gameEngine.updateUI();
            console.log('Unlocked all characters and transport');
        }
    },
    
    save: () => {
        if (gameEngine) {
            gameEngine.saveGame(true, true);
        }
    },
    
    load: () => {
        if (gameEngine) {
            gameEngine.loadCloudSave();
        }
    },
    
    reset: () => {
        if (gameEngine && confirm('Really reset all progress?')) {
            gameEngine.resetGame();
        }
    },
    
    getGameState: () => {
        return gameEngine ? gameEngine.gameState : null;
    }
};

console.log('Kingdom Quarry debug functions available at window.DEBUG');
console.log('Available commands: addResources(), setPrestigeLevel(n), unlockAll(), save(), load(), reset(), getGameState()');

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeGame,
        DEBUG: window.DEBUG
    };
}