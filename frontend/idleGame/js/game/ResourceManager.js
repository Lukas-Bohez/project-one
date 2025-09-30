/**
 * ResourceManager.js - Handles resource production, miners, and housing
 * Manages stone production calculations and worker management
 */

class ResourceManager {
    constructor() {
        this.state = null;
        
        // Base costs and values
        this.baseMinerCost = 10;
        this.baseHousingCost = 50;
        this.housingCapacityPerUnit = 10;
        this.baseStonePerMiner = 1; // stones per second per miner
    }
    
    setState(gameState) {
        this.state = gameState;
    }
    
    // Miner management
    getMinerCost() {
        // Miners have a fixed cost of 10 stone each
        return this.baseMinerCost;
    }
    
    canHireMiner() {
        if (!this.state) return false;
        
        // Check if there's housing available
        const currentHousingUsed = this.state.miners;
        const maxHousing = this.getMaxHousingCapacity();
        
        return currentHousingUsed < maxHousing;
    }
    
    hireMiner() {
        if (!this.state) return false;
        
        const cost = this.getMinerCost();
        
        // Check if player can afford and has housing
        if (this.state.stone >= cost && this.canHireMiner()) {
            this.state.stone -= cost;
            this.state.miners += 1;
            this.state.housing = Math.min(this.state.housing + 1, this.state.housingCapacity);
            
            console.log(`Hired miner. Total miners: ${this.state.miners}`);
            return true;
        }
        
        return false;
    }
    
    // Housing management
    getHousingCost() {
        return this.baseHousingCost;
    }
    
    buyHousing() {
        if (!this.state) return false;
        
        const cost = this.getHousingCost();
        
        if (this.state.stone >= cost) {
            this.state.stone -= cost;
            this.state.housingCapacity += this.housingCapacityPerUnit;
            
            console.log(`Built housing. Total capacity: ${this.state.housingCapacity}`);
            return true;
        }
        
        return false;
    }
    
    getMaxHousingCapacity() {
        if (!this.state) return 0;
        
        let capacity = this.state.housingCapacity;
        
        // Apply housing upgrades
        if (this.state.upgrades.housingUpgrade1) {
            capacity *= 2; // 2 miners per housing unit
        }
        if (this.state.upgrades.housingUpgrade2) {
            capacity *= 1.5; // 3 miners per housing unit (2 * 1.5 = 3)
        }
        
        return Math.floor(capacity);
    }
    
    // Production calculations
    calculateStoneProduction() {
        if (!this.state || this.state.miners === 0) return 0;
        
        let baseProduction = this.state.miners * this.baseStonePerMiner;
        
        // Apply miner efficiency upgrades
        let efficiencyMultiplier = 1.0;
        
        if (this.state.upgrades.minerEfficiency1) {
            efficiencyMultiplier += 0.5; // +50% efficiency
        }
        if (this.state.upgrades.minerEfficiency2) {
            efficiencyMultiplier += 1.0; // +100% efficiency (total +150% with tier 1)
        }
        
        // Apply prestige bonuses
        if (this.state.prestigePoints > 0) {
            const prestigeBonus = this.state.prestigePoints * 0.1; // 10% bonus per prestige point
            efficiencyMultiplier += prestigeBonus;
        }
        
        return baseProduction * efficiencyMultiplier;
    }
    
    getMinerEfficiency() {
        let efficiency = 1.0;
        
        if (this.state && this.state.upgrades.minerEfficiency1) {
            efficiency += 0.5;
        }
        if (this.state && this.state.upgrades.minerEfficiency2) {
            efficiency += 1.0;
        }
        if (this.state && this.state.prestigePoints > 0) {
            efficiency += this.state.prestigePoints * 0.1;
        }
        
        return efficiency;
    }
    
    getHousingEfficiency() {
        let efficiency = 1.0;
        
        if (this.state && this.state.upgrades.housingUpgrade1) {
            efficiency *= 2.0;
        }
        if (this.state && this.state.upgrades.housingUpgrade2) {
            efficiency *= 1.5; // Total 3x with both upgrades
        }
        
        return efficiency;
    }
    
