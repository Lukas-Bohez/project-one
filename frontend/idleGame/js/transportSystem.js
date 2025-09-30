// =============================================================================
// KINGDOM QUARRY - TRANSPORT SYSTEM
// =============================================================================

class TransportSystem {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
    }
    
    update(deltaSeconds) {
        // Update transport-specific logic
        this.checkUnlocks();
    }
    
    checkUnlocks() {
        const gameState = this.gameEngine.gameState;
        const resources = gameState.resources;
        
        // Check transport unlocks
        for (const [transportType, config] of Object.entries(GAME_CONFIG.transport)) {
            const transportData = gameState.transport[transportType];
            if (!transportData.unlocked && config.unlockRequirement) {
                if (CONFIG_UTILS.checkRequirements(config.unlockRequirement, resources)) {
                    transportData.unlocked = true;
                    console.log(`${transportType} unlocked!`);
                }
            }
        }
    }
    
    getTotalMultiplier() {
        let multiplier = 1;
        const transport = this.gameEngine.gameState.transport;
        
        for (const [transportType, config] of Object.entries(GAME_CONFIG.transport)) {
            const transportData = transport[transportType];
            if (transportData.level > 0) {
                multiplier *= Math.pow(config.productionMultiplier, transportData.level);
            }
        }
        
        return multiplier;
    }
    
    updateDisplay() {
        const transportList = document.getElementById('transportList');
        if (!transportList) return;
        
        transportList.innerHTML = '';
        
        for (const [transportType, config] of Object.entries(GAME_CONFIG.transport)) {
            const transportData = this.gameEngine.gameState.transport[transportType];
            
            if (transportData.unlocked || this.shouldShowLocked(transportType, config)) {
                const element = this.createTransportElement(transportType, config, transportData);
                transportList.appendChild(element);
            }
        }
    }
    
    shouldShowLocked(transportType, config) {
        // Show locked transport if we're close to unlocking
        if (!config.unlockRequirement) return false;
        
        const resources = this.gameEngine.gameState.resources;
        const totalProgress = Object.entries(config.unlockRequirement).reduce((progress, [resource, required]) => {
            const current = resources[resource] || 0;
            return progress + Math.min(current / required, 1);
        }, 0);
        
        return totalProgress >= 0.3; // Show when 30% of requirements met
    }
    
    createTransportElement(type, config, data) {
        const div = document.createElement('div');
        const isUnlocked = data.unlocked;
        const isLocked = !isUnlocked;
        
        div.className = `transport-item ${isLocked ? 'locked' : ''}`;
        
        if (isLocked) {
            // Show locked transport with requirements
            div.innerHTML = `
                <div class="transport-header">
                    <span class="transport-name">🔒 ${this.getTransportName(type)}</span>
                    <span class="transport-status">Locked</span>
                </div>
                <div class="transport-description">
                    ${this.getTransportDescription(type, config)}
                </div>
                <div class="transport-requirements">
                    Requires: ${Object.entries(config.unlockRequirement || {}).map(([resource, amount]) => 
                        `${CONFIG_UTILS.formatNumber(amount)} ${resource}`
                    ).join(', ')}
                </div>
                <div class="transport-progress">
                    ${this.getUnlockProgress(config.unlockRequirement)}
                </div>
            `;
        } else {
            // Show unlocked transport with upgrade options
            const cost = CONFIG_UTILS.calculateCost(config.baseCost, data.level, config.costMultiplier);
            const canAfford = CONFIG_UTILS.checkRequirements(cost, this.gameEngine.gameState.resources);
            const currentBonus = data.level > 0 ? Math.pow(config.productionMultiplier, data.level) : 1;
            const nextBonus = Math.pow(config.productionMultiplier, data.level + 1);
            
            div.innerHTML = `
                <div class="transport-header">
                    <span class="transport-name">${this.getTransportIcon(type)} ${this.getTransportName(type)}</span>
                    <span class="transport-level">Level ${data.level}</span>
                </div>
                <div class="transport-effect">
                    ${data.level === 0 ? 'No bonus yet' : `${((currentBonus - 1) * 100).toFixed(0)}% production bonus`}
                </div>
                <div class="transport-next-effect">
                    Next: ${((nextBonus - 1) * 100).toFixed(0)}% total bonus
                </div>
                <div class="transport-cost">
                    ${data.level === 0 ? 'Unlock' : 'Upgrade'}: ${Object.entries(cost).map(([resource, amount]) => 
                        `${CONFIG_UTILS.formatNumber(amount)} ${resource}`
                    ).join(', ')}
                </div>
                <button class="upgrade-transport-btn ${canAfford ? '' : 'disabled'}" 
                        data-transport="${type}" ${canAfford ? '' : 'disabled'}>
                    ${data.level === 0 ? 'Unlock' : 'Upgrade'}
                </button>
            `;
            
            const button = div.querySelector('.upgrade-transport-btn');
            button.addEventListener('click', () => this.upgradeTransport(type));
        }
        
        return div;
    }
    
    getTransportIcon(type) {
        const icons = {
            cart: '🛒',
            wagon: '🚛',
            steamEngine: '🚂',
            magicPortal: '🌀'
        };
        return icons[type] || '🚚';
    }
    
    getTransportName(type) {
        const names = {
            cart: 'Cart',
            wagon: 'Wagon',
            steamEngine: 'Steam Engine',
            magicPortal: 'Magic Portal'
        };
        return names[type] || type;
    }
    
    getTransportDescription(type, config) {
        const descriptions = {
            cart: 'Simple wooden cart increases transport efficiency',
            wagon: 'Large wagon with multiple compartments',
            steamEngine: 'Steam-powered transport for massive loads',
            magicPortal: 'Magical portal for instant transportation'
        };
        return descriptions[type] || `Increases production by ${((config.productionMultiplier - 1) * 100).toFixed(0)}%`;
    }
    
    getUnlockProgress(requirements) {
        if (!requirements) return '';
        
        const resources = this.gameEngine.gameState.resources;
        const progressBars = Object.entries(requirements).map(([resource, required]) => {
            const current = resources[resource] || 0;
            const percentage = Math.min((current / required) * 100, 100);
            return `
                <div class="progress-bar">
                    <div class="progress-label">${resource}: ${CONFIG_UTILS.formatNumber(current)}/${CONFIG_UTILS.formatNumber(required)}</div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
        
        return progressBars;
    }
    
    upgradeTransport(type) {
        const config = GAME_CONFIG.transport[type];
        const data = this.gameEngine.gameState.transport[type];
        const cost = CONFIG_UTILS.calculateCost(config.baseCost, data.level, config.costMultiplier);
        
        if (CONFIG_UTILS.checkRequirements(cost, this.gameEngine.gameState.resources)) {
            // Deduct resources
            for (const [resource, amount] of Object.entries(cost)) {
                this.gameEngine.gameState.resources[resource] -= amount;
            }
            
            const wasFirstUpgrade = data.level === 0;
            
            // Upgrade transport
            data.level++;
            
            // Show notification for first upgrade
            if (wasFirstUpgrade) {
                const bonus = ((config.productionMultiplier - 1) * 100).toFixed(0);
                this.gameEngine.showNotification(`${this.getTransportName(type)} unlocked! +${bonus}% production bonus`, 'success');
            }
            
            // Update displays
            this.gameEngine.updateUI();
            
            console.log(`Upgraded ${type} to level ${data.level}!`);
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TransportSystem;
}