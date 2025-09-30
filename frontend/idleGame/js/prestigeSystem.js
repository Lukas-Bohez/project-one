// =============================================================================
// KINGDOM QUARRY - PRESTIGE SYSTEM
// =============================================================================

class PrestigeSystem {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.bindEvents();
    }
    
    bindEvents() {
        const prestigeBtn = document.getElementById('prestigeBtn');
        if (prestigeBtn) {
            prestigeBtn.addEventListener('click', () => this.performPrestige());
        }
    }
    
    update(deltaSeconds) {
        this.updatePrestigeAvailability();
    }
    
    updatePrestigeAvailability() {
        const gameState = this.gameEngine.gameState;
        const cost = this.getPrestigeCost();
        const canPrestige = gameState.resources.crystals >= cost;
        
        const prestigeBtn = document.getElementById('prestigeBtn');
        if (prestigeBtn) {
            if (canPrestige) {
                prestigeBtn.classList.remove('disabled');
                prestigeBtn.disabled = false;
            } else {
                prestigeBtn.classList.add('disabled');
                prestigeBtn.disabled = true;
            }
        }
    }
    
    getPrestigeCost() {
        const level = this.gameEngine.gameState.player.prestigeLevel;
        return Math.floor(GAME_CONFIG.prestige.baseCrystalCost * Math.pow(GAME_CONFIG.prestige.costMultiplier, level - 1));
    }
    
    performPrestige() {
        const gameState = this.gameEngine.gameState;
        const cost = this.getPrestigeCost();
        
        if (gameState.resources.crystals >= cost) {
            // Confirm prestige
            if (!confirm(`Prestige to level ${gameState.player.prestigeLevel + 1}? This will reset your progress but grant permanent bonuses!`)) {
                return;
            }
            
            // Deduct crystals
            gameState.resources.crystals -= cost;
            
            // Increase prestige level
            gameState.player.prestigeLevel++;
            
            // Reset progress
            this.resetProgressForPrestige(gameState);
            
            // Grant prestige rewards
            this.grantPrestigeRewards(gameState);
            
            // Update UI
            this.gameEngine.updateUI();
            
            this.gameEngine.showNotification(
                `Prestigious! Welcome to level ${gameState.player.prestigeLevel}`, 
                'success'
            );
            
            console.log(`Prestiged to level ${gameState.player.prestigeLevel}!`);
        }
    }
    
    resetProgressForPrestige(gameState) {
        // Reset resources (keep some crystals)
        const crystalsToKeep = gameState.resources.crystals;
        gameState.resources = { stone: 0, gold: 0, crystals: crystalsToKeep };
        
        // Reset characters
        for (const characterType of Object.keys(gameState.characters)) {
            gameState.characters[characterType].count = 0;
            // Keep unlocks for higher prestige levels
            if (gameState.player.prestigeLevel <= 2) {
                gameState.characters[characterType].unlocked = characterType === 'peasant';
            }
        }
        
        // Reset transport
        for (const transportType of Object.keys(gameState.transport)) {
            gameState.transport[transportType].level = 0;
            // Keep unlocks for higher prestige levels
            if (gameState.player.prestigeLevel <= 3) {
                gameState.transport[transportType].unlocked = false;
            }
        }
        
        // Reset market
        gameState.market.tradesMade = 0;
        gameState.market.currentRates = {
            stoneToGold: GAME_CONFIG.market.stoneToGold.baseRate,
            goldToCrystals: GAME_CONFIG.market.goldToCrystals.baseRate
        };
    }
    
    grantPrestigeRewards(gameState) {
        // Grant bonus crystals
        const bonusCrystals = GAME_CONFIG.prestige.crystalsPerLevel;
        gameState.resources.crystals += bonusCrystals;
        
        console.log(`Granted ${bonusCrystals} bonus crystals for prestige!`);
    }
    
    getPrestigeBonus() {
        const level = this.gameEngine.gameState.player.prestigeLevel;
        return 1 + (level - 1) * GAME_CONFIG.prestige.bonusPerLevel;
    }
    
    updateDisplay() {
        const cost = this.getPrestigeCost();
        const bonus = this.getPrestigeBonus();
        
        document.getElementById('prestigeCost').textContent = CONFIG_UTILS.formatNumber(cost);
        
        // Update prestige info
        const prestigeInfo = document.querySelector('.prestige-info');
        if (prestigeInfo) {
            const bonusPercent = ((bonus - 1) * 100).toFixed(0);
            
            // Add bonus display if not exists
            let bonusDisplay = prestigeInfo.querySelector('.prestige-bonus');
            if (!bonusDisplay) {
                bonusDisplay = document.createElement('p');
                bonusDisplay.className = 'prestige-bonus';
                prestigeInfo.insertBefore(bonusDisplay, prestigeInfo.querySelector('button'));
            }
            
            bonusDisplay.textContent = `Current Bonus: +${bonusPercent}% production`;
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrestigeSystem;
}