// =============================================================================
// KINGDOM QUARRY - CHARACTER SYSTEM
// =============================================================================

class CharacterSystem {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.bindEvents();
    }
    
    bindEvents() {
        const hireBtn = document.getElementById('hireCharacterBtn');
        if (hireBtn) {
            hireBtn.addEventListener('click', () => this.showHireMenu());
        }
    }
    
    showHireMenu() {
        // Placeholder - would show character hire interface
        console.log('Character hire menu - to be implemented');
    }
    
    update(deltaSeconds) {
        // Update character-specific logic
        this.checkUnlocks();
    }
    
    checkUnlocks() {
        const gameState = this.gameEngine.gameState;
        const resources = gameState.resources;
        
        // Check character unlocks
        for (const [characterType, config] of Object.entries(GAME_CONFIG.characters)) {
            const characterData = gameState.characters[characterType];
            if (!characterData.unlocked && config.unlockRequirement) {
                if (CONFIG_UTILS.checkRequirements(config.unlockRequirement, resources)) {
                    characterData.unlocked = true;
                    console.log(`${characterType} unlocked!`);
                }
            }
        }
    }
    
    updateDisplay() {
        // Update character list UI
        const charactersList = document.getElementById('charactersList');
        if (!charactersList) return;
        
        charactersList.innerHTML = '';
        
        for (const [characterType, config] of Object.entries(GAME_CONFIG.characters)) {
            const characterData = this.gameEngine.gameState.characters[characterType];
            
            if (characterData.unlocked || this.shouldShowLocked(characterType, config)) {
                const element = this.createCharacterElement(characterType, config, characterData);
                charactersList.appendChild(element);
            }
        }
        
        // Update hire button
        this.updateHireButton();
    }
    
    shouldShowLocked(characterType, config) {
        // Show locked characters if we're close to unlocking them
        if (!config.unlockRequirement) return false;
        
        const resources = this.gameEngine.gameState.resources;
        const totalProgress = Object.entries(config.unlockRequirement).reduce((progress, [resource, required]) => {
            const current = resources[resource] || 0;
            return progress + Math.min(current / required, 1);
        }, 0);
        
        return totalProgress >= 0.5; // Show when 50% of requirements met
    }
    
    createCharacterElement(type, config, data) {
        const div = document.createElement('div');
        const isUnlocked = data.unlocked;
        const isLocked = !isUnlocked;
        
        div.className = `character-item ${isLocked ? 'locked' : ''}`;
        
        if (isLocked) {
            // Show locked character with requirements
            div.innerHTML = `
                <div class="character-header">
                    <span class="character-name">🔒 ${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    <span class="character-status">Locked</span>
                </div>
                <div class="character-requirements">
                    Requires: ${Object.entries(config.unlockRequirement || {}).map(([resource, amount]) => 
                        `${CONFIG_UTILS.formatNumber(amount)} ${resource}`
                    ).join(', ')}
                </div>
                <div class="character-progress">
                    ${this.getUnlockProgress(config.unlockRequirement)}
                </div>
            `;
        } else {
            // Show unlocked character with hire options
            const cost = CONFIG_UTILS.calculateCost(config.baseCost, data.count, config.costMultiplier);
            const canAfford = this.canAffordCharacter(cost);
            const production = CONFIG_UTILS.calculateProduction(config.baseProduction, this.gameEngine.gameState.player.prestigeLevel);
            const totalProduction = this.calculateTotalProduction(type, production, data.count);
            
            div.innerHTML = `
                <div class="character-header">
                    <span class="character-name">${this.getCharacterIcon(type)} ${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    <span class="character-count">${data.count}</span>
                </div>
                <div class="character-production">
                    ${Object.entries(totalProduction).map(([resource, amount]) => 
                        `+${CONFIG_UTILS.formatNumber(amount)}/s ${resource}`
                    ).join(' ')}
                </div>
                <div class="character-cost">
                    Next: ${Object.entries(cost).map(([resource, amount]) => 
                        `${CONFIG_UTILS.formatNumber(amount)} ${resource}`
                    ).join(', ')}
                </div>
                <div class="character-actions">
                    <button class="hire-character-btn ${canAfford ? '' : 'disabled'}" 
                            data-character="${type}" ${canAfford ? '' : 'disabled'}>
                        Hire (+1)
                    </button>
                    ${data.count >= 10 ? `
                        <button class="hire-bulk-btn ${this.canAffordBulk(type, 10) ? '' : 'disabled'}" 
                                data-character="${type}" data-amount="10" ${this.canAffordBulk(type, 10) ? '' : 'disabled'}>
                            Hire x10
                        </button>
                    ` : ''}
                </div>
            `;
            
            // Bind events
            const hireBtn = div.querySelector('.hire-character-btn');
            hireBtn.addEventListener('click', () => this.hireCharacter(type));
            
            const bulkBtn = div.querySelector('.hire-bulk-btn');
            if (bulkBtn) {
                bulkBtn.addEventListener('click', () => this.hireBulkCharacters(type, 10));
            }
        }
        
        return div;
    }
    
    getCharacterIcon(type) {
        const icons = {
            peasant: '👨‍🌾',
            miner: '⛏️',
            foreman: '👷',
            engineer: '🔧',
            master: '👑'
        };
        return icons[type] || '👤';
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
    
    calculateTotalProduction(type, baseProduction, count) {
        if (count === 0) return {};
        
        const transportMultiplier = this.gameEngine.transportSystem?.getTotalMultiplier() || 1;
        const totalProduction = {};
        
        for (const [resource, amount] of Object.entries(baseProduction)) {
            totalProduction[resource] = amount * count * transportMultiplier;
        }
        
        return totalProduction;
    }
    
    canAffordBulk(type, amount) {
        const config = GAME_CONFIG.characters[type];
        const data = this.gameEngine.gameState.characters[type];
        
        let totalCost = { stone: 0, gold: 0, crystals: 0 };
        
        for (let i = 0; i < amount; i++) {
            const cost = CONFIG_UTILS.calculateCost(config.baseCost, data.count + i, config.costMultiplier);
            for (const [resource, resourceCost] of Object.entries(cost)) {
                totalCost[resource] = (totalCost[resource] || 0) + resourceCost;
            }
        }
        
        return CONFIG_UTILS.checkRequirements(totalCost, this.gameEngine.gameState.resources);
    }
    
    hireBulkCharacters(type, amount) {
        for (let i = 0; i < amount; i++) {
            if (!this.hireCharacter(type, false)) {
                break; // Stop if we can't afford more
            }
        }
        
        // Update UI once after bulk hire
        this.gameEngine.updateUI();
        console.log(`Bulk hired ${amount} ${type}s`);
    }
    
    updateHireButton() {
        const hireBtn = document.getElementById('hireCharacterBtn');
        if (!hireBtn) return;
        
        const availableCount = Object.values(this.gameEngine.gameState.characters)
            .filter(char => char.unlocked).length;
        
        hireBtn.textContent = `Characters (${availableCount})`;
    }
    
    canAffordCharacter(cost) {
        const resources = this.gameEngine.gameState.resources;
        return CONFIG_UTILS.checkRequirements(cost, resources);
    }
    
    hireCharacter(type, updateUI = true) {
        const config = GAME_CONFIG.characters[type];
        const data = this.gameEngine.gameState.characters[type];
        const cost = CONFIG_UTILS.calculateCost(config.baseCost, data.count, config.costMultiplier);
        
        if (this.canAffordCharacter(cost)) {
            // Deduct resources
            for (const [resource, amount] of Object.entries(cost)) {
                this.gameEngine.gameState.resources[resource] -= amount;
            }
            
            // Add character
            data.count++;
            
            // Update statistics
            this.gameEngine.gameState.statistics.totalWorkers = 
                Object.values(this.gameEngine.gameState.characters).reduce((sum, char) => sum + char.count, 0);
            
            // Check for first hire achievement
            if (data.count === 1) {
                this.gameEngine.showNotification(`First ${type} hired! 🎉 They will work automatically and generate resources even when you're away!`, 'success', 5000);
                
                // Show additional tips for first worker
                if (type === 'peasant') {
                    setTimeout(() => {
                        this.gameEngine.showNotification('💡 Tip: Hire more workers to increase your stone production, or save up for better character types!', 'info', 6000);
                    }, 3000);
                }
            }
            
            // Show milestone notifications
            if (data.count === 10 && type === 'peasant') {
                this.gameEngine.showNotification('🏰 Great progress! You now have 10 peasants working for you. Consider upgrading to miners!', 'success');
            }
            
            // Update displays
            if (updateUI) {
                this.gameEngine.updateUI();
            }
            
            console.log(`Hired ${type}! Total: ${data.count}`);
            return true;
        }
        
        return false;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterSystem;
}