    // Resource status
    getResourceStatus() {
        if (!this.state) {
            return {
                stone: 0,
                stonePerSecond: 0,
                miners: 0,
                housing: 0,
                housingCapacity: 0,
                maxHousingCapacity: 0,
                minerEfficiency: 1.0,
                housingEfficiency: 1.0,
                canHireMiner: false
            };
        }
        
        return {
            stone: this.state.stone,
            stonePerSecond: this.calculateStoneProduction(),
            miners: this.state.miners,
            housing: this.state.housing,
            housingCapacity: this.state.housingCapacity,
            maxHousingCapacity: this.getMaxHousingCapacity(),
            minerEfficiency: this.getMinerEfficiency(),
            housingEfficiency: this.getHousingEfficiency(),
            canHireMiner: this.canHireMiner()
        };
    }
    
    // Optimization suggestions
    getOptimizationSuggestions() {
        if (!this.state) return [];
        
        const suggestions = [];
        
        // Housing optimization
        if (this.state.miners >= this.getMaxHousingCapacity() * 0.8) {
            suggestions.push({
                type: 'housing',
                message: 'Consider building more housing to hire additional miners',
                priority: 'high'
            });
        }
        
        // Miner efficiency upgrades
        if (this.state.miners >= 5 && !this.state.upgrades.minerEfficiency1) {
            suggestions.push({
                type: 'upgrade',
                message: 'Miner Efficiency I upgrade would boost your production significantly',
                priority: 'medium'
            });
        }
        
        // Housing efficiency upgrades
        if (this.state.housingCapacity >= 50 && !this.state.upgrades.housingUpgrade1) {
            suggestions.push({
                type: 'upgrade',
                message: 'Housing Efficiency upgrades would let you hire more miners per housing unit',
                priority: 'medium'
            });
        }
        
        return suggestions;
    }
    
    // Debug and statistics
    getDetailedStats() {
        if (!this.state) return {};
        
        return {
            miners: {
                count: this.state.miners,
                cost: this.getMinerCost(),
                efficiency: this.getMinerEfficiency(),
                canHire: this.canHireMiner()
            },
            housing: {
                used: this.state.housing,
                capacity: this.state.housingCapacity,
                maxCapacity: this.getMaxHousingCapacity(),
                efficiency: this.getHousingEfficiency(),
                cost: this.getHousingCost()
            },
            production: {
                basePerMiner: this.baseStonePerMiner,
                totalPerSecond: this.calculateStoneProduction(),
                efficiencyBonus: (this.getMinerEfficiency() - 1) * 100
            },
            upgrades: {
                minerEfficiency1: this.state.upgrades.minerEfficiency1,
                minerEfficiency2: this.state.upgrades.minerEfficiency2,
                housingUpgrade1: this.state.upgrades.housingUpgrade1,
                housingUpgrade2: this.state.upgrades.housingUpgrade2
            }
        };
    }
    
    // Simulation methods (useful for planning)
    simulateHireMiners(count) {
        if (!this.state) return null;
        
        const results = {
            possible: 0,
            totalCost: 0,
            newProduction: 0,
            housingNeeded: 0
        };
        
        let currentHousing = this.state.housing;
        let maxCapacity = this.getMaxHousingCapacity();
        
        for (let i = 0; i < count; i++) {
            if (currentHousing < maxCapacity) {
                results.possible++;
                results.totalCost += this.getMinerCost();
                currentHousing++;
            } else {
                break;
            }
        }
        
        results.newProduction = results.possible * this.baseStonePerMiner * this.getMinerEfficiency();
        results.housingNeeded = Math.max(0, (this.state.miners + results.possible) - maxCapacity);
        
        return results;
    }
    
    simulateBuyHousing(units) {
        if (!this.state) return null;
        
        const totalCost = units * this.getHousingCost();
        const newCapacity = units * this.housingCapacityPerUnit;
        const maxCapacity = this.getMaxHousingCapacity() + (newCapacity * this.getHousingEfficiency());
        
        return {
            totalCost,
            newCapacity,
            maxCapacity,
            canAfford: this.state.stone >= totalCost
        };
    }
}

// Export for use in other modules
window.ResourceManager = ResourceManager;