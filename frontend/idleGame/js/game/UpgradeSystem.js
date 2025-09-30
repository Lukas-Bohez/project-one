/**
 * UpgradeSystem.js - Handles upgrade purchases and effects
 * Manages all upgrades that improve efficiency and unlock new features
 */

class UpgradeSystem {
    constructor() {
        this.state = null;
        
        // Define all upgrades with their properties
        this.upgrades = {
            minerEfficiency1: {
                name: 'Miner Efficiency I',
                cost: 200,
                description: '+50% miner production',
                effect: 'production',
                value: 0.5,
                prerequisite: null
            },
            minerEfficiency2: {
                name: 'Miner Efficiency II',
                cost: 1000,
                description: '+100% miner production',
                effect: 'production',
                value: 1.0,
                prerequisite: 'minerEfficiency1'
            },
            housingUpgrade1: {
                name: 'Housing Efficiency I',
                cost: 500,
                description: '2 miners per housing unit',
                effect: 'housing',
                value: 2.0,
                prerequisite: null
            },
            housingUpgrade2: {
                name: 'Housing Efficiency II',
                cost: 2500,
                description: '3 miners per housing unit',
                effect: 'housing',
                value: 1.5, // Applied after housingUpgrade1, so 2 * 1.5 = 3
                prerequisite: 'housingUpgrade1'
            },
            autoSell1: {
                name: 'Auto-Sell I',
                cost: 1000,
                description: 'Automatically sells 10% of stone production',
                effect: 'automation',
                value: 0.1,
                prerequisite: null
            },
            marketBonus1: {
                name: 'Market Bonus I',
                cost: 5000,
                description: '+50% global sell multiplier',
                effect: 'market',
                value: 0.5,
                prerequisite: null
            }
        };
    }
    
    setState(gameState) {
        this.state = gameState;
    }
    
    getUpgrade(upgradeKey) {
        return this.upgrades[upgradeKey] || null;
    }
    
    getUpgradeCost(upgradeKey) {
        const upgrade = this.getUpgrade(upgradeKey);
        return upgrade ? upgrade.cost : 0;
    }
    
    canPurchaseUpgrade(upgradeKey) {
        if (!this.state) return false;
        
        const upgrade = this.getUpgrade(upgradeKey);
        if (!upgrade) return false;
        
        // Check if already purchased
        if (this.state.upgrades[upgradeKey]) return false;
        
        // Check if can afford
        if (this.state.stone < upgrade.cost) return false;
        
        // Check prerequisites
        if (upgrade.prerequisite && !this.state.upgrades[upgrade.prerequisite]) {
            return false;
        }
        
        return true;
    }
    
    purchaseUpgrade(upgradeKey) {
        if (!this.canPurchaseUpgrade(upgradeKey)) return false;
        
        const upgrade = this.getUpgrade(upgradeKey);
        if (!upgrade) return false;
        
        // Deduct cost and mark as purchased
        this.state.stone -= upgrade.cost;
        this.state.upgrades[upgradeKey] = true;
        
        console.log(`Purchased upgrade: ${upgrade.name}`);
        
        // Apply any immediate effects
        this.applyUpgradeEffect(upgradeKey, upgrade);
        
        return true;
    }
    
    applyUpgradeEffect(upgradeKey, upgrade) {
        if (!this.state || !upgrade) return;
        
        switch (upgrade.effect) {
            case 'production':
                // Production bonuses are applied in ResourceManager
                console.log(`Production boost applied: ${upgrade.description}`);
                break;
                
            case 'housing':
                // Housing bonuses are applied in ResourceManager
                console.log(`Housing efficiency improved: ${upgrade.description}`);
                break;
                
            case 'automation':
                console.log(`Automation enabled: ${upgrade.description}`);
                break;
                
            case 'market':
                console.log(`Market bonus applied: ${upgrade.description}`);
                break;
        }
    }
    
    // Get all available upgrades (not purchased and prerequisites met)
    getAvailableUpgrades() {
        if (!this.state) return [];
        
        const available = [];
        
        Object.keys(this.upgrades).forEach(key => {
            const upgrade = this.upgrades[key];
            
            if (!this.state.upgrades[key]) { // Not purchased
                let canShow = true;
                
                // Check prerequisites
                if (upgrade.prerequisite && !this.state.upgrades[upgrade.prerequisite]) {
                    canShow = false;
                }
                
                if (canShow) {
                    available.push({
                        key,
                        ...upgrade,
                        canAfford: this.state.stone >= upgrade.cost
                    });
                }
            }
        });
        
        return available.sort((a, b) => a.cost - b.cost);
    }
    
    // Get all purchased upgrades
    getPurchasedUpgrades() {
        if (!this.state) return [];
        
        const purchased = [];
        
        Object.keys(this.state.upgrades).forEach(key => {
            if (this.state.upgrades[key] && this.upgrades[key]) {
                purchased.push({
                    key,
                    ...this.upgrades[key]
                });
            }
        });
        
        return purchased;
    }
    
