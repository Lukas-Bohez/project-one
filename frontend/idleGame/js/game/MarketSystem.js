/**
 * MarketSystem.js - Handles marketers and sell multiplier calculations
 * Manages the three tiers of marketers and stone selling mechanics
 */

class MarketSystem {
    constructor() {
        this.state = null;
        
        // Define marketer tiers with their properties
        this.marketerTiers = {
            basic: {
                name: 'Basic Marketer',
                cost: 100,
                multiplierBonus: 0.1,
                description: '+0.1x sell multiplier'
            },
            advanced: {
                name: 'Advanced Marketer',
                cost: 500,
                multiplierBonus: 0.5,
                description: '+0.5x sell multiplier'
            },
            expert: {
                name: 'Expert Marketer',
                cost: 2000,
                multiplierBonus: 2.0,
                description: '+2.0x sell multiplier'
            }
        };
        
        this.baseStoneValue = 1; // Base gold value per stone
    }
    
    setState(gameState) {
        this.state = gameState;
    }
    
    // Marketer management
    getMarketerCost(tier) {
        const marketerTier = this.marketerTiers[tier];
        return marketerTier ? marketerTier.cost : 0;
    }
    
    getMarketerInfo(tier) {
        return this.marketerTiers[tier] || null;
    }
    
    canHireMarketer(tier) {
        if (!this.state) return false;
        
        const cost = this.getMarketerCost(tier);
        return this.state.stone >= cost;
    }
    
    hireMarketer(tier) {
        if (!this.canHireMarketer(tier)) return false;
        
        const cost = this.getMarketerCost(tier);
        const marketerInfo = this.getMarketerInfo(tier);
        
        if (!marketerInfo) return false;
        
        // Deduct cost and hire marketer
        this.state.stone -= cost;
        
        switch (tier) {
            case 'basic':
                this.state.basicMarketers += 1;
                break;
            case 'advanced':
                this.state.advancedMarketers += 1;
                break;
            case 'expert':
                this.state.expertMarketers += 1;
                break;
        }
        
        console.log(`Hired ${marketerInfo.name}. New sell multiplier: ${this.calculateSellMultiplier().toFixed(1)}x`);
        return true;
    }
    
    // Sell multiplier calculation
    calculateSellMultiplier() {
        if (!this.state) return 1.0;
        
        let multiplier = 1.0;
        
        // Add bonuses from each marketer type
        multiplier += this.state.basicMarketers * this.marketerTiers.basic.multiplierBonus;
        multiplier += this.state.advancedMarketers * this.marketerTiers.advanced.multiplierBonus;
        multiplier += this.state.expertMarketers * this.marketerTiers.expert.multiplierBonus;
        
        // Apply upgrade bonuses
        if (this.state.upgrades && this.state.upgrades.marketBonus1) {
            multiplier += 0.5; // +50% global sell multiplier
        }
        
        // Apply prestige bonuses
        if (this.state.prestigePoints > 0) {
            const prestigeBonus = this.state.prestigePoints * 0.05; // 5% bonus per prestige point
            multiplier += prestigeBonus;
        }
        
        return multiplier;
    }
    
    // Stone selling
    getStoneValue(amount = 1) {
        const multiplier = this.calculateSellMultiplier();
        return amount * this.baseStoneValue * multiplier;
    }
    
    sellStone(amount) {
        if (!this.state || amount <= 0 || this.state.stone < amount) return 0;
        
        const goldEarned = this.getStoneValue(amount);
        
        // Note: The actual stone deduction is handled by the caller (GameEngine)
        // This method just calculates and returns the gold value
        
        return goldEarned;
    }
    
    sellAllStone() {
        if (!this.state) return 0;
        
        const amount = Math.floor(this.state.stone);
        return this.sellStone(amount);
    }
    
    // Market analysis and statistics
    getMarketStats() {
        if (!this.state) {
            return {
                totalMarketers: 0,
                sellMultiplier: 1.0,
                stoneValue: 1.0,
                marketersBreakdown: {
                    basic: 0,
                    advanced: 0,
                    expert: 0
                },
                totalInvestment: 0,
                averageROI: 0
            };
        }
        
        const totalMarketers = this.state.basicMarketers + this.state.advancedMarketers + this.state.expertMarketers;
        const sellMultiplier = this.calculateSellMultiplier();
        const stoneValue = this.getStoneValue(1);
        
        // Calculate total investment in marketers
        const totalInvestment = 
            (this.state.basicMarketers * this.marketerTiers.basic.cost) +
            (this.state.advancedMarketers * this.marketerTiers.advanced.cost) +
            (this.state.expertMarketers * this.marketerTiers.expert.cost);
        
        // Calculate average ROI (simplified)
        const bonusMultiplier = sellMultiplier - 1.0;
        const averageROI = totalInvestment > 0 ? bonusMultiplier / totalInvestment : 0;
        
        return {
            totalMarketers,
            sellMultiplier,
            stoneValue,
            marketersBreakdown: {
                basic: this.state.basicMarketers,
                advanced: this.state.advancedMarketers,
                expert: this.state.expertMarketers
            },
            totalInvestment,
            averageROI
        };
    }
    
