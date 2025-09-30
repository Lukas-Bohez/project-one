// =============================================================================
// KINGDOM QUARRY - MARKET SYSTEM
// =============================================================================

class MarketSystem {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
    }
    
    update(deltaSeconds) {
        // Update market rates and check daily bonuses
        this.updateRates();
        this.checkDailyBonus();
    }
    
    updateRates() {
        // Market rates fluctuate slightly over time
        const market = this.gameEngine.gameState.market;
        const config = GAME_CONFIG.market;
        
        // Gradually return rates to base values
        market.currentRates.stoneToGold = this.lerp(
            market.currentRates.stoneToGold, 
            config.stoneToGold.baseRate, 
            0.001
        );
        
        market.currentRates.goldToCrystals = this.lerp(
            market.currentRates.goldToCrystals, 
            config.goldToCrystals.baseRate, 
            0.001
        );
    }
    
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    checkDailyBonus() {
        const market = this.gameEngine.gameState.market;
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        
        if (now - market.lastDailyBonus > dayInMs) {
            this.grantDailyBonus();
            market.lastDailyBonus = now;
        }
    }
    
    grantDailyBonus() {
        const config = GAME_CONFIG.market.dailyBonuses;
        if (!config.enabled) return;
        
        const resources = this.gameEngine.gameState.resources;
        resources.stone += config.stoneBonus;
        resources.gold += config.goldBonus;
        resources.crystals += config.crystalBonus;
        
        this.gameEngine.showNotification('Daily bonus received!', 'success');
        console.log('Daily bonus granted!');
    }
    
    tradeStoneForGold(stoneAmount) {
        const gameState = this.gameEngine.gameState;
        const market = gameState.market;
        
        if (gameState.resources.stone >= stoneAmount) {
            const goldReceived = Math.floor(stoneAmount / market.currentRates.stoneToGold);
            
            gameState.resources.stone -= stoneAmount;
            gameState.resources.gold += goldReceived;
            
            // Adjust rate slightly
            market.currentRates.stoneToGold *= GAME_CONFIG.market.stoneToGold.rateMultiplier;
            market.tradesMade++;
            
            this.gameEngine.updateUI();
            console.log(`Traded ${stoneAmount} stone for ${goldReceived} gold`);
        }
    }
    
    tradeGoldForCrystals(goldAmount) {
        const gameState = this.gameEngine.gameState;
        const market = gameState.market;
        
        if (gameState.resources.gold >= goldAmount) {
            const crystalsReceived = Math.floor(goldAmount / market.currentRates.goldToCrystals);
            
            gameState.resources.gold -= goldAmount;
            gameState.resources.crystals += crystalsReceived;
            
            // Adjust rate slightly
            market.currentRates.goldToCrystals *= GAME_CONFIG.market.goldToCrystals.rateMultiplier;
            market.tradesMade++;
            
            this.gameEngine.updateUI();
            console.log(`Traded ${goldAmount} gold for ${crystalsReceived} crystals`);
        }
    }
    
    updateDisplay() {
        const marketList = document.getElementById('marketList');
        if (!marketList) return;
        
        const market = this.gameEngine.gameState.market;
        const resources = this.gameEngine.gameState.resources;
        
        marketList.innerHTML = `
            <div class="market-item">
                <div class="trade-header">
                    <span>💰 Stone → Gold</span>
                    <span class="trade-rate">${Math.floor(market.currentRates.stoneToGold)}:1</span>
                </div>
                <div class="trade-preview">
                    100 stone = ${Math.floor(100 / market.currentRates.stoneToGold)} gold
                </div>
                <div class="trade-buttons">
                    <button class="trade-btn ${resources.stone >= 10 ? '' : 'disabled'}" 
                            onclick="window.gameEngine.marketSystem.tradeStoneForGold(10)"
                            ${resources.stone >= 10 ? '' : 'disabled'}>
                        Trade 10
                    </button>
                    <button class="trade-btn ${resources.stone >= 100 ? '' : 'disabled'}" 
                            onclick="window.gameEngine.marketSystem.tradeStoneForGold(100)"
                            ${resources.stone >= 100 ? '' : 'disabled'}>
                        Trade 100
                    </button>
                    <button class="trade-btn ${resources.stone >= 1000 ? '' : 'disabled'}" 
                            onclick="window.gameEngine.marketSystem.tradeStoneForGold(1000)"
                            ${resources.stone >= 1000 ? '' : 'disabled'}>
                        Trade 1K
                    </button>
                    ${resources.stone >= 10000 ? `
                        <button class="trade-btn" 
                                onclick="window.gameEngine.marketSystem.tradeStoneForGold(10000)">
                            Trade 10K
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <div class="market-item">
                <div class="trade-header">
                    <span>💎 Gold → Crystals</span>
                    <span class="trade-rate">${Math.floor(market.currentRates.goldToCrystals)}:1</span>
                </div>
                <div class="trade-preview">
                    100 gold = ${Math.floor(100 / market.currentRates.goldToCrystals)} crystals
                </div>
                <div class="trade-buttons">
                    <button class="trade-btn ${resources.gold >= 100 ? '' : 'disabled'}" 
                            onclick="window.gameEngine.marketSystem.tradeGoldForCrystals(100)"
                            ${resources.gold >= 100 ? '' : 'disabled'}>
                        Trade 100
                    </button>
                    <button class="trade-btn ${resources.gold >= 500 ? '' : 'disabled'}" 
                            onclick="window.gameEngine.marketSystem.tradeGoldForCrystals(500)"
                            ${resources.gold >= 500 ? '' : 'disabled'}>
                        Trade 500
                    </button>
                </div>
            </div>
            
            <div class="market-bonus ${this.isDailyBonusAvailable() ? 'available' : 'claimed'}">
                <div class="bonus-header">
                    <span>🎁 Daily Bonus</span>
                    <span class="bonus-status">${this.isDailyBonusAvailable() ? 'Available!' : 'Claimed'}</span>
                </div>
                <div class="bonus-rewards">
                    ${GAME_CONFIG.market.dailyBonuses.stoneBonus} stone, 
                    ${GAME_CONFIG.market.dailyBonuses.goldBonus} gold, 
                    ${GAME_CONFIG.market.dailyBonuses.crystalBonus} crystals
                </div>
                <button class="bonus-btn ${this.isDailyBonusAvailable() ? '' : 'disabled'}" 
                        onclick="window.gameEngine.marketSystem.claimDailyBonus()"
                        ${this.isDailyBonusAvailable() ? '' : 'disabled'}>
                    ${this.isDailyBonusAvailable() ? 'Claim Bonus' : this.getNextBonusTime()}
                </button>
            </div>
            
            <div class="market-stats">
                <div class="stat">Trades Made: ${market.tradesMade}</div>
                <div class="stat">Next Rate Reset: ${this.getNextRateReset()}</div>
            </div>
        `;
    }
    
    claimDailyBonus() {
        if (this.isDailyBonusAvailable()) {
            this.grantDailyBonus();
            this.gameEngine.updateUI();
        }
    }
    
    getNextBonusTime() {
        const market = this.gameEngine.gameState.market;
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        const nextBonus = market.lastDailyBonus + dayInMs;
        const remaining = nextBonus - now;
        
        if (remaining <= 0) return 'Available';
        
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        
        return `${hours}h ${minutes}m`;
    }
    
    getNextRateReset() {
        // Rates slowly reset towards base values
        return 'Gradual';
    }
    
    isDailyBonusAvailable() {
        const market = this.gameEngine.gameState.market;
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        return (now - market.lastDailyBonus) > dayInMs;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarketSystem;
}