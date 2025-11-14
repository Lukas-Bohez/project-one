/**
 * RebirthRewards.js - Permanent upgrades and rewards from rebirthing
 * Makes rebirthing valuable with special bonuses and unlockables
 */

class RebirthRewards {
    constructor() {
        this.rebirthUpgrades = this.initializeUpgrades();
    }

    initializeUpgrades() {
        return {
            // Tier 1: Available at Rebirth 1+
            efficientGathering: {
                name: "Efficient Gathering",
                description: "+10% gathering speed per rebirth",
                minRebirths: 1,
                baseCost: 5,
                costGrowth: 2.0,
                maxLevel: 10,
                effect: (level) => ({ gatheringSpeed: 1 + (level * 0.1) })
            },
            quickCrafting: {
                name: "Quick Crafting",
                description: "+8% crafting speed per rebirth",
                minRebirths: 1,
                baseCost: 5,
                costGrowth: 2.0,
                maxLevel: 10,
                effect: (level) => ({ craftingSpeed: 1 + (level * 0.08) })
            },
            shrewdTrader: {
                name: "Shrewd Trader",
                description: "+5% selling price per level",
                minRebirths: 1,
                baseCost: 10,
                costGrowth: 2.2,
                maxLevel: 8,
                effect: (level) => ({ sellingBonus: 1 + (level * 0.05) })
            },
            
            // Tier 2: Available at Rebirth 2+
            masterCrafter: {
                name: "Master Crafter",
                description: "5% chance to craft 2x items",
                minRebirths: 2,
                baseCost: 20,
                costGrowth: 2.5,
                maxLevel: 5,
                effect: (level) => ({ doubleCraftChance: level * 0.05 })
            },
            luckyFind: {
                name: "Lucky Find",
                description: "3% chance to find 2x resources",
                minRebirths: 2,
                baseCost: 15,
                costGrowth: 2.5,
                maxLevel: 5,
                effect: (level) => ({ doubleGatherChance: level * 0.03 })
            },
            fastLearner: {
                name: "Fast Learner",
                description: "+15% worker efficiency per level",
                minRebirths: 2,
                baseCost: 25,
                costGrowth: 2.8,
                maxLevel: 6,
                effect: (level) => ({ workerEfficiency: 1 + (level * 0.15) })
            },
            
            // Tier 3: Available at Rebirth 3+
            bulkProduction: {
                name: "Bulk Production",
                description: "Auto-craft 2 items simultaneously",
                minRebirths: 3,
                baseCost: 50,
                costGrowth: 3.0,
                maxLevel: 3,
                effect: (level) => ({ extraAutoCrafts: level })
            },
            massTransport: {
                name: "Mass Transport",
                description: "+50% transport capacity per level",
                minRebirths: 3,
                baseCost: 40,
                costGrowth: 2.8,
                maxLevel: 5,
                effect: (level) => ({ transportCapacity: 1 + (level * 0.5) })
            },
            thriftyBuilder: {
                name: "Thrifty Builder",
                description: "-10% building costs per level",
                minRebirths: 3,
                baseCost: 35,
                costGrowth: 2.5,
                maxLevel: 5,
                effect: (level) => ({ buildingDiscount: 1 - (level * 0.1) })
            },
            
            // Tier 4: Available at Rebirth 4+
            goldenTouch: {
                name: "Golden Touch",
                description: "+25% gold earned from all sources",
                minRebirths: 4,
                baseCost: 100,
                costGrowth: 3.5,
                maxLevel: 4,
                effect: (level) => ({ goldMultiplier: 1 + (level * 0.25) })
            },
            empireBuilder: {
                name: "Empire Builder",
                description: "Start with 100 gold per rebirth level",
                minRebirths: 4,
                baseCost: 80,
                costGrowth: 3.0,
                maxLevel: 10,
                effect: (level) => ({ startingGold: level * 100 })
            },
            timeWarp: {
                name: "Time Warp",
                description: "Reduce cooldowns by 15% per level",
                minRebirths: 4,
                baseCost: 120,
                costGrowth: 3.8,
                maxLevel: 5,
                effect: (level) => ({ cooldownReduction: 1 - (level * 0.15) })
            },
            
            // Tier 5: Available at Rebirth 5+
            legendarySkill: {
                name: "Legendary Skill",
                description: "All efficiency bonuses +50%",
                minRebirths: 5,
                baseCost: 200,
                costGrowth: 4.0,
                maxLevel: 3,
                effect: (level) => ({ efficiencyBoost: 1 + (level * 0.5) })
            },
            instantCraft: {
                name: "Instant Craft",
                description: "10% chance to instantly complete crafting",
                minRebirths: 5,
                baseCost: 180,
                costGrowth: 4.2,
                maxLevel: 3,
                effect: (level) => ({ instantCraftChance: level * 0.1 })
            },
            decayResistance: {
                name: "Decay Resistance",
                description: "-20% decay accumulation per level",
                minRebirths: 5,
                baseCost: 150,
                costGrowth: 3.5,
                maxLevel: 4,
                effect: (level) => ({ decayReduction: 1 - (level * 0.2) })
            }
        };
    }