    // Marketer recommendations
    getMarketerRecommendations() {
        if (!this.state) return [];
        
        const recommendations = [];
        const currentMultiplier = this.calculateSellMultiplier();
        
        // Analyze cost-effectiveness of each marketer tier
        Object.keys(this.marketerTiers).forEach(tier => {
            const marketerInfo = this.marketerTiers[tier];
            const canAfford = this.canHireMarketer(tier);
            
            // Calculate efficiency (multiplier bonus per cost)
            const efficiency = marketerInfo.multiplierBonus / marketerInfo.cost;
            
            let priority = 'low';
            let reason = `${marketerInfo.description} - Cost: ${marketerInfo.cost} stone`;
            
            // Determine priority based on efficiency and current state
            if (tier === 'basic' && this.state.basicMarketers < 3) {
                priority = 'high';
                reason = 'Basic marketers are very cost-effective early on';
            } else if (tier === 'advanced' && this.state.basicMarketers >= 2 && this.state.advancedMarketers < 2) {
                priority = 'medium';
                reason = 'Advanced marketers provide good value once you have some basics';
            } else if (tier === 'expert' && this.state.totalStoneSold > 50000) {
                priority = 'medium';
                reason = 'Expert marketers are worth it for high-volume selling';
            }
            
            if (canAfford) {
                recommendations.push({
                    tier,
                    ...marketerInfo,
                    efficiency,
                    priority,
                    reason,
                    canAfford: true
                });
            } else {
                recommendations.push({
                    tier,
                    ...marketerInfo,
                    efficiency,
                    priority: 'low',
                    reason: `Save up ${marketerInfo.cost - this.state.stone} more stone`,
                    canAfford: false
                });
            }
        });
        
        // Sort by priority and efficiency
        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            
            if (priorityDiff !== 0) return priorityDiff;
            return b.efficiency - a.efficiency; // Higher efficiency first
        });
    }
    
    // Calculate optimal marketer distribution
    getOptimalMarketerDistribution(budget) {
        if (budget <= 0) return { basic: 0, advanced: 0, expert: 0, totalCost: 0, totalBonus: 0 };
        
        // Simple greedy algorithm: buy the most efficient marketer that fits the budget
        const distribution = { basic: 0, advanced: 0, expert: 0 };
        let remainingBudget = budget;
        let totalBonus = 0;
        
        // Calculate efficiency for each tier
        const efficiencies = Object.keys(this.marketerTiers).map(tier => ({
            tier,
            efficiency: this.marketerTiers[tier].multiplierBonus / this.marketerTiers[tier].cost,
            cost: this.marketerTiers[tier].cost,
            bonus: this.marketerTiers[tier].multiplierBonus
        })).sort((a, b) => b.efficiency - a.efficiency);
        
        // Greedy allocation
        while (remainingBudget > 0) {
            let purchased = false;
            
            for (const marketer of efficiencies) {
                if (remainingBudget >= marketer.cost) {
                    distribution[marketer.tier]++;
                    remainingBudget -= marketer.cost;
                    totalBonus += marketer.bonus;
                    purchased = true;
                    break;
                }
            }
            
            if (!purchased) break; // Can't afford any more marketers
        }
        
        return {
            ...distribution,
            totalCost: budget - remainingBudget,
            totalBonus,
            remainingBudget
        };
    }
    
    // Market simulation
    simulateMarketGrowth(timeHours, sellRatePerHour) {
        if (!this.state) return null;
        
        const currentMultiplier = this.calculateSellMultiplier();
        const stoneValuePerHour = sellRatePerHour * currentMultiplier;
        const totalGoldOver = stoneValuePerHour * timeHours;
        
        return {
            timeHours,
            sellRatePerHour,
            currentMultiplier,
            stoneValuePerHour,
            totalGoldOverTime: totalGoldOver,
            averagePerHour: totalGoldOver / timeHours
        };
    }
    
    // Get detailed marketer information
    getDetailedMarketerInfo() {
        if (!this.state) return {};
        
        const info = {};
        
        Object.keys(this.marketerTiers).forEach(tier => {
            const marketerInfo = this.marketerTiers[tier];
            const currentCount = this.state[`${tier}Marketers`] || 0;
            const totalContribution = currentCount * marketerInfo.multiplierBonus;
            
            info[tier] = {
                ...marketerInfo,
                currentCount,
                totalContribution,
                canAfford: this.canHireMarketer(tier),
                efficiency: marketerInfo.multiplierBonus / marketerInfo.cost,
                nextImpact: marketerInfo.multiplierBonus // How much the next hire would add
            };
        });
        
        return info;
    }
    
    // Reset marketers (for prestige)
    resetMarketers() {
        if (!this.state) return;
        
        this.state.basicMarketers = 0;
        this.state.advancedMarketers = 0;
        this.state.expertMarketers = 0;
        this.state.sellMultiplier = 1.0;
        
        console.log('All marketers reset');
    }
}

// Export for use in other modules
window.MarketSystem = MarketSystem;