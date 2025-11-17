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
            },
            
            // Tier 6: Available at Rebirth 6+
            arcadeMaster: {
                name: "Arcade Master",
                description: "+20% bonus from arcade games",
                minRebirths: 6,
                baseCost: 250,
                costGrowth: 4.5,
                maxLevel: 5,
                effect: (level) => ({ arcadeBonus: 1 + (level * 0.2) })
            },
            quantumEfficiency: {
                name: "Quantum Efficiency",
                description: "Workers produce 30% more",
                minRebirths: 6,
                baseCost: 300,
                costGrowth: 4.8,
                maxLevel: 4,
                effect: (level) => ({ quantumWorkerBonus: 1 + (level * 0.3) })
            },
            megaCrafter: {
                name: "Mega Crafter",
                description: "Craft 2 extra items per auto-craft cycle",
                minRebirths: 6,
                baseCost: 280,
                costGrowth: 4.5,
                maxLevel: 3,
                effect: (level) => ({ extraAutoCrafts: level * 2 })
            },
            
            // Tier 7: Available at Rebirth 7+
            ultimateGatherer: {
                name: "Ultimate Gatherer",
                description: "10% chance to gather 5x resources",
                minRebirths: 7,
                baseCost: 400,
                costGrowth: 5.0,
                maxLevel: 3,
                effect: (level) => ({ megaGatherChance: level * 0.1 })
            },
            cosmicMultiplier: {
                name: "Cosmic Multiplier",
                description: "+100% to all gold earnings",
                minRebirths: 7,
                baseCost: 500,
                costGrowth: 5.5,
                maxLevel: 3,
                effect: (level) => ({ goldMultiplier: 1 + (level * 1.0) })
            },
            voidResistance: {
                name: "Void Resistance",
                description: "Start with 50% decay filled",
                minRebirths: 7,
                baseCost: 350,
                costGrowth: 4.8,
                maxLevel: 5,
                effect: (level) => ({ startingDecay: level * 10 })
            },
            
            // Tier 8: Available at Rebirth 8+
            transcendence: {
                name: "Transcendence",
                description: "All multipliers increased by 75%",
                minRebirths: 8,
                baseCost: 800,
                costGrowth: 6.0,
                maxLevel: 2,
                effect: (level) => ({ transcendenceBonus: 1 + (level * 0.75) })
            },
            infiniteAutomation: {
                name: "Infinite Automation",
                description: "Automation speed 2x per level",
                minRebirths: 8,
                baseCost: 700,
                costGrowth: 5.8,
                maxLevel: 3,
                effect: (level) => ({ automationSpeedMultiplier: Math.pow(2, level) })
            },
            realityBender: {
                name: "Reality Bender",
                description: "50% chance items cost nothing",
                minRebirths: 8,
                baseCost: 900,
                costGrowth: 6.5,
                maxLevel: 2,
                effect: (level) => ({ freeCraftChance: level * 0.25 })
            },
            
            // Tier 9: Available at Rebirth 9+ (The Void)
            voidMastery: {
                name: "Void Mastery",
                description: "Reach the void faster (2x decay)",
                minRebirths: 9,
                baseCost: 1500,
                costGrowth: 7.0,
                maxLevel: 3,
                effect: (level) => ({ decayGeneration: 1 + (level * 1.0) })
            },
            omnipotence: {
                name: "Omnipotence",
                description: "All bonuses doubled",
                minRebirths: 9,
                baseCost: 2000,
                costGrowth: 8.0,
                maxLevel: 1,
                effect: (level) => ({ omnipotenceBonus: level > 0 ? 2 : 1 })
            },
            arcadeLegend: {
                name: "Arcade Legend",
                description: "Arcade time generates resources",
                minRebirths: 9,
                baseCost: 1800,
                costGrowth: 7.5,
                maxLevel: 5,
                effect: (level) => ({ arcadeResourceGen: level * 0.1 })
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

    // Get dynamic description showing current effect level
    getUpgradeDescription(upgradeKey, currentLevel) {
        const upgrade = this.rebirthUpgrades[upgradeKey];
        if (!upgrade) return '';
        
        const nextLevel = currentLevel + 1;
        const currentEffect = currentLevel > 0 ? upgrade.effect(currentLevel) : null;
        const nextEffect = upgrade.effect(nextLevel);
        
        // Generate description based on upgrade type
        switch(upgradeKey) {
            case 'efficientGathering':
                return currentLevel > 0 
                    ? `Currently: +${Math.round((currentEffect.gatheringSpeed - 1) * 100)}% gathering speed | Next: +${Math.round((nextEffect.gatheringSpeed - 1) * 100)}%`
                    : `+${Math.round((nextEffect.gatheringSpeed - 1) * 100)}% gathering speed per level`;
            case 'quickCrafting':
                return currentLevel > 0
                    ? `Currently: +${Math.round((currentEffect.craftingSpeed - 1) * 100)}% crafting speed | Next: +${Math.round((nextEffect.craftingSpeed - 1) * 100)}%`
                    : `+${Math.round((nextEffect.craftingSpeed - 1) * 100)}% crafting speed per level`;
            case 'shrewdTrader':
                return currentLevel > 0
                    ? `Currently: +${Math.round((currentEffect.sellingBonus - 1) * 100)}% selling price | Next: +${Math.round((nextEffect.sellingBonus - 1) * 100)}%`
                    : `+${Math.round((nextEffect.sellingBonus - 1) * 100)}% selling price per level`;
            case 'masterCrafter':
                return currentLevel > 0
                    ? `Currently: ${Math.round(currentEffect.doubleCraftChance * 100)}% chance to craft 2x | Next: ${Math.round(nextEffect.doubleCraftChance * 100)}%`
                    : `${Math.round(nextEffect.doubleCraftChance * 100)}% chance to craft 2x items per level`;
            case 'luckyFind':
                return currentLevel > 0
                    ? `Currently: ${Math.round(currentEffect.doubleGatherChance * 100)}% chance to find 2x | Next: ${Math.round(nextEffect.doubleGatherChance * 100)}%`
                    : `${Math.round(nextEffect.doubleGatherChance * 100)}% chance to find 2x resources per level`;
            case 'fastLearner':
                return currentLevel > 0
                    ? `Currently: +${Math.round((currentEffect.workerEfficiency - 1) * 100)}% worker efficiency | Next: +${Math.round((nextEffect.workerEfficiency - 1) * 100)}%`
                    : `+${Math.round((nextEffect.workerEfficiency - 1) * 100)}% worker efficiency per level`;
            case 'bulkProduction':
                return currentLevel > 0
                    ? `Currently: Auto-craft ${currentEffect.extraAutoCrafts} extra items | Next: ${nextEffect.extraAutoCrafts}`
                    : `Auto-craft ${nextEffect.extraAutoCrafts} items simultaneously per level`;
            case 'massTransport':
                return currentLevel > 0
                    ? `Currently: +${Math.round((currentEffect.transportCapacity - 1) * 100)}% transport capacity | Next: +${Math.round((nextEffect.transportCapacity - 1) * 100)}%`
                    : `+${Math.round((nextEffect.transportCapacity - 1) * 100)}% transport capacity per level`;
            case 'thriftyBuilder':
                return currentLevel > 0
                    ? `Currently: ${Math.round((1 - currentEffect.buildingDiscount) * 100)}% building discount | Next: ${Math.round((1 - nextEffect.buildingDiscount) * 100)}%`
                    : `${Math.round((1 - nextEffect.buildingDiscount) * 100)}% building discount per level`;
            case 'goldenTouch':
                return currentLevel > 0
                    ? `Currently: +${Math.round((currentEffect.goldMultiplier - 1) * 100)}% gold earned | Next: +${Math.round((nextEffect.goldMultiplier - 1) * 100)}%`
                    : `+${Math.round((nextEffect.goldMultiplier - 1) * 100)}% gold earned per level`;
            case 'empireBuilder':
                return currentLevel > 0
                    ? `Currently: Start with ${currentEffect.startingGold} gold | Next: ${nextEffect.startingGold}`
                    : `Start with ${nextEffect.startingGold} gold per level`;
            case 'timeWarp':
                return currentLevel > 0
                    ? `Currently: ${Math.round((1 - currentEffect.cooldownReduction) * 100)}% cooldown reduction | Next: ${Math.round((1 - nextEffect.cooldownReduction) * 100)}%`
                    : `${Math.round((1 - nextEffect.cooldownReduction) * 100)}% cooldown reduction per level`;
            case 'legendarySkill':
                return currentLevel > 0
                    ? `Currently: +${Math.round((currentEffect.efficiencyBoost - 1) * 100)}% all efficiency | Next: +${Math.round((nextEffect.efficiencyBoost - 1) * 100)}%`
                    : `+${Math.round((nextEffect.efficiencyBoost - 1) * 100)}% all efficiency per level`;
            case 'instantCraft':
                return currentLevel > 0
                    ? `Currently: ${Math.round(currentEffect.instantCraftChance * 100)}% instant craft | Next: ${Math.round(nextEffect.instantCraftChance * 100)}%`
                    : `${Math.round(nextEffect.instantCraftChance * 100)}% chance to instantly complete crafting per level`;
            case 'decayResistance':
                return currentLevel > 0
                    ? `Currently: ${Math.round((1 - currentEffect.decayReduction) * 100)}% less decay | Next: ${Math.round((1 - nextEffect.decayReduction) * 100)}%`
                    : `${Math.round((1 - nextEffect.decayReduction) * 100)}% less decay per level`;
            case 'arcadeMaster':
                return currentLevel > 0
                    ? `Currently: +${Math.round((currentEffect.arcadeBonus - 1) * 100)}% arcade rewards | Next: +${Math.round((nextEffect.arcadeBonus - 1) * 100)}%`
                    : `+${Math.round((nextEffect.arcadeBonus - 1) * 100)}% bonus from arcade games per level`;
            case 'quantumEfficiency':
                return currentLevel > 0
                    ? `Currently: Workers produce +${Math.round((currentEffect.quantumWorkerBonus - 1) * 100)}% more | Next: +${Math.round((nextEffect.quantumWorkerBonus - 1) * 100)}%`
                    : `Workers produce +${Math.round((nextEffect.quantumWorkerBonus - 1) * 100)}% more per level`;
            case 'megaCrafter':
                return currentLevel > 0
                    ? `Currently: Craft ${currentEffect.extraAutoCrafts} extra items | Next: ${nextEffect.extraAutoCrafts}`
                    : `Craft ${nextEffect.extraAutoCrafts} extra items per auto-craft cycle per level`;
            case 'ultimateGatherer':
                return currentLevel > 0
                    ? `Currently: ${Math.round(currentEffect.megaGatherChance * 100)}% chance for 5x resources | Next: ${Math.round(nextEffect.megaGatherChance * 100)}%`
                    : `${Math.round(nextEffect.megaGatherChance * 100)}% chance to gather 5x resources per level`;
            case 'cosmicMultiplier':
                return currentLevel > 0
                    ? `Currently: +${Math.round((currentEffect.goldMultiplier - 1) * 100)}% gold | Next: +${Math.round((nextEffect.goldMultiplier - 1) * 100)}%`
                    : `+${Math.round((nextEffect.goldMultiplier - 1) * 100)}% to all gold earnings per level`;
            case 'voidResistance':
                return currentLevel > 0
                    ? `Currently: Start with ${currentEffect.startingDecay}% decay | Next: ${nextEffect.startingDecay}%`
                    : `Start with ${nextEffect.startingDecay}% decay per level`;
            case 'transcendence':
                return currentLevel > 0
                    ? `Currently: +${Math.round((currentEffect.transcendenceBonus - 1) * 100)}% to all multipliers | Next: +${Math.round((nextEffect.transcendenceBonus - 1) * 100)}%`
                    : `+${Math.round((nextEffect.transcendenceBonus - 1) * 100)}% to all multipliers per level`;
            case 'infiniteAutomation':
                return currentLevel > 0
                    ? `Currently: ${currentEffect.automationSpeedMultiplier}x automation speed | Next: ${nextEffect.automationSpeedMultiplier}x`
                    : `${nextEffect.automationSpeedMultiplier}x automation speed per level`;
            case 'realityBender':
                return currentLevel > 0
                    ? `Currently: ${Math.round(currentEffect.freeCraftChance * 100)}% free craft chance | Next: ${Math.round(nextEffect.freeCraftChance * 100)}%`
                    : `${Math.round(nextEffect.freeCraftChance * 100)}% chance items cost nothing per level`;
            case 'voidMastery':
                return currentLevel > 0
                    ? `Currently: ${currentEffect.decayGeneration}x decay generation | Next: ${nextEffect.decayGeneration}x`
                    : `${nextEffect.decayGeneration}x decay generation per level`;
            case 'omnipotence':
                return currentLevel > 0
                    ? `All bonuses doubled (ACTIVE)`
                    : `All bonuses doubled`;
            case 'arcadeLegend':
                return currentLevel > 0
                    ? `Currently: ${Math.round(currentEffect.arcadeResourceGen * 100)}% resource gen | Next: ${Math.round(nextEffect.arcadeResourceGen * 100)}%`
                    : `Arcade time generates ${Math.round(nextEffect.arcadeResourceGen * 100)}% resources per level`;
            default:
                return upgrade.description;
        }
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
            1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: []
        };

        Object.entries(this.rebirthUpgrades).forEach(([key, upgrade]) => {
            if (rebirthCount >= upgrade.minRebirths) {
                const tier = upgrade.minRebirths;
                if (tier <= 9) {
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
            decayReduction: 1,
            // New tier 6-9 effects
            arcadeBonus: 1,
            quantumWorkerBonus: 1,
            megaGatherChance: 0,
            cosmicMultiplier: 1,
            startingDecay: 0,
            transcendenceBonus: 1,
            automationSpeedMultiplier: 1,
            freeCraftChance: 0,
            decayGeneration: 1,
            omnipotenceBonus: 1,
            arcadeResourceGen: 0
        };

        Object.entries(purchasedUpgrades).forEach(([key, level]) => {
            const upgrade = this.rebirthUpgrades[key];
            if (upgrade && level > 0) {
                const upgradeEffects = upgrade.effect(level);
                Object.entries(upgradeEffects).forEach(([effectKey, value]) => {
                    // Multiplicative effects
                    if (['gatheringSpeed', 'craftingSpeed', 'sellingBonus', 'workerEfficiency', 
                         'transportCapacity', 'buildingDiscount', 'goldMultiplier', 'cooldownReduction',
                         'efficiencyBoost', 'decayReduction', 'arcadeBonus', 'quantumWorkerBonus',
                         'cosmicMultiplier', 'transcendenceBonus', 'automationSpeedMultiplier',
                         'decayGeneration', 'omnipotenceBonus'].includes(effectKey)) {
                        effects[effectKey] *= value;
                    }
                    // Additive effects
                    else {
                        effects[effectKey] += value;
                    }
                });
            }
        });
        
        // Apply omnipotence bonus to all multiplicative effects if active
        if (effects.omnipotenceBonus > 1) {
            Object.keys(effects).forEach(key => {
                if (['gatheringSpeed', 'craftingSpeed', 'sellingBonus', 'workerEfficiency', 
                     'transportCapacity', 'goldMultiplier', 'efficiencyBoost', 'arcadeBonus',
                     'quantumWorkerBonus', 'cosmicMultiplier', 'transcendenceBonus', 
                     'automationSpeedMultiplier'].includes(key)) {
                    effects[key] *= effects.omnipotenceBonus;
                }
            });
        }

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