    // Calculate total upgrade bonuses
    getUpgradeBonuses() {
        if (!this.state) {
            return {
                productionMultiplier: 1.0,
                housingMultiplier: 1.0,
                marketMultiplier: 1.0,
                hasAutoSell: false
            };
        }
        
        let productionMultiplier = 1.0;
        let housingMultiplier = 1.0;
        let marketMultiplier = 1.0;
        let hasAutoSell = false;
        
        // Production bonuses
        if (this.state.upgrades.minerEfficiency1) {
            productionMultiplier += 0.5;
        }
        if (this.state.upgrades.minerEfficiency2) {
            productionMultiplier += 1.0;
        }
        
        // Housing bonuses
        if (this.state.upgrades.housingUpgrade1) {
            housingMultiplier *= 2.0;
        }
        if (this.state.upgrades.housingUpgrade2) {
            housingMultiplier *= 1.5;
        }
        
        // Market bonuses
        if (this.state.upgrades.marketBonus1) {
            marketMultiplier += 0.5;
        }
        
        // Automation
        if (this.state.upgrades.autoSell1) {
            hasAutoSell = true;
        }
        
        return {
            productionMultiplier,
            housingMultiplier,
            marketMultiplier,
            hasAutoSell
        };
    }
    
    // Get upgrade recommendations based on current state
    getUpgradeRecommendations() {
        if (!this.state) return [];
        
        const recommendations = [];
        const available = this.getAvailableUpgrades();
        
        // Early game recommendations
        if (this.state.miners >= 3 && !this.state.upgrades.minerEfficiency1) {
            const upgrade = available.find(u => u.key === 'minerEfficiency1');
            if (upgrade) {
                recommendations.push({
                    ...upgrade,
                    priority: 'high',
                    reason: 'Major production boost for your current miner count'
                });
            }
        }
        
        // Housing recommendations
        if (this.state.housingCapacity >= 30 && !this.state.upgrades.housingUpgrade1) {
            const upgrade = available.find(u => u.key === 'housingUpgrade1');
            if (upgrade) {
                recommendations.push({
                    ...upgrade,
                    priority: 'medium',
                    reason: 'Double your housing efficiency'
                });
            }
        }
        
        // Automation recommendations
        if (this.state.stonePerSecond >= 5 && !this.state.upgrades.autoSell1) {
            const upgrade = available.find(u => u.key === 'autoSell1');
            if (upgrade) {
                recommendations.push({
                    ...upgrade,
                    priority: 'medium',
                    reason: 'Automate stone selling for passive income'
                });
            }
        }
        
        // Mid-game recommendations
        if (this.state.upgrades.minerEfficiency1 && !this.state.upgrades.minerEfficiency2) {
            const upgrade = available.find(u => u.key === 'minerEfficiency2');
            if (upgrade && upgrade.canAfford) {
                recommendations.push({
                    ...upgrade,
                    priority: 'high',
                    reason: 'Massive production boost - doubles your efficiency'
                });
            }
        }
        
        // Market recommendations
        if (this.state.basicMarketers >= 2 && !this.state.upgrades.marketBonus1) {
            const upgrade = available.find(u => u.key === 'marketBonus1');
            if (upgrade) {
                recommendations.push({
                    ...upgrade,
                    priority: 'medium',
                    reason: 'Boost all your marketer bonuses'
                });
            }
        }
        
        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }
    
    // Calculate ROI (Return on Investment) for upgrades
    calculateUpgradeROI(upgradeKey) {
        if (!this.state) return 0;
        
        const upgrade = this.getUpgrade(upgradeKey);
        if (!upgrade) return 0;
        
        let roi = 0;
        
        switch (upgrade.effect) {
            case 'production':
                // Calculate how much extra production this upgrade provides
                const currentProduction = this.state.stonePerSecond || 1;
                const extraProduction = currentProduction * upgrade.value;
                
                // ROI = extra production per second / cost
                roi = extraProduction / upgrade.cost;
                break;
                
            case 'housing':
                // Housing ROI depends on current housing shortage
                const currentHousingUsage = this.state.miners / (this.state.housingCapacity || 1);
                if (currentHousingUsage > 0.8) {
                    roi = 0.5; // High ROI if housing is a bottleneck
                } else {
                    roi = 0.1; // Lower ROI if housing isn't needed yet
                }
                break;
                
            case 'automation':
                roi = 0.3; // Fixed moderate ROI for quality of life
                break;
                
            case 'market':
                // Market ROI depends on how much stone is being sold
                const sellRate = this.state.totalStoneSold / (this.state.gameTime || 1);
                roi = (sellRate * upgrade.value) / upgrade.cost;
                break;
        }
        
        return roi;
    }
    
    // Get upgrade statistics
    getUpgradeStats() {
        if (!this.state) return {};
        
        const purchased = this.getPurchasedUpgrades();
        const available = this.getAvailableUpgrades();
        const totalSpent = purchased.reduce((sum, upgrade) => sum + upgrade.cost, 0);
        const bonuses = this.getUpgradeBonuses();
        
        return {
            totalUpgrades: Object.keys(this.upgrades).length,
            purchasedCount: purchased.length,
            availableCount: available.length,
            totalSpent,
            bonuses,
            nextRecommendation: this.getUpgradeRecommendations()[0] || null
        };
    }
    
    // Debug method to unlock all upgrades (for testing)
    unlockAllUpgrades() {
        if (!this.state) return;
        
        Object.keys(this.upgrades).forEach(key => {
            this.state.upgrades[key] = true;
        });
        
        console.log('All upgrades unlocked (debug mode)');
    }
    
    // Reset upgrades (for prestige)
    resetUpgrades() {
        if (!this.state) return;
        
        Object.keys(this.state.upgrades).forEach(key => {
            this.state.upgrades[key] = false;
        });
        
        console.log('All upgrades reset');
    }
}

// Export for use in other modules
window.UpgradeSystem = UpgradeSystem;