    // Calculate cost for a specific upgrade level
    getUpgradeCost(upgradeKey, currentLevel) {
        const upgrade = this.rebirthUpgrades[upgradeKey];
        if (!upgrade) return Infinity;
        
        // Exponential cost: baseCost * (costGrowth ^ currentLevel)
        return Math.floor(upgrade.baseCost * Math.pow(upgrade.costGrowth, currentLevel));
    }

    // Check if upgrade is available based on rebirth count
    isUpgradeAvailable(upgradeKey, rebirthCount) {
        const upgrade = this.rebirthUpgrades[upgradeKey];
        if (!upgrade) return false;
        return rebirthCount >= upgrade.minRebirths;
    }

    // Get all available upgrades for current rebirth count
    getAvailableUpgrades(rebirthCount) {
        return Object.entries(this.rebirthUpgrades)
            .filter(([key, upgrade]) => rebirthCount >= upgrade.minRebirths)
            .map(([key, upgrade]) => ({ key, ...upgrade }));
    }

    // Get upgrades by tier
    getUpgradesByTier(rebirthCount) {
        const tiers = {
            1: [], 2: [], 3: [], 4: [], 5: []
        };

        Object.entries(this.rebirthUpgrades).forEach(([key, upgrade]) => {
            if (rebirthCount >= upgrade.minRebirths) {
                const tier = upgrade.minRebirths;
                if (tier <= 5) {
                    tiers[tier].push({ key, ...upgrade });
                }
            }
        });

        return tiers;
    }

    // Apply all purchased upgrade effects
    getActiveEffects(purchasedUpgrades) {
        const effects = {
            gatheringSpeed: 1,
            craftingSpeed: 1,
            sellingBonus: 1,
            doubleCraftChance: 0,
            doubleGatherChance: 0,
            workerEfficiency: 1,
            extraAutoCrafts: 0,
            transportCapacity: 1,
            buildingDiscount: 1,
            goldMultiplier: 1,
            startingGold: 0,
            cooldownReduction: 1,
            efficiencyBoost: 1,
            instantCraftChance: 0,
            decayReduction: 1
        };

        Object.entries(purchasedUpgrades).forEach(([key, level]) => {
            const upgrade = this.rebirthUpgrades[key];
            if (upgrade && level > 0) {
                const upgradeEffects = upgrade.effect(level);
                Object.entries(upgradeEffects).forEach(([effectKey, value]) => {
                    // Multiplicative effects
                    if (['gatheringSpeed', 'craftingSpeed', 'sellingBonus', 'workerEfficiency', 
                         'transportCapacity', 'buildingDiscount', 'goldMultiplier', 'cooldownReduction',
                         'efficiencyBoost', 'decayReduction'].includes(effectKey)) {
                        effects[effectKey] *= value;
                    }
                    // Additive effects
                    else {
                        effects[effectKey] += value;
                    }
                });
            }
        });

        return effects;
    }

    // Get total rebirth power (sum of all rebirth bonuses)
    calculateRebirthPower(rebirthCount, purchasedUpgrades) {
        // Base power from rebirths (5% per rebirth for core stats)
        const basePower = rebirthCount * 0.05;
        
        // Bonus power from upgrades
        let upgradePower = 0;
        Object.entries(purchasedUpgrades).forEach(([key, level]) => {
            const upgrade = this.rebirthUpgrades[key];
            if (upgrade && level > 0) {
                // Each upgrade level adds power
                upgradePower += level * 0.1;
            }
        });

        return {
            basePower,
            upgradePower,
            totalPower: basePower + upgradePower,
            multiplier: 1 + basePower + upgradePower
        };
    }
}

// Export for use in other modules
window.RebirthRewards = RebirthRewards;
