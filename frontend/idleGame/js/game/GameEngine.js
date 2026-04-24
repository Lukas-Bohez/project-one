/**
 * GameEngine.js - Core game logic and state management
 * Handles the main game loop, state updates, and coordination between systems
 */

class GameEngine {
    constructor() {
        this.state = this.getInitialState();
        this.isRunning = false;
        this.tickRate = 60; // 60 FPS
        this.tickInterval = null;
        this.lastUpdate = Date.now();
        this.gameStartTime = Date.now();
        
        // Initialize subsystems
    this.resourceManager = null;
    this.newResourceManager = null;
        this.upgradeSystem = null;
        this.marketSystem = null;
        this.saveManager = null;
        
        // UI update throttling
        this.lastUIUpdate = 0;
        this.uiUpdateRate = 100; // Update UI every 100ms
        
        // Auto-save
        this.lastAutoSave = 0;
        this.autoSaveInterval = 30000; // Auto-save every 30 seconds
        // Auto systems timers
        this.nextAutoSellFinishedAt = 0;
    }
    
    getInitialState() {
        return {
            // Resources
            resources: {
                stone: 0,
                coal: 0,
                iron: 0,
                silver: 0,
                gold: 10 // Starting gold to buy first worker
            },
            // Advanced inventories
            factory: { raw: {}, processed: {}, finished: {} },
            cityInventory: { finished: {} },
            
            // Crafted items inventory
            crafted: {
                basic: 0,          // Deployable Apps (10 stone)
                intermediate: 0,   // SaaS Platforms (1 basic + 5 coal)
                advanced: 0,       // Enterprise Products (1 intermediate + 3 iron)
                premium: 0         // Unicorn Startups (1 advanced + 2 silver)
            },
            autoCraft: false,  // Auto-craft toggle
            autoTransport: {   // Auto-transport toggles per tier
                basic: false,
                intermediate: false,
                advanced: false,
                premium: false
            },
            
            // Resource production per second
            production: {
                stone: 0,
                coal: 0,
                iron: 0,
                silver: 0,
                gold: 0
            },
            
            // Workers
            workers: {
                stoneMiners: 0,
                coalMiners: 0,
                ironMiners: 0,
                silverMiners: 0
            },
            
            // Processing buildings
            processors: {
                // Legacy
                smelters: 0,    // Stone -> Coal / ore -> ingots
                forges: 0,      // Coal -> Iron
                refineries: 0,  // Oil -> fuel, ore -> ingots
                mints: 0,       // Silver/Gold processing
                // New buildings
                polishers: 0,
                cokers: 0,
                chemPlants: 0,
                chipFabs: 0,
                jewelers: 0,
                assemblies: 0,
                autoPlants: 0
            },
            
            // Market & Trade
            traders: {
                stoneTraders: 0,
                coalTraders: 0,
                metalTraders: 0
            },
            
            // Transport
            transport: {
                carts: 0,
                wagons: 0,
                trains: 0,
                capacity: 0,
                usage: 0,
                // Temporary penalties applied per-tick based on bottlenecks
                penaltyTrading: 1.0,
                penaltyProcessing: 1.0,
                // Transport cooldown timer
                lastTransportTime: 0
            },
            
            // City services
            city: {
                police: 0,
                banks: 0,
                markets: 0,
                universities: 0,
                salesDepartment: 0,  // Auto-sells finished goods (upgradable)
                miningAcademy: 0,    // Boosts resource gathering efficiency (upgradable)
                automationLab: 0,    // Boosts auto-craft speed (upgradable)
                corruption: 0,
                // Theft system
                theftRisk: 0,
                theftLosses: 0,
                theftProtection: 0,
                // Decay and rebirth system
                decay: 0,
                maxDecay: 100,
                rebirths: 0,
                // Tax system
                taxRate: 0.1, // 10% base tax on gold income
                politicians: 0
            },
            
            // Rebirth permanent upgrades
            rebirthUpgrades: {
                // Stores level of each permanent upgrade
                // Example: { efficientGathering: 2, quickCrafting: 1, ... }
            },
            
            // Research
            research: {
                mining: false,
                processing: false,
                automation: false,
                logistics: false,
                quantum: false
            },
            // New research unlock flags
            unlock_stone: true,
            unlock_coal: false,
            unlock_iron: false,
            unlock_silver: false,
            unlock_gold: false,
            unlock_oil: false,
            unlock_rubber: false,
            unlock_processing: false,
            unlock_electronics: false,
            unlock_jewelry: false,
            unlock_automotive: false,
            
            // Statistics
            stats: {
                totalResourcesMined: {
                    stone: 0,
                    coal: 0,
                    iron: 0,
                    silver: 0
                },
                totalGoldEarned: 0,
                totalGoldSpent: 0,
                // City stats
                totalTheftLosses: 0,
                totalTaxesPaid: 0
            },
            
            // Ad/Monetization system
            ads: {
                doubleResources: {
                    active: false,
                    endTime: 0,
                    cooldown: 0
                },
                goldBonus: {
                    cooldown: 0
                },
                efficiencyBoost: {
                    active: false,
                    endTime: 0,
                    cooldown: 0
                },
                convertResources: {
                    cooldown: 0
                },
                watchedAdBoost: {
                    active: false,
                    endTime: 0,
                    cooldown: 0
                }
            },
            watchedAdCooldown: 0,
            
            // Efficiency multipliers
            efficiency: {
                mining: 1.0,
                processing: 1.0,
                trading: 1.0,
                transport: 1.0,
                global: 1.0
            },
            
            // Arcade system
            arcade: {
                unlockedGames: ['doom', 'digger', 'commander', 'prince'], // All unlocked for playtesting
                playTime: {},
                highScores: {},
                totalPlayTime: 0,
                activeGame: null,
                gameStartTime: null
            },
            
            // Game time
            gameTime: 0,
            offlineTime: 0,
            lastSave: Date.now(),

            // Random events system
            events: {
                lastEventTime: 0,
                activeEvent: null,
                eventEndTime: 0,
                eventsTriggered: 0
            },

            // Achievements / milestones
            achievements: {}
        };
    }
    
    initialize(resourceManager, upgradeSystem, marketSystem) {
        this.resourceManager = resourceManager;
        this.upgradeSystem = upgradeSystem;
        this.marketSystem = marketSystem;
        
        // Set initial state references
        this.resourceManager.setState(this.state);
        this.upgradeSystem.setState(this.state);
        this.marketSystem.setState(this.state);
        
        console.log('Game Engine initialized');
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastUpdate = Date.now();
        this.gameStartTime = Date.now();
        
        // Initialize SaveManager
        if (window.SaveManager) {
            this.saveManager = new SaveManager(this);
            console.log('SaveManager initialized');
        }
        
        // Initialize UIManager
        // Auto systems timers
        this.nextAutoSellFinishedAt = 0; // Initialize nextAutoSellFinishedAt
        console.log('Checking for UIManager class:', typeof window.UIManager);
        if (window.UIManager) {
            console.log('Creating UIManager instance...');
            this.uiManager = new UIManager(this);
            console.log('UIManager initialized successfully');
        } else {
            console.error('UIManager class not found! Make sure js/ui/UIManager.js is loaded.');
        }
        
        // Initialize NewResourceManager
        if (window.NewResourceManager) {
            this.newResourceManager = new NewResourceManager(this.state);
            console.log('NewResourceManager initialized');
        }
        
        // Initialize Rebirth Theme System
        if (window.RebirthThemes) {
            this.rebirthThemes = new RebirthThemes();
            console.log('RebirthThemes initialized');
            
            // Connect theme system to resource manager
            if (this.newResourceManager) {
                this.newResourceManager.setRebirthThemes(this.rebirthThemes);
            }
            
            if (window.UIThemeManager) {
                this.themeManager = new UIThemeManager(this, this.rebirthThemes);
                // Apply initial theme
                this.themeManager.updateTheme();
                console.log('UIThemeManager initialized');
            }
        }
        
        // Initialize Rebirth Rewards System
        if (window.RebirthRewards) {
            this.rebirthRewards = new RebirthRewards();
            console.log('RebirthRewards initialized');
        }
        
        // Initialize Arcade Manager
        if (window.ArcadeManager) {
            this.arcadeManager = new ArcadeManager(this);
            console.log('ArcadeManager initialized');
        }

        // Start the main game loop
        this.tickInterval = setInterval(() => {
            this.tick();
        }, 1000 / this.tickRate);
        
        // Hide already purchased unlocks and research (with slight delay to ensure DOM is ready)
        setTimeout(() => {
            this.updatePurchasedItemsVisibility();
        }, 100);
        
        console.log('Game started');
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        
        console.log('Game stopped');
    }
    
    tick() {
        const now = Date.now();
        const deltaTime = (now - this.lastUpdate) / 1000; // Convert to seconds
        this.lastUpdate = now;
        
        // Update game time
        this.state.gameTime += deltaTime;
        
        // Update all systems
        this.updateResources(deltaTime);
        this.updateMarkets(deltaTime);
        this.updateUpgrades(deltaTime);
        this.updateAdCooldowns();
        this.updateAutoSellFinished(now);

        // Random events & achievements (every tick)
        this.checkRandomEvents(deltaTime);
        this.checkAchievements();
        
        // 🛡️ SAFETY: Ensure gold never goes negative during gameplay
        if (this.state.resources.gold < 0) {
            console.warn('⚠️ Gold went negative during tick:', this.state.resources.gold, '- fixing to 0');
            this.state.resources.gold = 0;
        }
        
        // Update UI periodically (not every tick for performance)
        if (now - this.lastUIUpdate > this.uiUpdateRate) {
            this.updateUI();
            this.updateIncomeIndicators();
            this.lastUIUpdate = now;
            
            // Update theme if needed (checks internally if theme changed)
            if (this.themeManager) {
                this.themeManager.updateTheme();
            }
        }
        
        // Auto-save periodically
        if (now - this.lastAutoSave > this.autoSaveInterval) {
            this.autoSave();
            this.lastAutoSave = now;
        }
    }

    updateAutoSellFinished(now) {
        if (!this.newResourceManager) return;
        const salesDept = this.state.city?.salesDepartment || 0;
        if (salesDept <= 0) return; // No sales department = no auto-sell
        
        // Sell all items periodically, with less time per level
        // Level 1: 60s, Level 2: 50s, Level 3: 40s, Level 4: 30s, Level 5: 20s, 
        // Level 6: 15s, Level 7: 10s, Level 8+: 5s
        const interval = Math.max(5000, 60000 - (salesDept - 1) * 10000);
        
        if (now < this.nextAutoSellFinishedAt) return;
        
        // Sell ALL items in city at once (cap per tick to prevent frame drops)
        const inv = this.state.cityInventory?.finished || {};
        let itemsSold = 0;
        const maxSellsPerTick = 1000;
        for (const k in inv) { 
            while (inv[k] > 0 && itemsSold < maxSellsPerTick) { 
                const success = this.sellOneFinished();
                if (!success) break;
                itemsSold++;
            }
        }
        
        if (itemsSold > 0) {
            this.showNotification(`🤖 Sales Bot sold ${itemsSold} items!`);
        }
        
        this.nextAutoSellFinishedAt = now + interval;
    }

    updateAutoTransport(deltaTime) {
        if (!this.newResourceManager) return;
        
        // Transport rate: based on transport capacity and efficiency
        // Higher capacity = faster transport
        const capacity = this.state.transport?.capacity || 0;
        if (capacity <= 0) return;
        
        // Transport rate: capacity units per second (e.g., 10 capacity = 10 items/sec)
        const transportRate = capacity * deltaTime;
        
        // Accumulate fractional transports
        this.transportAccumulator = (this.transportAccumulator || 0) + transportRate;
        
        // Get current theme item names
        const rebirths = this.state.city?.rebirths || 0;
        const theme = this.rebirthThemes?.getTheme(rebirths);
        const themeItemNames = {
            'basic': theme?.crafting?.basic?.result || 'Deployable App',
            'intermediate': theme?.crafting?.intermediate?.result || 'SaaS Platform',
            'advanced': theme?.crafting?.advanced?.result || 'Enterprise Product',
            'premium': theme?.crafting?.premium?.result || 'Unicorn Startup'
        };
        
        // Create reverse mapping
        const craftedItemsReverse = {};
        for (const [tier, itemName] of Object.entries(themeItemNames)) {
            craftedItemsReverse[itemName] = tier;
        }
        
        // Transport whole units (use actual capacity for weight checks)
        while (this.transportAccumulator >= 1) {
            const result = this.newResourceManager.transportOne(capacity, this.state.autoTransport);
            if (!result || result.moved === 0) break; // Nothing left to transport
            
            // If a crafted item was transported, decrease the crafted counter
            if (result.item && result.tier === 'finished') {
                const craftTier = craftedItemsReverse[result.item];
                if (craftTier) {
                    this.state.crafted[craftTier] = Math.max(0, (this.state.crafted[craftTier] || 0) - 1);
                }
            }
            
            // Deduct the weight of the item transported
            this.transportAccumulator -= (result.weight || 1);
        }
    }

    updateRDLabsEfficiency() {
        // R&D Labs provide efficiency boosts across the board
        // Each lab multiplies effect by 1.10x (10% increase, compounding)
        const labs = this.state.city.universities || 0;
        const baseEfficiency = 1.0;
        const rdBonus = Math.pow(1.10, labs) - 1; // Compound 10% per lab
        
        // Markets boost trading efficiency (15% per market, compounding)
        const markets = this.state.city.markets || 0;
        const marketBonus = Math.pow(1.15, markets) - 1; // Compound 15% per market
        
        // Politicians boost trading efficiency (5% per politician, compounding)
        const politicians = this.state.city.politicians || 0;
        const politicianBonus = Math.pow(1.05, politicians) - 1; // Compound 5% per politician
        
        // Calculate total global efficiency from all sources
        let globalEff = baseEfficiency + rdBonus;
        
        // Apply research bonuses if they exist
        if (this.state.research?.quantum) {
            globalEff *= 2.0; // Quantum research doubles everything
        }
        
        this.state.efficiency.global = globalEff;
        
        // R&D Labs, Markets, and Politicians all boost trading efficiency
        this.state.efficiency.trading = baseEfficiency + rdBonus + marketBonus + politicianBonus;
        if (this.state.research?.quantum) {
            this.state.efficiency.trading *= 2.0;
        }
    }

    updateResources(deltaTime) {
        // Update R&D Labs efficiency bonus
        this.updateRDLabsEfficiency();
        
        // Calculate base production from workers
        this.updateMiningProduction(deltaTime);
        
        // Update arcade manager (but don't apply bonuses to efficiency yet)
        if (this.arcadeManager) {
            this.arcadeManager.update(deltaTime);
        }
        
        // Update transport capacity usage early so penalties apply this tick
        this.updateTransport();
        
        // Calculate processing chain production
        this.updateProcessingProduction(deltaTime);

        // Advanced processing
        if (this.newResourceManager) {
            this.newResourceManager.update(deltaTime);
        }
        
        // Auto-crafting system
        this.tryAutoCraft();
        
        // Auto-transport crafted items from factory to city (for toggle buttons)
        this.tryAutoTransportCrafted();
        
        // Automatic transport of goods from factory to city
        this.updateAutoTransport(deltaTime);
        
        // Handle automatic trading (uses current transport penalties)
        this.updateAutomaticTrading(deltaTime);
        
        // Apply city services costs
        this.updateCityServices(deltaTime);

        // Handle city dynamics - theft, decay, taxes
        this.updateCityDynamics(deltaTime);
    }
    
    updateMiningProduction(deltaTime) {
        // Get rebirth upgrade effects
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { gatheringSpeed: 1, workerEfficiency: 1, quantumWorkerBonus: 1, doubleGatherChance: 0, megaGatherChance: 0, efficiencyBoost: 1, transcendenceBonus: 1 };
        
        // Get arcade bonuses
        const arcadeBonuses = (this.arcadeManager && this.arcadeManager.getArcadeBonuses) ? 
            this.arcadeManager.getArcadeBonuses() : 
            { resourceBonus: 1, efficiencyBonus: 1, goldBonus: 1, craftingBonus: 1 };
        
        // Base efficiency from global and mining
        let efficiency = this.state.efficiency.mining * this.state.efficiency.global;
        
        // Apply bonuses additively to avoid exponential growth
        // Convert multipliers to additive bonuses
        const gatheringBonus = (rebirthEffects.gatheringSpeed - 1);
        const workerBonus = (rebirthEffects.workerEfficiency - 1);
        const quantumBonus = (rebirthEffects.quantumWorkerBonus - 1);
        const efficiencyBonus = (rebirthEffects.efficiencyBoost - 1);
        const transcendenceBonus = (rebirthEffects.transcendenceBonus - 1);
        const arcadeBonus = (arcadeBonuses.resourceBonus - 1) + (arcadeBonuses.efficiencyBonus - 1);
        
        // Sum all bonuses and apply as a single multiplier
        const totalBonus = 1 + gatheringBonus + workerBonus + quantumBonus + efficiencyBonus + transcendenceBonus + arcadeBonus;
        efficiency *= totalBonus;
        
        // Apply Mining Academy bonus (15% compound per level)
        const miningAcademy = this.state.city.miningAcademy || 0;
        if (miningAcademy > 0) {
            efficiency *= Math.pow(1.15, miningAcademy);
        }
        
        // Apply ad bonuses
        if (this.state.ads.efficiencyBoost.active) {
            efficiency *= 1.5; // +50% from ad boost
        }
        
        // Apply watched ad boost (50% for 30 seconds with 5 minute cooldown)
        const now = Date.now();
        if (this.state.ads.watchedAdBoost && this.state.ads.watchedAdBoost.active && now < this.state.ads.watchedAdBoost.endTime) {
            efficiency *= 1.5; // +50% from watched ad boost
        } else if (this.state.ads.watchedAdBoost) {
            this.state.ads.watchedAdBoost.active = false;
        }
        
        // Helper function to apply gathering chance bonuses
        const applyGatherChance = (baseAmount) => {
            let amount = baseAmount;
            
            // Check for mega gather (5x)
            if (rebirthEffects.megaGatherChance > 0 && Math.random() < rebirthEffects.megaGatherChance) {
                amount *= 5;
            }
            // Otherwise check for double gather (2x)
            else if (rebirthEffects.doubleGatherChance > 0 && Math.random() < rebirthEffects.doubleGatherChance) {
                amount *= 2;
            }
            
            return amount;
        };
        
        // Event-based modifiers
        const activeEffect = this.getActiveEventEffect ? this.getActiveEventEffect() : null;
        let eventMiningMult = 1;
        if (activeEffect === 'miningBoost')    eventMiningMult = 1.5;
        if (activeEffect === 'miningPenalty')  eventMiningMult = 0.5;
        if (activeEffect === 'globalBoost')    eventMiningMult = 1.5;
        if (activeEffect === 'halfProduction') eventMiningMult = 0.5;

        // Stone mining
        let stoneProduced = this.state.workers.stoneMiners * efficiency * deltaTime * eventMiningMult;
        stoneProduced = applyGatherChance(stoneProduced);
        
        // Apply double resources bonus
        if (this.state.ads.doubleResources.active) {
            stoneProduced *= 2;
        }
        
        // Soft cap - diminishing returns near 10T
        stoneProduced *= this.softCapMultiplier(this.state.resources.stone);
        this.state.resources.stone += stoneProduced;
        this.state.stats.totalResourcesMined.stone += stoneProduced;
        this.state.production.stone = this.state.workers.stoneMiners * efficiency * eventMiningMult;
        
        // Coal mining (direct)
        let coalProduced = this.state.workers.coalMiners * efficiency * deltaTime * eventMiningMult;
        coalProduced = applyGatherChance(coalProduced);
        if (this.state.ads.doubleResources.active) coalProduced *= 2;
        coalProduced *= this.softCapMultiplier(this.state.resources.coal);
        this.state.resources.coal += coalProduced;
        this.state.stats.totalResourcesMined.coal += coalProduced;
        this.state.production.coal = this.state.workers.coalMiners * efficiency * eventMiningMult;
        
        // Iron mining (direct)
        let ironProduced = this.state.workers.ironMiners * efficiency * deltaTime * eventMiningMult;
        ironProduced = applyGatherChance(ironProduced);
        if (this.state.ads.doubleResources.active) ironProduced *= 2;
        ironProduced *= this.softCapMultiplier(this.state.resources.iron);
        this.state.resources.iron += ironProduced;
        this.state.stats.totalResourcesMined.iron += ironProduced;
        this.state.production.iron = this.state.workers.ironMiners * efficiency * eventMiningMult;
        
        // Silver mining (direct)
        let silverProduced = this.state.workers.silverMiners * efficiency * deltaTime * eventMiningMult;
        silverProduced = applyGatherChance(silverProduced);
        if (this.state.ads.doubleResources.active) silverProduced *= 2;
        silverProduced *= this.softCapMultiplier(this.state.resources.silver);
        this.state.resources.silver += silverProduced;
        this.state.stats.totalResourcesMined.silver += silverProduced;
        this.state.production.silver = this.state.workers.silverMiners * efficiency * eventMiningMult;
        
        // Arcade Legend: passive resource generation while playing arcade games
        if (arcadeBonuses.passiveGen && arcadeBonuses.passiveGen > 0) {
            const passiveRate = arcadeBonuses.passiveGen * deltaTime;
            this.state.resources.stone += passiveRate * (this.state.workers.stoneMiners || 1);
            this.state.resources.coal += passiveRate * (this.state.workers.coalMiners || 0);
            this.state.resources.iron += passiveRate * (this.state.workers.ironMiners || 0);
            this.state.resources.silver += passiveRate * (this.state.workers.silverMiners || 0);
        }
    }
    
    updateProcessingProduction(deltaTime) {
        // Apply per-tick transport penalty to processing efficiency
        const penaltyProcessing = (this.state.transport && this.state.transport.penaltyProcessing) ? this.state.transport.penaltyProcessing : 1.0;
        let efficiency = this.state.efficiency.processing * penaltyProcessing * this.state.efficiency.global;
        
        // Event-based modifiers for processing
        const activeEffect = this.getActiveEventEffect ? this.getActiveEventEffect() : null;
        if (activeEffect === 'globalBoost')    efficiency *= 1.5;
        if (activeEffect === 'halfProduction') efficiency *= 0.5;
        
        // Coal smelting: 2 stone -> 1 coal
        const smelterProduction = Math.min(
            this.state.processors.smelters * efficiency * deltaTime,
            this.state.resources.stone / 2
        );
        if (smelterProduction > 0) {
            this.state.resources.stone -= smelterProduction * 2;
            this.state.resources.coal += smelterProduction;
        }
        
        // Iron forging: 3 coal -> 1 iron
        const forgeProduction = Math.min(
            this.state.processors.forges * efficiency * deltaTime,
            this.state.resources.coal / 3
        );
        if (forgeProduction > 0) {
            this.state.resources.coal -= forgeProduction * 3;
            this.state.resources.iron += forgeProduction;
        }
        
        // Silver refining: 4 iron -> 1 silver
        const refineryProduction = Math.min(
            this.state.processors.refineries * efficiency * deltaTime,
            this.state.resources.iron / 4
        );
        if (refineryProduction > 0) {
            this.state.resources.iron -= refineryProduction * 4;
            this.state.resources.silver += refineryProduction;
        }
        
        // Gold minting: 5 silver -> 1 gold
        const mintProduction = Math.min(
            this.state.processors.mints * efficiency * deltaTime,
            this.state.resources.silver / 5
        );
        if (mintProduction > 0) {
            this.state.resources.silver -= mintProduction * 5;
            this.state.resources.gold += mintProduction;
            this.state.stats.totalGoldEarned += mintProduction;
        }
    }
    
    updateAutomaticTrading(deltaTime) {
        const corruption = Math.max(0, this.state.city.corruption - this.state.city.police * 5) / 100;
        // Apply transport penalty (from prior tick's usage calculation)
        const penaltyTrading = (this.state.transport && typeof this.state.transport.penaltyTrading === 'number') ? this.state.transport.penaltyTrading : 1.0;
        let efficiency = this.state.efficiency.trading * penaltyTrading * (1 - corruption) * this.state.efficiency.global;
        
        // Event-based modifiers for trading
        const activeEffect = this.getActiveEventEffect ? this.getActiveEventEffect() : null;
        if (activeEffect === 'globalBoost')    efficiency *= 1.5;
        if (activeEffect === 'halfProduction') efficiency *= 0.5;
        
        // Auto-sell stone
        const stoneToSell = Math.min(
            this.state.traders.stoneTraders * 2 * efficiency * deltaTime,
            this.state.resources.stone
        );
        if (stoneToSell > 0) {
            this.state.resources.stone -= stoneToSell;
            const goldEarned = stoneToSell * 0.1 * Math.pow(1.20, this.state.city.banks);
            this.state.resources.gold += goldEarned;
            this.state.stats.totalGoldEarned += goldEarned;
        }
        
        // Auto-sell coal
        const coalToSell = Math.min(
            this.state.traders.coalTraders * 1 * efficiency * deltaTime,
            this.state.resources.coal
        );
        if (coalToSell > 0) {
            this.state.resources.coal -= coalToSell;
            const goldEarned = coalToSell * 0.5 * Math.pow(1.20, this.state.city.banks);
            this.state.resources.gold += goldEarned;
            this.state.stats.totalGoldEarned += goldEarned;
        }
        
        // Auto-sell metals (iron & silver)
        const ironToSell = Math.min(
            this.state.traders.metalTraders * 0.5 * efficiency * deltaTime,
            this.state.resources.iron
        );
        if (ironToSell > 0) {
            this.state.resources.iron -= ironToSell;
            const goldEarned = ironToSell * 2 * Math.pow(1.20, this.state.city.banks);
            this.state.resources.gold += goldEarned;
            this.state.stats.totalGoldEarned += goldEarned;
        }
        
        const silverToSell = Math.min(
            this.state.traders.metalTraders * 0.3 * efficiency * deltaTime,
            this.state.resources.silver
        );
        if (silverToSell > 0) {
            this.state.resources.silver -= silverToSell;
            const goldEarned = silverToSell * 8 * Math.pow(1.20, this.state.city.banks);
            this.state.resources.gold += goldEarned;
            this.state.stats.totalGoldEarned += goldEarned;
        }
    }
    
    updateCityServices(deltaTime) {
        // Police cost gold per second but reduce corruption
        // Changed from 50 to 0.5 gold/sec (30 gold/min per police officer)
        const policeCost = this.state.city.police * 0.5 * deltaTime;
        if (this.state.resources.gold >= policeCost && policeCost > 0) {
            this.state.resources.gold -= policeCost;
            this.state.stats.totalGoldSpent += policeCost;
            this.state.city.corruption = Math.max(0, this.state.city.corruption - 1 * deltaTime);
        } else if (this.state.city.police > 0) {
            // Can't afford police, corruption increases
            this.state.city.corruption = Math.min(100, this.state.city.corruption + 2 * deltaTime);
        }
    }
    
    updateCityDynamics(deltaTime) {
        // Calculate city inventory value for theft risk
        let cityInventoryValue = 0;
        if (this.state.cityInventory && this.state.cityInventory.finished) {
            Object.keys(this.state.cityInventory.finished).forEach(item => {
                const amount = this.state.cityInventory.finished[item];
                const itemValue = this.newResourceManager ? 
                    (this.newResourceManager.catalog.finished[item]?.value || 0) : 0;
                cityInventoryValue += amount * itemValue;
            });
        }
        
        // Get rebirth upgrade effects
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { decayReduction: 1, decayGeneration: 1 };
        
        // City decay system - REDESIGNED
        // Decay is ONLY generated by Security Guards (police), NOT by passive city growth
        // This makes reaching 100% decay much harder and requires active investment
        
        // Only Security Guards generate decay (apply decay generation multiplier from rebirth upgrades)
        const decayGeneration = (this.state.city.police || 0) * 0.5 * rebirthEffects.decayGeneration; // Each guard generates 0.5 decay per second
        
        // Apply decay reduction from rebirth upgrades
        const adjustedDecayGeneration = decayGeneration * rebirthEffects.decayReduction;
        
        // Scale decay requirement with rebirths (each rebirth increases the challenge)
        const rebirthMultiplier = 1 + (this.state.city.rebirths * 0.5); // +50% per rebirth
        const adjustedMaxDecay = this.state.city.maxDecay * rebirthMultiplier;
        
        // Apply decay generation
        if (adjustedDecayGeneration > 0) {
            this.state.city.decay = Math.min(adjustedMaxDecay, 
                this.state.city.decay + adjustedDecayGeneration * deltaTime);
        }
        
        // Store adjusted max for UI display
        this.state.city.adjustedMaxDecay = adjustedMaxDecay;
        
        // Apply taxes on gold income (reduced by politicians)
        // Tax holiday event = no taxes
        const activeEffect = this.getActiveEventEffect ? this.getActiveEventEffect() : null;
        if (activeEffect === 'noTax') {
            this.lastGoldEarned = this.state.stats.totalGoldEarned;
            return; // Skip taxes entirely
        }
        const taxReduction = 1 - Math.pow(0.98, this.state.city.politicians); // 2% reduction per politician (compound)
        const effectiveTaxRate = Math.max(0, this.state.city.taxRate - taxReduction);
        
        // Track gold earned this tick for tax calculation
        const goldEarnedThisTick = this.state.stats.totalGoldEarned - (this.lastGoldEarned || 0);
        if (goldEarnedThisTick > 0 && effectiveTaxRate > 0) {
            const taxAmount = goldEarnedThisTick * effectiveTaxRate;
            // Only apply tax if we have enough gold (prevent going negative)
            if (this.state.resources.gold >= taxAmount) {
                this.state.resources.gold -= taxAmount;
                this.state.stats.totalTaxesPaid += taxAmount;
            } else {
                // Tax what we can without going negative
                const affordableTax = Math.max(0, this.state.resources.gold);
                this.state.resources.gold -= affordableTax;
                this.state.stats.totalTaxesPaid += affordableTax;
            }
        }
        this.lastGoldEarned = this.state.stats.totalGoldEarned;
    }
    
    updateTransport() {
        // Get rebirth upgrade effects for transport capacity
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { transportCapacity: 1 };
        
        // Calculate total transport capacity (reduced for better balance)
        const baseCapacity = 
            this.state.transport.carts * 1 +      // Was 10, now 1
            this.state.transport.wagons * 5 +     // Was 50, now 5
            this.state.transport.trains * 20;     // Was 200, now 20
        
        // Apply transport capacity multiplier from rebirth upgrades
        this.state.transport.capacity = baseCapacity * this.state.efficiency.transport * rebirthEffects.transportCapacity;
        
        // Estimate throughput demand based on current per-second production rates rather than stored stockpiles
        const totalProductionPerSec =
            (this.state.production.stone || 0) +
            (this.state.production.coal || 0) +
            (this.state.production.iron || 0) +
            (this.state.production.silver || 0);

        const usage = Math.min(100, (totalProductionPerSec / Math.max(1, this.state.transport.capacity)) * 100);
        this.state.transport.usage = usage;
        
        // Transport bottleneck reduces effective efficiency via penalties (non-compounding across ticks)
        // Reset to neutral each update
        this.state.transport.penaltyTrading = 1.0;
        this.state.transport.penaltyProcessing = 1.0;
        if (usage > 80) {
            // Linearly scale penalties between 80% and 100% usage
            const scale = Math.min(1, (usage - 80) / 20); // 0..1
            this.state.transport.penaltyTrading = 1 - 0.2 * scale;     // down to 0.8x at 100% usage
            this.state.transport.penaltyProcessing = 1 - 0.1 * scale;  // down to 0.9x at 100% usage
        }
    }
    
    updateMarkets(deltaTime) {
        if (!this.marketSystem) return;
        
        // Update sell multiplier based on marketers
        this.state.sellMultiplier = this.marketSystem.calculateSellMultiplier();
    }
    
    updateUpgrades(deltaTime) {
        if (!this.upgradeSystem) return;
        
        // Apply upgrade effects (handled in individual systems)
        // This could be expanded for time-based upgrades
    }
    
    updateUI() {
        // Check if we're at rebirth 10 - show ending screen only
        const rebirths = this.state.city?.rebirths || 0;
        const theme = this.rebirthThemes?.getTheme(rebirths);
        
        if (rebirths >= 10 && theme?.hideAllUI) {
            // Show ending screen
            const endingScreen = document.getElementById('ending-screen');
            if (endingScreen) endingScreen.style.display = 'flex';
            
            // Hide game container
            const gameContainer = document.getElementById('game-container');
            if (gameContainer) gameContainer.style.display = 'none';
            
            return; // Don't update any other UI
        } else {
            // Ensure ending screen is hidden
            const endingScreen = document.getElementById('ending-screen');
            if (endingScreen) endingScreen.style.display = 'none';
            
            // Ensure game container is visible
            const gameContainer = document.getElementById('game-container');
            if (gameContainer) gameContainer.style.display = 'block';
            
            // Hide golden reward at rebirths < 9
            if (rebirths < 9) {
                const goldenReward = document.getElementById('final-rebirth-reward');
                if (goldenReward) goldenReward.style.display = 'none';
            }
        }

        const campaign = this.getCampaignSnapshot(theme);
        this.updateCampaignUI(campaign);
        
        // Update resource display
        this.updateElement('stone-amount', this.formatNumber(this.state.resources.stone));
        this.updateElement('coal-amount', this.formatNumber(this.state.resources.coal));
        this.updateElement('iron-amount', this.formatNumber(this.state.resources.iron));
        this.updateElement('silver-amount', this.formatNumber(this.state.resources.silver));
        this.updateElement('gold-amount', this.formatNumber(this.state.resources.gold));
        
        // Update workforce status
        this.updateElement('stone-miners-count', this.state.workers.stoneMiners.toString());
        this.updateElement('coal-miners-count', this.state.workers.coalMiners.toString());
        this.updateElement('iron-miners-count', this.state.workers.ironMiners.toString());
        this.updateElement('silver-miners-count', this.state.workers.silverMiners.toString());
        
        // Update processing status
        this.updateElement('smelters-count', this.state.processors.smelters.toString());
        this.updateElement('forges-count', this.state.processors.forges.toString());
        this.updateElement('refineries-count', this.state.processors.refineries.toString());
        this.updateElement('mints-count', this.state.processors.mints.toString());
        
        // Update market status
        this.updateElement('stone-traders-count', this.state.traders.stoneTraders.toString());
        this.updateElement('coal-traders-count', this.state.traders.coalTraders.toString());
        this.updateElement('metal-traders-count', this.state.traders.metalTraders.toString());
    const marketEff = Math.round(this.state.efficiency.trading * 100);
    this.updateElement('market-efficiency', marketEff + '%');
        
        // Update transport status
        this.updateElement('carts-count', this.state.transport.carts.toString());
        this.updateElement('wagons-count', this.state.transport.wagons.toString());
        this.updateElement('trains-count', this.state.transport.trains.toString());
        this.updateElement('transport-capacity', this.formatNumber(this.state.transport.capacity));
    const usagePct = Math.round(this.state.transport.usage);
    this.updateElement('transport-usage', usagePct + '%');
    const tub = document.getElementById('transport-usage-bar'); if (tub) tub.style.width = Math.max(0, Math.min(100, usagePct)) + '%';
        
        // Update city status
        this.updateElement('police-count', this.state.city.police.toString());
        this.updateElement('banks-count', this.state.city.banks.toString());
        this.updateElement('markets-count', this.state.city.markets.toString());
        this.updateElement('universities-count', this.state.city.universities.toString());
        
        // Update bank bonus display
        const bankBonusPct = Math.round((Math.pow(1.20, this.state.city.banks) - 1) * 1000) / 10; // 20% per bank (compound)
        this.updateElement('bank-bonus-display', `+${bankBonusPct}%`);
        
        // Update sales department with level and interval info
        const salesDept = this.state.city.salesDepartment || 0;
        const interval = salesDept > 0 ? Math.max(5, 60 - (salesDept - 1) * 10) : 0;
        const salesSpeed = salesDept > 0 ? `Level ${salesDept} (sells all every ${interval}s)` : 'Level 0';
        this.updateElement('sales-dept-count', salesSpeed);
        
        // Update sales department label with themed name
        if (this.rebirthThemes) {
            const theme = this.rebirthThemes.getCurrentTheme(this.state);
            const salesLabel = document.getElementById('sales-dept-label');
            if (salesLabel) {
                salesLabel.textContent = theme.city.salesDepartment.name + ':';
            }
        }
        
        // Update mining academy display
        const miningAcademy = this.state.city.miningAcademy || 0;
        const miningBonus = miningAcademy > 0 ? Math.round((Math.pow(1.15, miningAcademy) - 1) * 100) : 0; // Compound 15% per level
        const miningText = miningAcademy > 0 ? `Level ${miningAcademy} (+${miningBonus}% gathering)` : 'Level 0';
        this.updateElement('mining-academy-count', miningText);
        
        // Update mining academy label with themed name
        if (this.rebirthThemes) {
            const theme = this.rebirthThemes.getCurrentTheme(this.state);
            const miningLabel = document.getElementById('mining-academy-label');
            if (miningLabel) {
                miningLabel.textContent = theme.city.miningAcademy.name + ':';
            }
        }
        
        // Update automation lab display
        const automationLab = this.state.city.automationLab || 0;
        const craftSpeed = automationLab > 0 ? `Level ${automationLab} (${automationLab + 1}x speed)` : 'Level 0';
        this.updateElement('automation-lab-count', craftSpeed);
        
        // Update automation lab label with themed name
        if (this.rebirthThemes) {
            const theme = this.rebirthThemes.getCurrentTheme(this.state);
            const automationLabel = document.getElementById('automation-lab-label');
            if (automationLabel) {
                automationLabel.textContent = theme.city.automationLab.name + ':';
            }
        }
        
        // Update sales timer countdown
        const timerRow = document.getElementById('sales-timer-row');
        if (salesDept > 0 && this.nextAutoSellFinishedAt) {
            if (timerRow) timerRow.style.display = '';
            const timeUntilSale = Math.max(0, this.nextAutoSellFinishedAt - Date.now());
            const secondsLeft = Math.ceil(timeUntilSale / 1000);
            this.updateElement('sales-timer', `${secondsLeft}s`);
        } else {
            if (timerRow) timerRow.style.display = 'none';
        }
        
        // Update city dynamics
        this.updateElement('politicians-count', this.state.city.politicians?.toString() || '0');
        
        // Update decay display with scaling info
        const currentDecay = this.state.city.decay || 0;
        const effectiveMaxDecay = this.state.city.adjustedMaxDecay || this.state.city.maxDecay;
        const decayPct = Math.round((currentDecay / effectiveMaxDecay) * 100);
        this.updateElement('city-decay', `${Math.round(currentDecay)}/${Math.round(effectiveMaxDecay)} (${decayPct}%)`);
        const cdb = document.getElementById('city-decay-bar'); 
        if (cdb) cdb.style.width = Math.max(0, Math.min(100, decayPct)) + '%';
        
        this.updateElement('rebirths-count', (this.state.city.rebirths || 0).toString());
        
        // Update arcade stats if arcade manager exists
        if (this.arcadeManager && window.app) {
            window.app.updateArcadeStats();
        }
        
        // Update global efficiency display (for mining/processing tabs)
        const globalEff = Math.round(this.state.efficiency.global * 100);
        const mineEffTotal = Math.round(this.state.efficiency.mining * this.state.efficiency.global * 100);
        const procEffTotal = Math.round(this.state.efficiency.processing * this.state.efficiency.global * 100);
        
        this.updateElement('mining-efficiency', `${mineEffTotal}%`);
        const mib = document.getElementById('mining-efficiency-bar'); 
        if (mib) mib.style.width = Math.max(0, Math.min(200, mineEffTotal)) + '%';
        
        this.updateElement('processing-efficiency', `${procEffTotal}%`);
        const peb = document.getElementById('processing-efficiency-bar'); 
        if (peb) peb.style.width = Math.max(0, Math.min(200, procEffTotal)) + '%';
        
        // Update research status
        const completedResearch = Object.values(this.state.research).filter(r => r).length;
        this.updateElement('completed-research', completedResearch.toString());
        
        // Update crafted inventory
        this.updateElement('crafted-basic-count', (this.state.crafted?.basic || 0).toString());
        this.updateElement('crafted-intermediate-count', (this.state.crafted?.intermediate || 0).toString());
        this.updateElement('crafted-advanced-count', (this.state.crafted?.advanced || 0).toString());
        this.updateElement('crafted-premium-count', (this.state.crafted?.premium || 0).toString());
        
        // Update auto-craft button text with unlocked tiers
        const autoCraftBtn = document.getElementById('toggle-autocraft-btn');
        if (autoCraftBtn) {
            const titleDiv = autoCraftBtn.querySelector('.btn-title');
            const descDiv = autoCraftBtn.querySelector('.btn-description');
            if (titleDiv) {
                const status = this.state.autoCraft ? 'ON' : 'OFF';
                titleDiv.textContent = `🤖 Auto-Craft: ${status}`;
            }
            if (descDiv) {
                const unlockedTiers = [];
                if (this.state.unlock_autocraft_basic) unlockedTiers.push('T1');
                if (this.state.unlock_autocraft_intermediate) unlockedTiers.push('T2');
                if (this.state.unlock_autocraft_advanced) unlockedTiers.push('T3');
                if (this.state.unlock_autocraft_premium) unlockedTiers.push('T4');
                
                if (unlockedTiers.length > 0) {
                    descDiv.textContent = `Unlocked tiers: ${unlockedTiers.join(', ')}`;
                } else {
                    descDiv.textContent = 'Unlock auto-craft tiers in Research tab';
                }
            }
        }
        
        // Update auto-transport toggle button texts with theme-aware names
        if (this.state.autoTransport) {
            const rebirths = this.state.city?.rebirths || 0;
            const theme = this.rebirthThemes?.getTheme(rebirths);
            
            const tiers = ['basic', 'intermediate', 'advanced', 'premium'];
            for (const tier of tiers) {
                const btn = document.getElementById(`transport-${tier}-btn`);
                if (btn && theme?.crafting?.[tier]) {
                    const titleDiv = btn.querySelector('.btn-title');
                    if (titleDiv) {
                        const status = this.state.autoTransport[tier] ? 'ON' : 'OFF';
                        const resultName = theme.crafting[tier].result;
                        const shortName = resultName.split(' ').length > 2 ? 
                            resultName.split(' ').slice(0, 2).join(' ') : resultName;
                        const emoji = theme.crafting[tier].emoji || '📦';
                        titleDiv.textContent = `${emoji} ${shortName}: ${status}`;
                    }
                }
            }
        }
        
        // Update factory and city inventories
        this.updateInventoryDisplays();
        
        // Update button states
        this.updateButtonStates();
    }
    
    updateInventoryDisplays() {
        // Update factory inventory - show BOTH processed AND finished goods
        const factoryDiv = document.getElementById('factory-finished-inventory');
        if (factoryDiv) {
            const processedInv = this.state.factory?.processed || {};
            const finishedInv = this.state.factory?.finished || {};
            
            const processedItems = Object.entries(processedInv).filter(([_, qty]) => qty > 0);
            const finishedItems = Object.entries(finishedInv).filter(([_, qty]) => qty > 0);
            const allItems = [...processedItems, ...finishedItems];
            
            if (allItems.length === 0) {
                factoryDiv.textContent = '(empty)';
            } else {
                factoryDiv.innerHTML = allItems.map(([item, qty]) => 
                    `<div class="inventory-item">${item}: ${Math.floor(qty)}</div>`
                ).join('');
            }
        }
        
        // Update city finished goods inventory  
        const cityInv = this.state.cityInventory?.finished || {};
        const cityDiv = document.getElementById('city-finished-inventory');
        if (cityDiv) {
            const items = Object.entries(cityInv).filter(([_, qty]) => qty > 0);
            if (items.length === 0) {
                cityDiv.innerHTML = '<div class="empty-inventory">(empty)</div>';
            } else {
                cityDiv.innerHTML = items.map(([item, qty]) => 
                    `<div class="inventory-item">${item}: ${Math.floor(qty)}</div>`
                ).join('');
            }
        }
        
        // Update rebirth upgrades UI (if system is available)
        if (this.rebirthRewards && (this.state.city.rebirths > 0 || this.rebirthUpgradesInitialized)) {
            if (!this.rebirthUpgradesInitialized) {
                this.updateRebirthUpgradesUI();
                this.rebirthUpgradesInitialized = true;
            } else {
                // Lightweight affordability refresh - update existing buttons without full DOM rebuild
                this.updateRebirthUpgradeAffordability();
            }
        }
    }
    
    updateButtonStates() {
        // Worker cost helper - escalating 1.08x per owned
        const wCost = (base, type) => {
            const owned = this.state.workers[type] || 0;
            const rebirthEffects = this.rebirthRewards ?
                this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) :
                { buildingDiscount: 1 };
            return Math.ceil(base * Math.pow(1.08, owned) * rebirthEffects.buildingDiscount);
        };
        const stoneCost  = wCost(5,   'stoneMiners');
        const coalCost   = wCost(25,  'coalMiners');
        const ironCost   = wCost(100, 'ironMiners');
        const silverCost = wCost(500, 'silverMiners');

        // Mining buttons (check both gold cost AND unlock status)
        this.updateButtonState('mine-stone-btn', true); // Always available
        this.updateButtonState('hire-stone-miner-btn', this.state.resources.gold >= stoneCost);
        this.updateButtonState('hire-coal-miner-btn', this.state.resources.gold >= coalCost && this.state.unlock_coal);
        this.updateButtonState('hire-iron-miner-btn', this.state.resources.gold >= ironCost && this.state.unlock_iron);
        this.updateButtonState('hire-silver-miner-btn', this.state.resources.gold >= silverCost && this.state.unlock_silver);

        // Show worker costs on buttons
        this.updateElement('stone-miner-cost', this.formatNumber(stoneCost));
        this.updateElement('coal-miner-cost',  this.formatNumber(coalCost));
        this.updateElement('iron-miner-cost',  this.formatNumber(ironCost));
        this.updateElement('silver-miner-cost', this.formatNumber(silverCost));
        
    // Processing buttons (gated by unlocks) - apply building discount
    const bd = (this.rebirthRewards ? this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}).buildingDiscount : 1);
    this.updateButtonState('build-smelter-btn', this.state.resources.gold >= Math.ceil(20 * bd) && this.state.unlock_processing);
    this.updateButtonState('build-forge-btn', this.state.resources.gold >= Math.ceil(100 * bd) && this.state.unlock_processing);
    this.updateButtonState('build-refinery-btn', this.state.resources.gold >= Math.ceil(500 * bd) && this.state.unlock_processing);
    this.updateButtonState('build-mint-btn', this.state.resources.gold >= Math.ceil(2000 * bd) && this.state.unlock_processing);
    this.updateButtonState('build-polisher-btn', this.state.resources.gold >= Math.ceil(50 * bd) && this.state.unlock_processing);
    this.updateButtonState('build-coker-btn', this.state.resources.gold >= Math.ceil(150 * bd) && this.state.unlock_processing);
    this.updateButtonState('build-chemplant-btn', this.state.resources.gold >= Math.ceil(400 * bd) && this.state.unlock_oil);
    this.updateButtonState('build-chipfab-btn', this.state.resources.gold >= Math.ceil(1200 * bd) && this.state.unlock_electronics);
    this.updateButtonState('build-jeweler-btn', this.state.resources.gold >= Math.ceil(900 * bd) && this.state.unlock_jewelry);
    this.updateButtonState('build-assembly-btn', this.state.resources.gold >= Math.ceil(1600 * bd) && this.state.unlock_electronics);
    this.updateButtonState('build-autoplant-btn', this.state.resources.gold >= Math.ceil(5000 * bd) && this.state.unlock_automotive);
        
        // Market buttons
        this.updateButtonState('sell-stone-btn', this.state.resources.stone >= 1);
        this.updateButtonState('sell-coal-btn', this.state.resources.coal >= 1);
        this.updateButtonState('sell-iron-btn', this.state.resources.iron >= 1);
        this.updateButtonState('sell-silver-btn', this.state.resources.silver >= 1);
        this.updateButtonState('hire-stone-trader-btn', this.state.resources.gold >= Math.ceil(15 * bd));
        this.updateButtonState('hire-coal-trader-btn', this.state.resources.gold >= Math.ceil(75 * bd));
        this.updateButtonState('hire-metal-trader-btn', this.state.resources.gold >= Math.ceil(300 * bd));
        
        // Transport buttons
        this.updateButtonState('buy-cart-btn', this.state.resources.gold >= Math.ceil(30 * bd));
        this.updateButtonState('buy-wagon-btn', this.state.resources.gold >= Math.ceil(150 * bd));
        this.updateButtonState('buy-train-btn', this.state.resources.gold >= Math.ceil(800 * bd));
        
        // City buttons - dynamic costs based on current level (apply building discount)
        // Police/Security cost scales with 1.25x per hire (generates decay for rebirth)
        const policeCount = this.state.city.police || 0;
        const policeCost = Math.ceil(5000 * Math.pow(1.25, policeCount) * bd);
        this.updateElement('police-cost', policeCost.toString());
        this.updateButtonState('hire-police-btn', this.state.resources.gold >= policeCost);
        
        // Update police button text based on level with themed name
        const policeBtn = document.getElementById('hire-police-btn');
        if (policeBtn) {
            const titleDiv = policeBtn.querySelector('.btn-title');
            if (titleDiv && this.rebirthThemes) {
                const theme = this.rebirthThemes.getCurrentTheme(this.state);
                const themeName = theme.city.police.name;
                titleDiv.textContent = policeCount === 0 ? `Hire ${themeName}` : `Hire ${themeName} (Lv ${policeCount})`;
            }
        }
        
        // Politician cost scales with 1.05x per hire
        const politicianCount = this.state.city.politicians || 0;
        const politicianCost = Math.ceil(250 * Math.pow(1.05, politicianCount) * bd);
        this.updateElement('politician-cost', politicianCost.toString());
        this.updateButtonState('hire-politician-btn', this.state.resources.gold >= politicianCost);
        
        // Update politician button text based on level with themed name
        const politicianBtn = document.getElementById('hire-politician-btn');
        if (politicianBtn) {
            const titleDiv = politicianBtn.querySelector('.btn-title');
            if (titleDiv && this.rebirthThemes) {
                const theme = this.rebirthThemes.getCurrentTheme(this.state);
                const themeName = theme.city.politicians.name;
                titleDiv.textContent = politicianCount === 0 ? `Hire ${themeName}` : `Hire ${themeName} (Lv ${politicianCount})`;
            }
        }
        
        // Bank cost scales with 1.20x per building
        const bankCount = this.state.city.banks || 0;
        const bankCost = Math.ceil(500 * Math.pow(1.20, bankCount) * bd);
        this.updateElement('bank-cost', bankCost.toString());
        this.updateButtonState('build-bank-btn', this.state.resources.gold >= bankCost);
        
        // Update bank button text based on level with themed name
        const bankBtn = document.getElementById('build-bank-btn');
        if (bankBtn) {
            const titleDiv = bankBtn.querySelector('.btn-title');
            if (titleDiv && this.rebirthThemes) {
                const theme = this.rebirthThemes.getCurrentTheme(this.state);
                const themeName = theme.city.banks.name;
                titleDiv.textContent = bankCount === 0 ? `Build ${themeName}` : `Build ${themeName} (Lv ${bankCount})`;
            }
        }
        
        // Market cost scales with 1.15x per building
        const marketCount = this.state.city.markets || 0;
        const marketCost = Math.ceil(1000 * Math.pow(1.15, marketCount) * bd);
        this.updateElement('market-cost', marketCost.toString());
        this.updateButtonState('build-market-btn', this.state.resources.gold >= marketCost);
        
        // Update market button text based on level with themed name
        const marketBtn = document.getElementById('build-market-btn');
        if (marketBtn) {
            const titleDiv = marketBtn.querySelector('.btn-title');
            if (titleDiv && this.rebirthThemes) {
                const theme = this.rebirthThemes.getCurrentTheme(this.state);
                const themeName = theme.city.markets.name;
                titleDiv.textContent = marketCount === 0 ? `Build ${themeName}` : `Build ${themeName} (Lv ${marketCount})`;
            }
        }
        
        // University cost scales with 1.10x per building
        const universityCount = this.state.city.universities || 0;
        const universityCost = Math.ceil(2500 * Math.pow(1.10, universityCount) * bd);
        this.updateElement('university-cost', universityCost.toString());
        this.updateButtonState('build-university-btn', this.state.resources.gold >= universityCost);
        
        // Update university button text based on level with themed name
        const universityBtn = document.getElementById('build-university-btn');
        if (universityBtn) {
            const titleDiv = universityBtn.querySelector('.btn-title');
            if (titleDiv && this.rebirthThemes) {
                const theme = this.rebirthThemes.getCurrentTheme(this.state);
                const themeName = theme.city.universities.name;
                titleDiv.textContent = universityCount === 0 ? `Build ${themeName}` : `Build ${themeName} (Lv ${universityCount})`;
            }
        }
        
        // Sales department button - dynamic cost based on level
        const salesDeptLevel = this.state.city.salesDepartment || 0;
        const salesDeptCost = Math.ceil(300 * Math.pow(1.5, salesDeptLevel) * bd);
        this.updateElement('sales-dept-cost', salesDeptCost.toString());
        this.updateButtonState('build-sales-dept-btn', this.state.resources.gold >= salesDeptCost);
        
        // Update button text based on level with themed name
        const salesBtn = document.getElementById('build-sales-dept-btn');
        if (salesBtn) {
            const titleDiv = salesBtn.querySelector('.btn-title');
            if (titleDiv && this.rebirthThemes) {
                const theme = this.rebirthThemes.getCurrentTheme(this.state);
                const themeName = theme.city.salesDepartment.name;
                titleDiv.textContent = salesDeptLevel === 0 ? `Build ${themeName}` : `Upgrade ${themeName} (Lv ${salesDeptLevel})`;
            }
        }
        
        // Mining Academy button - dynamic cost based on level
        const miningAcademyLevel = this.state.city.miningAcademy || 0;
        const miningAcademyCost = Math.ceil(400 * Math.pow(1.15, miningAcademyLevel) * bd);
        this.updateElement('mining-academy-cost', miningAcademyCost.toString());
        this.updateButtonState('build-mining-academy-btn', this.state.resources.gold >= miningAcademyCost);
        
        const miningAcademyBtn = document.getElementById('build-mining-academy-btn');
        if (miningAcademyBtn) {
            const titleDiv = miningAcademyBtn.querySelector('.btn-title');
            if (titleDiv && this.rebirthThemes) {
                const theme = this.rebirthThemes.getCurrentTheme(this.state);
                const themeName = theme.city.miningAcademy.name;
                titleDiv.textContent = miningAcademyLevel === 0 ? `Build ${themeName}` : `Upgrade ${themeName} (Lv ${miningAcademyLevel})`;
            }
        }
        
        // Automation Lab button - dynamic cost based on level
        const automationLabLevel = this.state.city.automationLab || 0;
        const automationLabCost = Math.ceil(600 * Math.pow(1.5, automationLabLevel) * bd);
        this.updateElement('automation-lab-cost', automationLabCost.toString());
        this.updateButtonState('build-automation-lab-btn', this.state.resources.gold >= automationLabCost);
        
        const automationLabBtn = document.getElementById('build-automation-lab-btn');
        if (automationLabBtn) {
            const titleDiv = automationLabBtn.querySelector('.btn-title');
            if (titleDiv && this.rebirthThemes) {
                const theme = this.rebirthThemes.getCurrentTheme(this.state);
                const themeName = theme.city.automationLab.name;
                titleDiv.textContent = automationLabLevel === 0 ? `Build ${themeName}` : `Upgrade ${themeName} (Lv ${automationLabLevel})`;
            }
        }
        
        // Rebirth button (enable at 99.5%+ decay to handle floating point + rounding)
        const effectiveMaxDecay = this.state.city.adjustedMaxDecay || this.state.city.maxDecay;
        this.updateButtonState('rebirth-btn', this.state.city.decay >= (effectiveMaxDecay - 0.5));
        
        // Crafting buttons
        this.updateButtonState('craft-basic-btn', this.state.resources.stone >= 10);
        this.updateButtonState('craft-intermediate-btn', 
            (this.state.crafted?.basic || 0) >= 1 && this.state.resources.coal >= 5 && this.state.unlock_coal);
        this.updateButtonState('craft-advanced-btn', 
            (this.state.crafted?.intermediate || 0) >= 1 && this.state.resources.iron >= 3 && this.state.unlock_iron);
        this.updateButtonState('craft-premium-btn', 
            (this.state.crafted?.advanced || 0) >= 1 && this.state.resources.silver >= 2 && this.state.unlock_silver);
        
        // Auto-craft toggle (unlocked if ANY auto-craft tier is unlocked)
        const hasAnyAutoCraft = this.state.unlock_autocraft_basic || 
                                this.state.unlock_autocraft_intermediate || 
                                this.state.unlock_autocraft_advanced || 
                                this.state.unlock_autocraft_premium;
        this.updateButtonState('toggle-autocraft-btn', hasAnyAutoCraft);
        
        // Transport toggle buttons (always enabled once you have items)
        // These are always clickable to toggle
        
        // City sell crafted buttons (need items in city) - use theme-aware names
        const cityInv = this.state.cityInventory?.finished || {};
        const rebirths = this.state.city?.rebirths || 0;
        const theme = this.rebirthThemes?.getTheme(rebirths);
        const themeItemNames = {
            basic: theme?.crafting?.basic?.result || 'Deployable App',
            intermediate: theme?.crafting?.intermediate?.result || 'SaaS Platform',
            advanced: theme?.crafting?.advanced?.result || 'Enterprise Product',
            premium: theme?.crafting?.premium?.result || 'Unicorn Startup'
        };
        
        this.updateButtonState('sell-city-basic-btn', (cityInv[themeItemNames.basic] || 0) >= 1);
        this.updateButtonState('sell-city-intermediate-btn', (cityInv[themeItemNames.intermediate] || 0) >= 1);
        this.updateButtonState('sell-city-advanced-btn', (cityInv[themeItemNames.advanced] || 0) >= 1);
        this.updateButtonState('sell-city-premium-btn', (cityInv[themeItemNames.premium] || 0) >= 1);
        
        // Research buttons
        this.updateResearchButtonState('research-mining-btn', 'mining', 50);
        this.updateResearchButtonState('research-processing-btn', 'processing', 100);
        this.updateResearchButtonState('research-automation-btn', 'automation', 50);
        this.updateResearchButtonState('research-logistics-btn', 'logistics', 1000);
        
        // Auto-craft unlock buttons
        this.updateButtonState('unlock-autocraft-basic-btn', 
            this.state.resources.gold >= 100 && !this.state.unlock_autocraft_basic);
        this.updateButtonState('unlock-autocraft-intermediate-btn', 
            this.state.resources.gold >= 500 && !this.state.unlock_autocraft_intermediate && this.state.unlock_coal);
        this.updateButtonState('unlock-autocraft-advanced-btn', 
            this.state.resources.gold >= 2500 && !this.state.unlock_autocraft_advanced && this.state.unlock_iron);
        this.updateButtonState('unlock-autocraft-premium-btn', 
            this.state.resources.gold >= 10000 && !this.state.unlock_autocraft_premium && this.state.unlock_silver);
        
        // Hide purchased unlock buttons
        const unlockKeys = ['unlock_coal', 'unlock_iron', 'unlock_silver', 'unlock_oil', 'unlock_rubber', 'unlock_processing', 'unlock_electronics', 'unlock_jewelry', 'unlock_automotive', 'unlock_autocraft_basic', 'unlock_autocraft_intermediate', 'unlock_autocraft_advanced', 'unlock_autocraft_premium'];
        unlockKeys.forEach(key => {
            if (this.state[key]) {
                const button = document.querySelector(`[data-unlock="${key}"]`);
                if (button) {
                    button.style.setProperty('display', 'none', 'important');
                }
            }
        });
        
        // Hide purchased research buttons
        const researchTypes = ['mining', 'processing', 'automation', 'logistics', 'quantum'];
        researchTypes.forEach(type => {
            if (this.state.research[type]) {
                const button = document.getElementById(`research-${type}-btn`);
                if (button) {
                    button.style.setProperty('display', 'none', 'important');
                }
            }
        });
        
        // Prestige button
        this.updateButtonState('prestige-btn', this.state.stats.totalGoldEarned >= 10000);
        
        // Ad buttons (based on cooldowns)
        const now = Date.now();
        this.updateButtonState('ad-double-resources-btn', this.state.ads.doubleResources.cooldown <= now);
        this.updateButtonState('ad-convert-resources-btn', this.state.ads.convertResources.cooldown <= now);
        this.updateButtonState('ad-gold-bonus-btn', this.state.ads.goldBonus.cooldown <= now);
        this.updateButtonState('ad-efficiency-boost-btn', this.state.ads.efficiencyBoost.cooldown <= now);
        this.updateButtonState('watch-ad-btn', (this.state.watchedAdCooldown || 0) <= now);
        
        // Update watch ad cooldown display
        this.updateAdButtonCooldown();
        
        // Add visual hint for new players
        const mineButton = document.getElementById('mine-stone-btn');
        if (mineButton && this.state.resources.stone < 10 && this.state.workers.stoneMiners === 0) {
            mineButton.classList.add('pulse');
        } else if (mineButton) {
            mineButton.classList.remove('pulse');
        }
        
        // Update unlock button states
        this.updateUnlockButtonStates();
    }
    
    updateUnlockButtonStates() {
        const unlockCosts = {
            unlock_coal: 25,
            unlock_iron: 60,
            unlock_silver: 200,
            unlock_oil: 150,
            unlock_rubber: 120,
            unlock_processing: 80,
            unlock_electronics: 800,
            unlock_jewelry: 500,
            unlock_automotive: 2000
        };
        
        // Update each unlock button based on affordability
        Object.entries(unlockCosts).forEach(([key, cost]) => {
            const button = document.querySelector(`[data-unlock="${key}"]`);
            if (button && !this.state[key]) { // Only update if not already unlocked
                const canAfford = this.state.resources.gold >= cost;
                button.disabled = !canAfford;
            }
        });
    }

    unlockFeature(key) {
        const costs = {
            unlock_coal: 25,
            unlock_iron: 60,
            unlock_silver: 200,
            unlock_oil: 150,
            unlock_rubber: 120,
            unlock_processing: 80,
            unlock_electronics: 800,
            unlock_jewelry: 500,
            unlock_automotive: 2000,
            unlock_autocraft_basic: 100,
            unlock_autocraft_intermediate: 500,
            unlock_autocraft_advanced: 2500,
            unlock_autocraft_premium: 10000
        };
        const cost = costs[key] || 0;
        if (this.state[key]) return false; // already unlocked
        if (this.state.resources.gold < cost) return false;
        this.state.resources.gold -= cost;
        this.state.stats.totalGoldSpent += cost;
        this.state[key] = true;
        this.playSound('research');
        this.flashElement('gold-amount');
        
        // Hide the unlock button after purchasing + celebration
        const button = document.querySelector(`[data-unlock="${key}"]`);
        if (button) {
            this.spawnParticles(button, '#ffd700', 15);
            this.spawnConfetti(button, 12);
            this.triggerScreenShake();
            this.triggerScreenFlash();
            // Dramatic delay before hiding
            setTimeout(() => button.style.setProperty('display', 'none', 'important'), 600);
        }
        
        console.log(`Unlocked feature: ${key}`);
        this.showNotification(`✅ Feature unlocked!`);
        
        return true;
    }
    
    updatePurchasedItemsVisibility() {
        console.log('Checking purchased items visibility...');
        
        // Hide purchased unlocks
        const unlockKeys = ['unlock_coal', 'unlock_iron', 'unlock_silver', 'unlock_oil', 'unlock_rubber', 'unlock_processing', 'unlock_electronics', 'unlock_jewelry', 'unlock_automotive', 'unlock_autocraft_basic', 'unlock_autocraft_intermediate', 'unlock_autocraft_advanced', 'unlock_autocraft_premium'];
        unlockKeys.forEach(key => {
            if (this.state[key]) {
                console.log(`Hiding unlock: ${key}`);
                const button = document.querySelector(`[data-unlock="${key}"]`);
                if (button) {
                    button.style.setProperty('display', 'none', 'important');
                } else {
                    console.warn(`Button not found for unlock: ${key}`);
                }
            }
        });
        
        // Hide purchased research
        const researchTypes = ['mining', 'processing', 'automation', 'logistics', 'quantum'];
        researchTypes.forEach(type => {
            if (this.state.research[type]) {
                console.log(`Hiding research: ${type}`);
                const button = document.getElementById(`research-${type}-btn`);
                if (button) {
                    button.style.setProperty('display', 'none', 'important');
                } else {
                    console.warn(`Button not found for research: ${type}`);
                }
            }
        });
    }
    
    updateResearchButtonState(buttonId, researchType, cost) {
        const button = document.getElementById(buttonId);
        if (button) {
            const isCompleted = this.state.research[researchType];
            const canAfford = this.state.resources.gold >= cost;
            
            button.disabled = isCompleted || !canAfford;
            
            if (isCompleted) {
                button.classList.add('purchased');
                const costDiv = button.querySelector('.btn-cost');
                if (costDiv) {
                    costDiv.textContent = 'COMPLETED';
                }
            } else {
                button.classList.remove('purchased');
            }
        }
    }
    

    
    updateButtonState(buttonId, enabled) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = !enabled;
        }
    }
    
    updateElement(elementId, text) {
        const element = document.getElementById(elementId);
        if (element && element.textContent !== text) {
            element.textContent = text;
        }
    }

    getCampaignSnapshot(theme = null) {
        const currentTheme = theme || (this.rebirthThemes ? this.rebirthThemes.getCurrentTheme(this.state) : null);
        const campaignTone = currentTheme?.atmosphere === 'bright' ? 'light' : 'dark';
        const rebirths = this.state.city?.rebirths || 0;
        const maxDecay = this.state.city?.adjustedMaxDecay || this.state.city?.maxDecay || 100;
        const currentDecay = this.state.city?.decay || 0;
        const decayProgress = Math.min(1, Math.max(0, currentDecay / maxDecay));

        const coreUnlockKeys = ['unlock_coal', 'unlock_iron', 'unlock_silver', 'unlock_processing'];
        const unlockedCoreCount = coreUnlockKeys.filter((key) => !!this.state[key]).length;
        const completedResearch = Object.values(this.state.research || {}).filter(Boolean).length;
        const citySystemsCount = ['salesDepartment', 'miningAcademy', 'automationLab'].filter(
            (key) => (this.state.city?.[key] || 0) > 0
        ).length;
        const supportSystemsCount = ['police', 'banks', 'markets', 'universities'].filter(
            (key) => (this.state.city?.[key] || 0) > 0
        ).length;
        const totalPlayTimeMinutes = Math.floor((this.state.arcade?.totalPlayTime || 0) / 60);

        let phase = 'legacy';
        let title = currentTheme ? `${currentTheme.name} campaign` : 'Campaign brief';
        let description = currentTheme?.description || 'Build a run with purpose instead of treating every reset like a dead end.';
        let progressLabel = 'Legacy progress';
        let progressValue = Math.min(1, rebirths / 10);
        let progressNote = 'Every rebirth should feel like a chapter, not a punishment.';
        let nextGoal = `Push toward Rebirth ${rebirths + 1}`;
        let nextReward = 'Permanent upgrades make the next loop stronger than the last.';

        if (unlockedCoreCount < coreUnlockKeys.length) {
            phase = 'foundation';
            title = 'Build the backbone';
            description = 'The first run is about proving the chain works: unlock every core tier, then make the factory hum.';
            progressLabel = 'Foundation progress';
            progressValue = unlockedCoreCount / coreUnlockKeys.length;
            progressNote = 'Each unlock turns the loop from a clicker into a production line.';
            nextGoal = !this.state.unlock_coal
                ? 'Unlock Cloud Servers'
                : !this.state.unlock_iron
                ? 'Unlock User Accounts'
                : !this.state.unlock_silver
                ? 'Unlock Premium Subs'
                : 'Unlock Deployment';
            nextReward = 'Core unlocks make the early game feel like a system, not a menu of chores.';
        } else if (completedResearch < 4 || citySystemsCount < 3) {
            phase = 'automation';
            title = 'Turn labor into systems';
            description = 'This is where the game becomes infrastructure: research, city systems, and automation start carrying the run.';
            progressLabel = 'Automation progress';
            progressValue = Math.min(1, ((completedResearch / 4) * 0.65) + ((citySystemsCount / 3) * 0.35));
            progressNote = 'The loop gets more meaningful when machines and departments do the repetitive work.';
            nextGoal = !this.state.research?.automation
                ? 'Research Automation'
                : !this.state.city?.salesDepartment
                ? 'Build Sales Bot'
                : !this.state.city?.miningAcademy
                ? 'Build Mining Academy'
                : 'Build Automation Lab';
            nextReward = 'Automation is the point where the empire starts feeling alive on its own.';
        } else if (rebirths < 1 || decayProgress < 1) {
            phase = 'rebirth';
            title = 'Prepare the next chapter';
            description = 'Decay is not failure here. It is the mechanism that turns one strong run into lasting progress.';
            progressLabel = 'Rebirth progress';
            progressValue = decayProgress;
            progressNote = 'Fill the city with decay, trigger the reset, and cash in the permanent upgrades.';
            nextGoal = decayProgress < 1 ? 'Raise city decay to 100%' : 'Trigger your first rebirth';
            nextReward = 'The first rebirth opens the long arc of the game, where momentum compounds instead of vanishing.';
        }

        const legacyScore = Math.round(
            (this.state.stats?.totalGoldEarned || 0) +
            (completedResearch * 220) +
            (unlockedCoreCount * 180) +
            (citySystemsCount * 260) +
            (supportSystemsCount * 90) +
            (rebirths * 1200) +
            totalPlayTimeMinutes +
            Math.round(decayProgress * 150)
        );

        return {
            phase,
            title,
            description,
            progressLabel,
            progressValue,
            progressNote,
            nextGoal,
            nextReward,
            legacyScore,
            campaignTone,
            themeLabel: currentTheme ? `${currentTheme.name} · Chapter ${rebirths + 1}` : `Chapter ${rebirths + 1}`,
            objectives: [
                {
                    title: 'Foundation',
                    detail: 'Unlock the core tiers and establish a production spine.',
                    status: phase === 'foundation' ? 'current' : unlockedCoreCount >= coreUnlockKeys.length ? 'complete' : 'upcoming',
                    progress: unlockedCoreCount / coreUnlockKeys.length,
                    hint: `${unlockedCoreCount}/${coreUnlockKeys.length} core unlocks`
                },
                {
                    title: 'Automation',
                    detail: 'Research automation and wire up the city systems that keep the run moving.',
                    status: phase === 'automation' ? 'current' : completedResearch >= 4 && citySystemsCount >= 3 ? 'complete' : 'upcoming',
                    progress: Math.min(1, ((completedResearch / 4) * 0.65) + ((citySystemsCount / 3) * 0.35)),
                    hint: `${completedResearch}/4 research, ${citySystemsCount}/3 city systems`
                },
                {
                    title: 'Legacy',
                    detail: 'Let the city decay, rebirth the run, and convert the reset into permanent strength.',
                    status: phase === 'legacy' ? 'current' : rebirths >= 1 && decayProgress >= 1 ? 'complete' : 'upcoming',
                    progress: phase === 'legacy' ? Math.min(1, rebirths / 10) : decayProgress,
                    hint: rebirths > 0 ? `${rebirths} rebirths, decay ${Math.round(decayProgress * 100)}%` : 'First rebirth unlocks the arc'
                }
            ]
        };
    }

    updateCampaignUI(snapshot) {
        const campaignPanel = document.getElementById('campaign-panel');
        if (campaignPanel) {
            campaignPanel.dataset.campaignTone = snapshot.campaignTone;
            campaignPanel.dataset.campaignPhase = snapshot.phase;
        }

        this.updateElement('campaign-title', snapshot.title);
        this.updateElement('campaign-description', snapshot.description);
        this.updateElement('campaign-theme-chip', snapshot.themeLabel);
        this.updateElement('campaign-next-chip', `Next: ${snapshot.nextGoal}`);
        this.updateElement('campaign-legacy-chip', `Legacy Score: ${this.formatNumber(snapshot.legacyScore)}`);
        this.updateElement('campaign-progress-label', snapshot.progressLabel);
        this.updateElement('campaign-progress-value', `${Math.round(snapshot.progressValue * 100)}%`);
        this.updateElement('campaign-progress-note', snapshot.progressNote);

        const progressBar = document.getElementById('campaign-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${Math.max(0, Math.min(100, Math.round(snapshot.progressValue * 100)))}%`;
        }

        const objectivesContainer = document.getElementById('campaign-objectives');
        if (objectivesContainer) {
            objectivesContainer.innerHTML = snapshot.objectives.map((objective) => {
                const stateLabel = objective.status === 'current' ? 'Current' : objective.status === 'complete' ? 'Complete' : 'Next';
                const statusClass = objective.status === 'current' ? 'is-current' : objective.status === 'complete' ? 'is-complete' : 'is-upcoming';
                return `
                    <article class="campaign-objective ${statusClass}">
                        <div class="campaign-objective__header">
                            <span class="campaign-objective__title">${objective.title}</span>
                            <span class="campaign-objective__state">${stateLabel}</span>
                        </div>
                        <p class="campaign-objective__detail">${objective.detail}</p>
                        <div class="campaign-objective__meta">
                            <span>${Math.round(objective.progress * 100)}%</span>
                            <span>${objective.hint}</span>
                        </div>
                    </article>
                `;
            }).join('');
        }
    }
    
    // Action handlers
    mineStone() {
        // Manual stone collection - gives 1 stone per click
        this.state.resources.stone += 1;
        this.state.stats.totalResourcesMined.stone += 1;
        
        this.playSound('mine');
        this.flashElement('stone-amount');
        
        // Satisfying mine click feedback
        const btn = document.getElementById('mine-stone-btn');
        if (btn) {
            // Floating number with increasing enthusiasm based on combo
            const comboText = this._comboCount >= 10 ? '+1 ⚡' : 
                              this._comboCount >= 5 ? '+1 🔥' : '+1';
            const color = this._comboCount >= 10 ? '#ffd700' :
                          this._comboCount >= 5 ? '#ff6b6b' : '#8d8d8d';
            this.spawnFloatingNumber(btn, comboText, color);
            this.spawnClickRipple(btn, null);
            this.triggerMineShake(btn);
            
            // Particles scale with combo - more clicks = more spectacular
            const particleCount = Math.min(12, 3 + Math.floor((this._comboCount || 0) / 3));
            this.spawnParticles(btn, color, particleCount);
        }
        
        // Combo tracking for rapid clicking
        this.trackCombo();
        
        // Milestone celebrations
        const totalStone = this.state.stats.totalResourcesMined.stone;
        if (totalStone === 10) {
            this.showNotification('🪨 10 stone mined! You\'re getting the hang of it!');
            this.triggerScreenShake();
        } else if (totalStone === 100) {
            this.showNotification('⛏️ 100 stone! A true miner!');
            this.triggerScreenShake();
            this.spawnParticles(btn, '#ffd700', 20);
        } else if (totalStone === 1000) {
            this.showNotification('💎 1000 stone! LEGENDARY MINER!');
            this.triggerScreenShake();
            this.spawnParticles(btn, '#ffd700', 25);
            this.spawnParticles(btn, '#64ffda', 25);
        }
        
        console.log('Mined 1 stone manually');
    }
    
    watchAd() {
        // Check if ad cooldown has expired
        const now = Date.now();
        const adCooldownMs = 5 * 60 * 1000; // 5 minute cooldown
        
        if (!this.state.watchedAdCooldown) {
            this.state.watchedAdCooldown = 0;
        }
        
        if (now < this.state.watchedAdCooldown) {
            const remainingMs = this.state.watchedAdCooldown - now;
            const remainingMin = Math.ceil(remainingMs / 60000);
            this.showNotification(`⏳ Ad available in ${remainingMin} minute${remainingMin > 1 ? 's' : ''}`);
            return;
        }
        
        // Award gold
        this.state.resources.gold += 100;
        this.state.stats.totalGoldEarned = (this.state.stats.totalGoldEarned || 0) + 100;
        
        // Apply 50% income boost for 30 seconds using the existing ads system
        this.state.ads.watchedAdBoost = {
            active: true,
            endTime: now + (30 * 1000), // 30 seconds
            cooldown: now + adCooldownMs
        };
        this.state.watchedAdCooldown = now + adCooldownMs;
        
        // Update button cooldown display
        this.updateAdButtonCooldown();
        
        // Show notification
        this.showNotification('📺 +100 gold! Income boosted by 50% for 30 seconds!');
        this.playSound('reward');
        this.flashElement('gold-amount');
        
        // Animate button
        const btn = document.getElementById('watch-ad-btn');
        if (btn) {
            this.spawnParticles(btn, '#ff6b6b', 15);
            this.spawnFloatingNumber(btn, '+100 💰', '#ffd700');
        }
        
        console.log('Watched ad: +100 gold, 50% boost for 30s');
    }
    
    updateAdButtonCooldown() {
        const btn = document.getElementById('watch-ad-btn');
        const cooldownDisplay = document.getElementById('ad-cooldown');
        
        if (!btn || !cooldownDisplay) return;
        
        const now = Date.now();
        const adCooldownMs = 5 * 60 * 1000;
        const timeLeft = Math.max(0, (this.state.watchedAdCooldown || 0) - now);
        
        if (timeLeft === 0) {
            cooldownDisplay.textContent = 'Ready';
            btn.disabled = false;
        } else {
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            cooldownDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            btn.disabled = true;
        }
    }
    
    hireWorker(workerType) {
        const baseCosts = {
            stoneMiner: 5,
            coalMiner: 25,
            ironMiner: 100,
            silverMiner: 500
        };
        
        // Check if resource is unlocked before allowing worker purchase
        const unlockRequirements = {
            stoneMiner: true, // Always available
            coalMiner: this.state.unlock_coal,
            ironMiner: this.state.unlock_iron,
            silverMiner: this.state.unlock_silver
        };
        
        // Check unlock requirement
        if (!unlockRequirements[workerType]) {
            console.log(`Cannot hire ${workerType}: resource not unlocked yet`);
            this.showNotification(`Unlock the resource first!`);
            return false;
        }
        
        // Apply building discount from rebirth upgrades
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { buildingDiscount: 1 };
        
        const baseCost = baseCosts[workerType];
        const owned = this.state.workers[workerType + 's'] || 0;
        // Escalating cost: each worker costs 8% more than the last
        const scaledCost = baseCost * Math.pow(1.08, owned);
        const cost = Math.ceil(scaledCost * rebirthEffects.buildingDiscount);
        
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            this.state.workers[workerType + 's']++;
            
            this.playSound('hire');
            this.flashElement('gold-amount');
            
            // Purchase celebration effect
            const btnMap = {
                stoneMiner: 'hire-stone-miner-btn',
                coalMiner: 'hire-coal-miner-btn',
                ironMiner: 'hire-iron-miner-btn',
                silverMiner: 'hire-silver-miner-btn'
            };
            this.triggerPurchaseEffect(btnMap[workerType]);
            this.triggerBuildAnimation(btnMap[workerType]);
            this.spawnFloatingNumber(
                document.getElementById(btnMap[workerType]),
                `-${this.formatNumber(cost)} 💰`,
                '#ffd700'
            );
            
            // Bounce the worker count
            const countMap = {
                stoneMiner: 'stone-miners-count',
                coalMiner: 'coal-miners-count',
                ironMiner: 'iron-miners-count',
                silverMiner: 'silver-miners-count'
            };
            this.bounceElement(countMap[workerType]);
            
            console.log(`Hired ${workerType} for ${cost} gold (discount applied)`);
            return true;
        }
        return false;
    }
    
    // Manual Crafting System
    craftItem(tier) {
        // Get current theme to use correct item names
        const rebirths = this.state.city?.rebirths || 0;
        const theme = this.rebirthThemes?.getTheme(rebirths);
        const themeItemNames = {
            basic: theme?.crafting?.basic?.result || 'Deployable App',
            intermediate: theme?.crafting?.intermediate?.result || 'SaaS Platform',
            advanced: theme?.crafting?.advanced?.result || 'Enterprise Product',
            premium: theme?.crafting?.premium?.result || 'Unicorn Startup'
        };
        
        const recipes = {
            basic: {
                requires: { stone: 10 },
                produces: 'basic',
                producesItem: themeItemNames.basic,
                amount: 1,
                sellValue: 3,  // 3x manual sell (10 stone * 0.1 = 1, so 3x = 3)
                name: themeItemNames.basic,
                weight: 1
            },
            intermediate: {
                requires: { basic: 1, coal: 5 },
                produces: 'intermediate',
                producesItem: themeItemNames.intermediate,
                amount: 1,
                sellValue: 9,  // 3x (1 basic (3) + 5 coal * 0.5 = 5.5, ~3x = 9)
                name: themeItemNames.intermediate,
                weight: 2
            },
            advanced: {
                requires: { intermediate: 1, iron: 3 },
                produces: 'advanced',
                producesItem: themeItemNames.advanced,
                amount: 1,
                sellValue: 30,  // 3x (1 int (9) + 3 iron * 1.2 = 12.6, ~3x = 30)
                name: themeItemNames.advanced,
                weight: 3
            },
            premium: {
                requires: { advanced: 1, silver: 2 },
                produces: 'premium',
                producesItem: themeItemNames.premium,
                amount: 1,
                sellValue: 120,  // 3x (1 adv (30) + 2 silver * 6 = 42, ~3x = 120)
                name: themeItemNames.premium,
                weight: 5
            }
        };
        
        const recipe = recipes[tier];
        if (!recipe) return false;
        
        // Get rebirth upgrade effects
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { doubleCraftChance: 0, freeCraftChance: 0 };
        
        // Check if we have the required resources
        for (const [resource, amount] of Object.entries(recipe.requires)) {
            if (resource === 'basic' || resource === 'intermediate' || resource === 'advanced' || resource === 'premium') {
                // Check crafted items
                if (!this.state.crafted[resource] || this.state.crafted[resource] < amount) {
                    console.log(`Not enough ${resource} crafted items`);
                    return false;
                }
            } else {
                // Check regular resources
                if (!this.state.resources[resource] || this.state.resources[resource] < amount) {
                    console.log(`Not enough ${resource}`);
                    return false;
                }
            }
        }
        
        // Check for free craft chance
        const isFree = rebirthEffects.freeCraftChance > 0 && Math.random() < rebirthEffects.freeCraftChance;
        
        // Consume resources (unless free craft proc'd)
        if (!isFree) {
            for (const [resource, amount] of Object.entries(recipe.requires)) {
                if (resource === 'basic' || resource === 'intermediate' || resource === 'advanced' || resource === 'premium') {
                    this.state.crafted[resource] -= amount;
                } else {
                    this.state.resources[resource] -= amount;
                    this.flashElement(`${resource}-amount`);
                }
            }
        }
        
        // Calculate amount to produce (apply double craft chance)
        let produceAmount = recipe.amount;
        if (rebirthEffects.doubleCraftChance > 0 && Math.random() < rebirthEffects.doubleCraftChance) {
            produceAmount *= 2;
        }
        
        // Produce crafted item - stays in crafted inventory until transported
        this.state.crafted[recipe.produces] = (this.state.crafted[recipe.produces] || 0) + produceAmount;
        
        this.playSound('build');
        
        // Visual feedback for crafting
        const craftBtn = document.getElementById(`craft-${tier}-btn`);
        if (craftBtn) {
            this.spawnParticles(craftBtn, '#f093fb', 6);
            this.spawnFloatingNumber(craftBtn, `+${produceAmount} ✨`, '#f093fb');
        }
        
        console.log(`Crafted ${tier}: ${recipe.name} (x${produceAmount})`);
        return true;
    }
    
    toggleTransportCrafted(tier) {
        // Initialize autoTransport state if it doesn't exist
        if (!this.state.autoTransport) {
            this.state.autoTransport = {
                basic: false,
                intermediate: false,
                advanced: false,
                premium: false
            };
        }
        
        // Get current theme item names
        const rebirths = this.state.city?.rebirths || 0;
        const theme = this.rebirthThemes?.getTheme(rebirths);
        const crafting = theme?.crafting?.[tier];
        
        // Toggle the state
        this.state.autoTransport[tier] = !this.state.autoTransport[tier];
        const status = this.state.autoTransport[tier] ? 'ON' : 'OFF';
        
        // Get short name from result
        const resultName = crafting?.result || 'Items';
        const shortName = resultName.split(' ').length > 2 ? 
            resultName.split(' ').slice(0, 2).join(' ') : resultName;
        const emoji = crafting?.emoji || '📦';
        
        // Update button text
        const btn = document.getElementById(`transport-${tier}-btn`);
        if (btn) {
            const title = btn.querySelector('.btn-title');
            if (title) {
                title.textContent = `${emoji} ${shortName}: ${status}`;
            }
        }
        
        this.showNotification(`🚚 Auto-transport ${resultName}: ${status}`);
        return this.state.autoTransport[tier];
    }
    
    // Try to auto-transport crafted items (called each tick)
    tryAutoTransportCrafted() {
        if (!this.state.autoTransport) return;
        
        // Calculate actual transport capacity (NOT minimum 1)
        const totalTransport = 
            (this.state.transport?.carts || 0) + 
            (this.state.transport?.wagons || 0) * 2 + 
            (this.state.transport?.trains || 0) * 5;
        
        // If no transport capacity, user must manually transport
        if (totalTransport === 0) return;
        
        // Transport happens every second based on capacity
        const now = Date.now();
        const cooldown = 1000; // 1 second in milliseconds
        if (!this.state.transport.lastTransportTime) {
            this.state.transport.lastTransportTime = 0;
        }
        
        if (now - this.state.transport.lastTransportTime < cooldown) {
            return; // Still in cooldown
        }
        
        // Update last transport time
        this.state.transport.lastTransportTime = now;
        
        // Get current theme item names and their values (for prioritization)
        const rebirths = this.state.city?.rebirths || 0;
        const theme = this.rebirthThemes?.getTheme(rebirths);
        
        const tierInfo = {
            premium: { 
                name: theme?.crafting?.premium?.result || 'Unicorn Startup',
                value: 120,
                priority: 4
            },
            advanced: { 
                name: theme?.crafting?.advanced?.result || 'Enterprise Product',
                value: 30,
                priority: 3
            },
            intermediate: { 
                name: theme?.crafting?.intermediate?.result || 'SaaS Platform',
                value: 9,
                priority: 2
            },
            basic: { 
                name: theme?.crafting?.basic?.result || 'Deployable App',
                value: 3,
                priority: 1
            }
        };
        
        // Sort tiers by priority (most expensive first)
        const sortedTiers = Object.keys(tierInfo).sort((a, b) => 
            tierInfo[b].priority - tierInfo[a].priority
        );
        
        let remainingCapacity = totalTransport;
        let transported = false;
        
        // Transport items starting with most valuable, up to capacity
        for (const tier of sortedTiers) {
            if (remainingCapacity <= 0) break;
            if (!this.state.autoTransport[tier]) continue;
            
            const craftedAmount = this.state.crafted?.[tier] || 0;
            if (craftedAmount <= 0) continue;
            
            // Transport as many as we can (up to capacity)
            const amountToTransport = Math.min(craftedAmount, remainingCapacity);
            
            if (amountToTransport > 0) {
                // Move items from crafted to city
                this.state.crafted[tier] -= amountToTransport;
                
                const itemName = tierInfo[tier].name;
                if (!this.state.cityInventory.finished[itemName]) {
                    this.state.cityInventory.finished[itemName] = 0;
                }
                this.state.cityInventory.finished[itemName] += amountToTransport;
                
                remainingCapacity -= amountToTransport;
                transported = true;
            }
        }
        
        // Play sound once if any items were transported
        if (transported) {
            this.playSound('transport');
        }
    }
    
    // Sell crafted item from city inventory
    sellCraftedFromCity(tier) {
        const sellValues = {
            basic: 3,
            intermediate: 9,
            advanced: 30,
            premium: 120
        };
        
        // Get current theme item names
        const rebirths = this.state.city?.rebirths || 0;
        const theme = this.rebirthThemes?.getTheme(rebirths);
        const themeItemNames = {
            basic: theme?.crafting?.basic?.result || 'Deployable App',
            intermediate: theme?.crafting?.intermediate?.result || 'SaaS Platform',
            advanced: theme?.crafting?.advanced?.result || 'Enterprise Product',
            premium: theme?.crafting?.premium?.result || 'Unicorn Startup'
        };
        
        const itemName = themeItemNames[tier];
        const cityAmount = this.state.cityInventory?.finished?.[itemName] || 0;
        
        if (cityAmount < 1) return false;
        
        const value = sellValues[tier];
        
        // Remove from city
        this.state.cityInventory.finished[itemName] -= 1;
        
        // Get rebirth upgrade effects for gold multipliers
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { goldMultiplier: 1, cosmicMultiplier: 1, sellingBonus: 1, transcendenceBonus: 1 };
        
        // Get arcade bonuses
        const arcadeBonuses = this.arcadeManager ? 
            this.arcadeManager.getArcadeBonuses() : 
            { goldBonus: 1 };
        
        // Add gold (with city bonuses, rebirth upgrades, and arcade bonuses applied)
        const bankBonus = Math.pow(1.20, this.state.city.banks);
        let finalValue = value * bankBonus;
        finalValue *= rebirthEffects.goldMultiplier;
        finalValue *= rebirthEffects.cosmicMultiplier;
        finalValue *= rebirthEffects.sellingBonus;
        finalValue *= rebirthEffects.transcendenceBonus;
        finalValue *= arcadeBonuses.goldBonus;
        finalValue = Math.floor(finalValue);
        
        this.state.resources.gold += finalValue;
        this.state.stats.totalGoldEarned += finalValue;
        
        this.playSound('sell');
        this.flashElement('gold-amount');
        this.showNotification(`💰 Sold ${itemName} for ${finalValue} capital!`);
        return true;
    }
    
    // Sell ALL crafted items of a tier from city inventory
    sellAllCraftedFromCity(tier) {
        const sellValues = {
            basic: 3,
            intermediate: 9,
            advanced: 30,
            premium: 120
        };
        
        // Get current theme item names
        const rebirths = this.state.city?.rebirths || 0;
        const theme = this.rebirthThemes?.getTheme(rebirths);
        const themeItemNames = {
            basic: theme?.crafting?.basic?.result || 'Deployable App',
            intermediate: theme?.crafting?.intermediate?.result || 'SaaS Platform',
            advanced: theme?.crafting?.advanced?.result || 'Enterprise Product',
            premium: theme?.crafting?.premium?.result || 'Unicorn Startup'
        };
        
        const itemName = themeItemNames[tier];
        const cityAmount = this.state.cityInventory?.finished?.[itemName] || 0;
        
        if (cityAmount < 1) return false;
        
        const value = sellValues[tier];
        
        // Get rebirth upgrade effects for gold multipliers
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { goldMultiplier: 1, cosmicMultiplier: 1, sellingBonus: 1, transcendenceBonus: 1 };
        
        // Get arcade bonuses
        const arcadeBonuses = this.arcadeManager ? 
            this.arcadeManager.getArcadeBonuses() : 
            { goldBonus: 1 };
        
        // Add gold (with city bonuses, rebirth upgrades, and arcade bonuses applied)
        const bankBonus = Math.pow(1.20, this.state.city.banks);
        let finalValue = value * bankBonus * cityAmount;
        finalValue *= rebirthEffects.goldMultiplier;
        finalValue *= rebirthEffects.cosmicMultiplier;
        finalValue *= rebirthEffects.sellingBonus;
        finalValue *= rebirthEffects.transcendenceBonus;
        finalValue *= arcadeBonuses.goldBonus;
        finalValue = Math.floor(finalValue);
        
        // Remove ALL from city
        this.state.cityInventory.finished[itemName] = 0;
        // Note: don't touch this.state.crafted - those track factory items, not city items
        
        this.state.resources.gold += finalValue;
        this.state.stats.totalGoldEarned += finalValue;
        
        this.playSound('sell');
        this.flashElement('gold-amount');
        this.showNotification(`💰 Sold ${cityAmount}x ${itemName} for ${finalValue} capital!`);
        
        // Big sell celebration - ka-ching!
        const goldEl = document.getElementById('gold-amount');
        if (goldEl) {
            this.triggerGoldShimmer('gold-amount');
            if (finalValue >= 500) {
                // Big sale = big gold number + confetti + screen flash
                this.spawnBigGoldNumber(`+${this.formatNumber(finalValue)} 💰`);
                this.spawnConfetti(goldEl, 12);
                this.triggerScreenFlash();
                this.triggerScreenShake();
            } else if (finalValue >= 100) {
                this.spawnFloatingNumber(goldEl, `+${this.formatNumber(finalValue)} 💰`, '#ffd700');
                this.spawnParticles(goldEl, '#ffd700', Math.min(15, Math.floor(finalValue / 50)));
            } else {
                this.spawnFloatingNumber(goldEl, `+${this.formatNumber(finalValue)} 💰`, '#ffd700');
            }
        }
        
        return true;
    }
    
    toggleAutoCraft() {
        // Check if any auto-craft tier is unlocked
        const hasAnyAutoCraft = this.state.unlock_autocraft_basic || 
                                this.state.unlock_autocraft_intermediate || 
                                this.state.unlock_autocraft_advanced || 
                                this.state.unlock_autocraft_premium;
        
        if (!hasAnyAutoCraft) {
            this.showNotification('🔒 Unlock at least one Auto-Craft tier first!');
            return false;
        }
        
        this.state.autoCraft = !this.state.autoCraft;
        const status = this.state.autoCraft ? 'ON' : 'OFF';
        this.showNotification(`🤖 Auto-Craft ${status}`);
        console.log(`Auto-craft toggled: ${status}`);
        return this.state.autoCraft;
    }
    
    tryAutoCraft() {
        if (!this.state.autoCraft) return;
        
        // Get rebirth upgrade effects
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { instantCraftChance: 0, automationSpeedMultiplier: 1, extraAutoCrafts: 0, cooldownReduction: 1, craftingSpeed: 1 };
        
        // Check for instant craft (bypasses cooldown)
        if (rebirthEffects.instantCraftChance > 0 && Math.random() < rebirthEffects.instantCraftChance) {
            // Instant craft - no cooldown, no notification
        } else {
            // Add cooldown - auto-craft only happens every 2 seconds (can be improved by automation lab and rebirth upgrades)
            const now = Date.now();
            if (!this.state.lastAutoCraftTime) {
                this.state.lastAutoCraftTime = 0;
            }
            
            // Automation Lab reduces cooldown: Base 2s, -200ms per level (max 1s at level 5+)
            const automationLab = this.state.city.automationLab || 0;
            let cooldown = Math.max(1000, 2000 - (automationLab * 200));
            
            // Apply automation speed multiplier from rebirth upgrades
            cooldown = cooldown / rebirthEffects.automationSpeedMultiplier;
            
            // Apply crafting speed from Quick Crafting rebirth upgrade
            cooldown = cooldown / rebirthEffects.craftingSpeed;
            
            // Apply cooldown reduction from Time Warp rebirth upgrade
            cooldown = cooldown * rebirthEffects.cooldownReduction;
            
            if (now - this.state.lastAutoCraftTime < cooldown) {
                return; // Still in cooldown
            }
            
            this.state.lastAutoCraftTime = now;
        }
        
        // Check which tiers are unlocked and try crafting from highest to lowest
        const tierUnlocks = {
            premium: this.state.unlock_autocraft_premium,
            advanced: this.state.unlock_autocraft_advanced,
            intermediate: this.state.unlock_autocraft_intermediate,
            basic: this.state.unlock_autocraft_basic
        };
        
        // Automation Lab increases crafts per cycle
        // Level 0: 1 craft, Level 1: 2 crafts, Level 2: 3 crafts, etc.
        const baseCraftsPerCycle = 1 + Math.floor((this.state.city.automationLab || 0) / 2);
        
        // Add extra crafts from rebirth upgrades
        const craftsPerCycle = baseCraftsPerCycle + rebirthEffects.extraAutoCrafts;
        
        const tiers = ['premium', 'advanced', 'intermediate', 'basic'];
        let craftsMade = 0;
        
        // Try to craft multiple items per cycle based on automation lab level and upgrades
        while (craftsMade < craftsPerCycle) {
            let craftedThisCycle = false;
            for (const tier of tiers) {
                if (tierUnlocks[tier] && this.craftItem(tier)) {
                    craftedThisCycle = true;
                    craftsMade++;
                    break; // Craft one, then check if we can craft more
                }
            }
            
            // If we couldn't craft anything this cycle, stop trying
            if (!craftedThisCycle) break;
        }
    }

    buildProcessor(processorType) {
        const costs = {
            smelter: 20,
            forge: 100,
            refinery: 500,
            mint: 2000,
            polisher: 50,
            coker: 150,
            chemPlant: 400,
            chipFab: 1200,
            jeweler: 900,
            assembly: 1600,
            autoPlant: 5000
        };
        
        // Map singular button names to plural state keys
        const stateKeyMap = {
            smelter: 'smelters',
            forge: 'forges',
            refinery: 'refineries',
            mint: 'mints',
            polisher: 'polishers',
            coker: 'cokers',
            chemPlant: 'chemPlants',
            chipFab: 'chipFabs',
            jeweler: 'jewelers',
            assembly: 'assemblies',
            autoPlant: 'autoPlants'
        };
        
        const baseCost = costs[processorType];
        const stateKey = stateKeyMap[processorType];
        
        if (!stateKey) {
            console.error(`Unknown processor type: ${processorType}`);
            return false;
        }
        
        // Apply building discount from rebirth upgrades
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { buildingDiscount: 1 };
        
        const cost = Math.ceil(baseCost * rebirthEffects.buildingDiscount);
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            // Use the plural state key
            this.state.processors[stateKey] = (this.state.processors[stateKey] || 0) + 1;
            
            this.playSound('build');
            this.flashElement('gold-amount');
            
            // Building construction celebration
            const btnMap = {
                smelter: 'build-smelter-btn', forge: 'build-forge-btn',
                refinery: 'build-refinery-btn', mint: 'build-mint-btn',
                polishers: 'build-polisher-btn', cokers: 'build-coker-btn',
                chemPlants: 'build-chemplant-btn', chipFabs: 'build-chipfab-btn',
                jewelers: 'build-jeweler-btn', assemblies: 'build-assembly-btn',
                autoPlants: 'build-autoplant-btn'
            };
            const btn = document.getElementById(btnMap[stateKey] || btnMap[processorType]);
            if (btn) {
                this.triggerPurchaseEffect(btnMap[stateKey] || btnMap[processorType]);
                this.spawnParticles(btn, '#a044ff', 8);
                this.spawnFloatingNumber(btn, `🏗️ Built!`, '#a044ff');
            }
            
            console.log(`Built ${processorType} (${stateKey}) for ${cost} gold`);
            return true;
        }
        return false;
    }
    
    hireTrader(traderType) {
        const baseCosts = {
            stoneTrader: 15,
            coalTrader: 75,
            metalTrader: 300
        };
        
        // Apply building discount from rebirth upgrades
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { buildingDiscount: 1 };
        
        const cost = Math.ceil(baseCosts[traderType] * rebirthEffects.buildingDiscount);
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            this.state.traders[traderType + 's']++;
            
            this.playSound('hire');
            this.flashElement('gold-amount');
            
            // Trader hire celebration
            const btnMap = {
                stoneTrader: 'hire-stone-trader-btn',
                coalTrader: 'hire-coal-trader-btn',
                metalTrader: 'hire-metal-trader-btn'
            };
            const btnId = btnMap[traderType];
            this.triggerPurchaseEffect(btnId);
            const btn = document.getElementById(btnId);
            if (btn) {
                this.spawnFloatingNumber(btn, `📊 -${this.formatNumber(cost)}g`, '#4facfe');
                this.spawnParticles(btn, '#00f2fe', 6);
            }
            
            console.log(`Hired ${traderType} for ${cost} gold`);
            return true;
        }
        return false;
    }
    
    buyTransport(transportType) {
        const baseCosts = {
            cart: 30,
            wagon: 150,
            train: 800
        };
        const emojis = { cart: '🛒', wagon: '🚛', train: '🚂' };
        
        // Apply building discount from rebirth upgrades
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { buildingDiscount: 1 };
        
        const cost = Math.ceil(baseCosts[transportType] * rebirthEffects.buildingDiscount);
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            this.state.transport[transportType + 's']++;
            
            this.playSound('build');
            this.flashElement('gold-amount');
            
            // Transport purchase with vehicle emoji
            const btnId = `buy-${transportType}-btn`;
            this.triggerPurchaseEffect(btnId);
            const btn = document.getElementById(btnId);
            if (btn) {
                this.spawnFloatingNumber(btn, `${emojis[transportType]} Bought!`, '#ff9a9e');
                this.spawnParticles(btn, '#fecfef', 8);
                if (transportType === 'train') this.triggerScreenShake(); // Trains are big!
            }
            
            console.log(`Bought ${transportType} for ${cost} gold`);
            return true;
        }
        return false;
    }
    
    hireService(serviceType) {
        // Apply building discount from rebirth upgrades
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { buildingDiscount: 1 };
        
        if (serviceType === 'police') {
            const currentPolice = this.state.city.police || 0;
            // Scale cost significantly since police generate decay progress (needed for rebirth)
            const cost = Math.ceil(5000 * Math.pow(1.25, currentPolice) * rebirthEffects.buildingDiscount); // 25% increase per hire
            if (this.state.resources.gold >= cost) {
                this.state.resources.gold -= cost;
                this.state.stats.totalGoldSpent += cost;
                this.state.city.police++;
                
                this.playSound('hire');
                this.flashElement('gold-amount');
                
                // Police hire celebration
                const policeBtn = document.getElementById('hire-police-btn');
                if (policeBtn) {
                    this.triggerPurchaseEffect('hire-police-btn');
                    this.spawnFloatingNumber(policeBtn, `🚔 Officer #${this.state.city.police}!`, '#4facfe');
                    this.spawnParticles(policeBtn, '#2196f3', 8);
                }
                
                console.log(`Hired security guard #${this.state.city.police} for ${cost} gold (upkeep: 0.5 gold/sec or 30 gold/min, generates decay)`);
                return true;
            }
        } else if (serviceType === 'politician') {
            const currentPoliticians = this.state.city.politicians || 0;
            const cost = Math.ceil(250 * Math.pow(1.05, currentPoliticians) * rebirthEffects.buildingDiscount);
            if (this.state.resources.gold >= cost) {
                this.state.resources.gold -= cost;
                this.state.stats.totalGoldSpent += cost;
                this.state.city.politicians++;
                this.playSound('hire');
                this.flashElement('gold-amount');
                
                // Politician hire celebration
                const politicianBtn = document.getElementById('hire-politician-btn');
                if (politicianBtn) {
                    this.triggerPurchaseEffect('hire-politician-btn');
                    this.spawnFloatingNumber(politicianBtn, `🏛️ Politician #${this.state.city.politicians}!`, '#ffecd2');
                    this.spawnParticles(politicianBtn, '#fcb69f', 6);
                }
                
                console.log(`Hired politician #${this.state.city.politicians} for ${cost} gold (reduces tax rate by 2% compound)`);
                return true;
            }
        }
        return false;
    }

    // Manual transport: move one best item based on value/weight
    transportNext() {
        // Get current theme item names and their values (for prioritization)
        const rebirths = this.state.city?.rebirths || 0;
        const theme = this.rebirthThemes?.getTheme(rebirths);
        
        const tierInfo = {
            premium: { 
                name: theme?.crafting?.premium?.result || 'Unicorn Startup',
                value: 120,
                priority: 4
            },
            advanced: { 
                name: theme?.crafting?.advanced?.result || 'Enterprise Product',
                value: 30,
                priority: 3
            },
            intermediate: { 
                name: theme?.crafting?.intermediate?.result || 'SaaS Platform',
                value: 9,
                priority: 2
            },
            basic: { 
                name: theme?.crafting?.basic?.result || 'Deployable App',
                value: 3,
                priority: 1
            }
        };
        
        // Sort tiers by priority (most expensive first)
        const sortedTiers = Object.keys(tierInfo).sort((a, b) => 
            tierInfo[b].priority - tierInfo[a].priority
        );
        
        // Find the first tier with available items that has transport enabled
        for (const tier of sortedTiers) {
            // Check if transport is enabled for this tier
            if (!this.state.autoTransport?.[tier]) continue;
            
            const craftedAmount = this.state.crafted?.[tier] || 0;
            if (craftedAmount > 0) {
                // Transport 1 item
                this.state.crafted[tier] -= 1;
                
                const itemName = tierInfo[tier].name;
                if (!this.state.cityInventory.finished[itemName]) {
                    this.state.cityInventory.finished[itemName] = 0;
                }
                this.state.cityInventory.finished[itemName] += 1;
                
                this.playSound('transport');
                
                // Transport visual - item flying from button
                const transportBtn = document.getElementById('transport-next-btn');
                if (transportBtn) {
                    this.spawnFloatingNumber(transportBtn, `📦 → 🏙️`, '#ff9a9e');
                }
                
                return true;
            }
        }
        
        return false; // Nothing to transport
    }

    // Sell one finished good currently in city inventory (best value by default)
    sellOneFinished(item = null) {
        if (!this.newResourceManager) return false;
        
        // Get current theme item names
        const rebirths = this.state.city?.rebirths || 0;
        const theme = this.rebirthThemes?.getTheme(rebirths);
        const themeItemNames = {
            'basic': theme?.crafting?.basic?.result || 'Deployable App',
            'intermediate': theme?.crafting?.intermediate?.result || 'SaaS Platform',
            'advanced': theme?.crafting?.advanced?.result || 'Enterprise Product',
            'premium': theme?.crafting?.premium?.result || 'Unicorn Startup'
        };
        
        // Define crafted items and their values using theme names
        const craftedItems = {};
        craftedItems[themeItemNames.basic] = { tier: 'basic', value: 3 };
        craftedItems[themeItemNames.intermediate] = { tier: 'intermediate', value: 9 };
        craftedItems[themeItemNames.advanced] = { tier: 'advanced', value: 30 };
        craftedItems[themeItemNames.premium] = { tier: 'premium', value: 120 };
        
        if (!item) {
            // pick best valued item in city inventory
            const inv = this.state.cityInventory?.finished || {};
            let best = null, bestVal = -Infinity;
            Object.keys(inv).forEach(k => {
                const amount = inv[k];
                if (amount > 0) {
                    // Check if it's a crafted item
                    if (craftedItems[k]) {
                        const val = craftedItems[k].value;
                        if (val > bestVal) { bestVal = val; best = k; }
                    } else {
                        // Check both processed and finished catalogs for value
                        const meta = this.newResourceManager.catalog.processed[k] || 
                                     this.newResourceManager.catalog.finished[k] || {};
                        const val = meta.value || 0;
                        if (val > bestVal) { bestVal = val; best = k; }
                    }
                }
            });
            item = best;
        }
        
        // Check if it's a crafted item
        if (item && craftedItems[item]) {
            const cityAmount = this.state.cityInventory?.finished?.[item] || 0;
            if (cityAmount < 1) return false;
            
            const craftInfo = craftedItems[item];
            const bankBonus = Math.pow(1.20, this.state.city.banks);
            
            // Get rebirth upgrade effects for gold multipliers
            const rebirthEffects = this.rebirthRewards ? 
                this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
                { goldMultiplier: 1, cosmicMultiplier: 1, sellingBonus: 1, transcendenceBonus: 1 };
            
            // Get arcade bonuses
            const arcadeBonuses = this.arcadeManager ? 
                this.arcadeManager.getArcadeBonuses() : 
                { goldBonus: 1 };
            
            let finalValue = craftInfo.value * bankBonus;
            finalValue *= rebirthEffects.goldMultiplier;
            finalValue *= rebirthEffects.cosmicMultiplier;
            finalValue *= rebirthEffects.sellingBonus;
            finalValue *= rebirthEffects.transcendenceBonus;
            finalValue *= arcadeBonuses.goldBonus;
            finalValue = Math.floor(finalValue);
            
            // Remove one from city
            this.state.cityInventory.finished[item] -= 1;
            
            // Note: don't touch this.state.crafted - those track factory items, not city items
            
            // Add gold
            this.state.resources.gold += finalValue;
            this.state.stats.totalGoldEarned += finalValue;
            
            this.playSound('sell');
            this.flashElement('gold-amount');
            return true;
        }
        
        // Use regular selling for non-crafted items
        const res = this.newResourceManager.sellOne(item);
        if (res.sold) {
            this.playSound('sell');
            this.flashElement('gold-amount');
            return true;
        }
        return false;
    }
    
    buildCity(buildingType) {
        // Define costs, proper state keys, and effect multipliers
        const buildingConfig = {
            bank: { cost: 500, stateKey: 'banks', effectMultiplier: 1.20 },  // 20% bonus per bank
            market: { cost: 1000, stateKey: 'markets', effectMultiplier: 1.15 },  // 15% bonus per market
            university: { cost: 2500, stateKey: 'universities', effectMultiplier: 1.10 },  // 10% bonus per university
            salesDepartment: { cost: 300, stateKey: 'salesDepartment', effectMultiplier: 1.5 },
            miningAcademy: { cost: 400, stateKey: 'miningAcademy', effectMultiplier: 1.15 },  // 15% bonus per level
            automationLab: { cost: 600, stateKey: 'automationLab', effectMultiplier: 1.5 }
        };
        
        const config = buildingConfig[buildingType];
        if (!config) return false;
        
        // Apply building discount from rebirth upgrades
        const rebirthEffects = this.rebirthRewards ? 
            this.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {}) : 
            { buildingDiscount: 1 };
        
        // Upgradable buildings (scaling costs)
        const upgradableBuildings = ['salesDepartment', 'miningAcademy', 'automationLab'];
        
        if (upgradableBuildings.includes(buildingType)) {
            const currentLevel = this.state.city[config.stateKey] || 0;
            const cost = Math.ceil(config.cost * Math.pow(config.effectMultiplier, currentLevel) * rebirthEffects.buildingDiscount);
            
            console.log(`${buildingType}: Current level ${currentLevel}, Cost: ${cost}, Gold: ${this.state.resources.gold}`);
            
            if (this.state.resources.gold >= cost) {
                this.state.resources.gold -= cost;
                this.state.stats.totalGoldSpent += cost;
                this.state.city[config.stateKey]++;
                
                this.playSound('build');
                this.flashElement('gold-amount');
                console.log(`✅ ${buildingType} upgraded! New level: ${this.state.city[config.stateKey]}`);
                
                // Upgradable building celebration with level callout
                const upgBtnMap = {
                    salesDepartment: 'build-sales-dept-btn',
                    miningAcademy: 'build-mining-academy-btn',
                    automationLab: 'build-automation-lab-btn'
                };
                const upgBtnId = upgBtnMap[buildingType];
                if (upgBtnId) {
                    this.triggerPurchaseEffect(upgBtnId);
                    const upgBtn = document.getElementById(upgBtnId);
                    if (upgBtn) {
                        this.spawnFloatingNumber(upgBtn, `⭐ Lvl ${this.state.city[config.stateKey]}!`, '#ffd700');
                        this.spawnParticles(upgBtn, '#ffecd2', 10);
                        if (this.state.city[config.stateKey] >= 3) this.triggerScreenShake();
                    }
                }
                
                // Apply efficiency bonuses
                this.updateRDLabsEfficiency();
                
                this.updateUI(); // Force UI update
                return true;
            }
            console.log(`❌ Not enough gold for ${buildingType} (need ${cost})`);
            return false;
        }
        
        // Regular buildings (bank, market, university) - now also scale with effect multiplier
        const currentLevel = this.state.city[config.stateKey] || 0;
        const cost = Math.ceil(config.cost * Math.pow(config.effectMultiplier, currentLevel) * rebirthEffects.buildingDiscount);
        
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            this.state.city[config.stateKey]++;
            
            this.playSound('build');
            this.flashElement('gold-amount');
            
            // Regular building construction celebration
            const cityBtnMap = {
                bank: 'build-bank-btn',
                market: 'build-market-btn',
                university: 'build-university-btn'
            };
            const cityBtnId = cityBtnMap[buildingType];
            if (cityBtnId) {
                this.triggerPurchaseEffect(cityBtnId);
                const cityBtn = document.getElementById(cityBtnId);
                if (cityBtn) {
                    const buildEmojis = { bank: '🏦', market: '🏪', university: '🎓' };
                    this.spawnFloatingNumber(cityBtn, `${buildEmojis[buildingType]} #${this.state.city[config.stateKey]}!`, '#fcb69f');
                    this.spawnParticles(cityBtn, '#ffecd2', 8);
                }
            }
            
            console.log(`Built ${buildingType} level ${this.state.city[config.stateKey]} for ${cost} gold (base: ${config.cost})`);
            return true;
        }
        return false;
    }
    
    purchaseResearch(researchType) {
        const costs = {
            mining: 50,
            automation: 50,
            processing: 100,
            logistics: 1000,
            quantum: 5000
        };
        
        const cost = costs[researchType];
        if (this.state.resources.gold >= cost && !this.state.research[researchType]) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            this.state.research[researchType] = true;
            
            // Apply research bonuses
            this.applyResearchBonus(researchType);
            
            // Hide the research button after purchasing
            const button = document.getElementById(`research-${researchType}-btn`);
            if (button) {
                button.style.setProperty('display', 'none', 'important');
            }
            
            this.playSound('research');
            this.flashElement('gold-amount');
            console.log(`Completed research: ${researchType} for ${cost} gold`);
            this.showNotification(`🔬 Research complete: ${researchType}!`);
            
            // Research completion celebration - feel the science!
            const resBtn = document.getElementById(`research-${researchType}-btn`);
            if (resBtn) {
                this.spawnParticles(resBtn, '#667eea', 15);
                this.spawnFloatingNumber(resBtn, `🧪 Eureka!`, '#667eea');
                this.triggerScreenShake();
                this.spawnConfetti(resBtn, 10);
                resBtn.classList.add('research-sparkle');
                setTimeout(() => resBtn.classList.remove('research-sparkle'), 800);
            }
            
            return true;
        }
        return false;
    }
    
    applyResearchBonus(researchType) {
        switch (researchType) {
            case 'mining':
                this.state.efficiency.mining *= 1.25;
                break;
            case 'processing':
                this.state.efficiency.processing *= 1.25;
                break;
            case 'automation':
                // Unlock auto-systems (handled in UI)
                break;
            case 'logistics':
                this.state.efficiency.transport *= 1.5;
                break;
            case 'quantum':
                // Quantum doubles everything: individual efficiencies AND global
                this.state.efficiency.mining *= 2.0;
                this.state.efficiency.processing *= 2.0;
                this.state.efficiency.trading *= 2.0;
                this.state.efficiency.transport *= 2.0;
                this.state.efficiency.global *= 2.0;
                break;
        }
    }
    
    // Rebirth Upgrade System
    purchaseRebirthUpgrade(upgradeKey) {
        if (!this.rebirthRewards) return false;
        
        const currentLevel = this.state.rebirthUpgrades[upgradeKey] || 0;
        const upgrade = this.rebirthRewards.rebirthUpgrades[upgradeKey];
        
        if (!upgrade) return false;
        
        // Check if max level reached
        if (currentLevel >= upgrade.maxLevel) {
            this.showNotification(`⚠️ ${upgrade.name} is already at max level!`);
            return false;
        }
        
        // Check if available
        const rebirthCount = this.state.city.rebirths || 0;
        if (rebirthCount < upgrade.minRebirths) {
            this.showNotification(`⚠️ Requires ${upgrade.minRebirths} rebirths to unlock!`);
            return false;
        }
        
        // Calculate cost
        const cost = this.rebirthRewards.getUpgradeCost(upgradeKey, currentLevel);
        
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            this.state.rebirthUpgrades[upgradeKey] = currentLevel + 1;
            
            this.playSound('research');
            this.flashElement('gold-amount');
            this.showNotification(`⭐ Upgraded ${upgrade.name} to Level ${currentLevel + 1}!`);
            
            // Rebirth upgrade celebration - extra dramatic
            const upgradeBtn = document.querySelector(`[data-upgrade="${upgradeKey}"]`);
            if (upgradeBtn) {
                this.spawnParticles(upgradeBtn, '#ffd700', 12);
                this.spawnFloatingNumber(upgradeBtn, `⭐ Lvl ${currentLevel + 1}!`, '#ffd700');
                this.triggerScreenShake();
                this.spawnConfetti(upgradeBtn, 8);
                this.triggerBuildAnimation(upgradeBtn.id);
            }
            
            // Update UI
            this.updateRebirthUpgradesUI();
            this.updateUI();
            
            console.log(`Purchased rebirth upgrade: ${upgradeKey} (Level ${currentLevel + 1})`);
            return true;
        } else {
            this.showNotification(`⚠️ Need ${cost} gold to upgrade ${upgrade.name}!`);
            return false;
        }
    }
    
    // Update rebirth upgrades UI
    updateRebirthUpgradesUI() {
        if (!this.rebirthRewards) return;
        
        const container = document.getElementById('rebirth-upgrades-container');
        if (!container) return;
        
        const rebirthCount = this.state.city.rebirths || 0;
        
        // Update rebirth power display
        const powerData = this.rebirthRewards.calculateRebirthPower(rebirthCount, this.state.rebirthUpgrades);
        const powerDisplay = document.getElementById('rebirth-power-value');
        const countDisplay = document.getElementById('rebirth-power-count');
        if (powerDisplay) {
            powerDisplay.textContent = `+${Math.round(powerData.totalPower * 100)}%`;
        }
        if (countDisplay) {
            countDisplay.textContent = rebirthCount.toString();
        }
        
        // Get available upgrades by tier
        const tiers = this.rebirthRewards.getUpgradesByTier(rebirthCount);
        
        // Clear container
        container.innerHTML = '';
        
        if (rebirthCount === 0) {
            container.innerHTML = `
                <p style="grid-column: 1 / -1; text-align: center; opacity: 0.7; padding: 20px;">
                    Complete your first rebirth to unlock permanent upgrades!
                </p>
            `;
            return;
        }
        
        // Render upgrades by tier
        for (let tier = 1; tier <= 9; tier++) {
            const tierUpgrades = tiers[tier];
            if (!tierUpgrades || tierUpgrades.length === 0) continue;
            
            // Add tier header
            const tierHeader = document.createElement('div');
            tierHeader.style.gridColumn = '1 / -1';
            tierHeader.style.marginTop = tier > 1 ? '20px' : '0';
            tierHeader.innerHTML = `<h3 style="margin: 10px 0; color: #fbbf24;">Tier ${tier} (Rebirth ${tier}+)</h3>`;
            container.appendChild(tierHeader);
            
            // Add upgrades in this tier
            tierUpgrades.forEach(({ key, ...upgrade }) => {
                const currentLevel = this.state.rebirthUpgrades[key] || 0;
                const cost = this.rebirthRewards.getUpgradeCost(key, currentLevel);
                const isMaxed = currentLevel >= upgrade.maxLevel;
                const canAfford = this.state.resources.gold >= cost;
                
                const button = document.createElement('button');
                button.className = 'action-btn research-btn';
                button.dataset.upgrade = key;
                button.style.position = 'relative';
                
                if (isMaxed) {
                    button.style.background = 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)';
                    button.style.border = '2px solid #22c55e';
                }
                
                // Get dynamic description based on current level
                const effectText = isMaxed 
                    ? this.rebirthRewards.getUpgradeDescription(key, currentLevel).replace(/Next:.*/, '').replace(/\|.*/, '').trim()
                    : this.rebirthRewards.getUpgradeDescription(key, currentLevel);
                const statusText = isMaxed ? 'MAX LEVEL' : `Level ${currentLevel}/${upgrade.maxLevel}`;
                
                button.innerHTML = `
                    <div class="btn-title">${upgrade.name}</div>
                    <div class="btn-cost">${isMaxed ? statusText : `Cost: ${cost} gold`}</div>
                    <div class="btn-description">${effectText}</div>
                    <div style="margin-top: 5px; font-size: 0.85em; opacity: 0.8;">${statusText}</div>
                `;
                
                if (!isMaxed) {
                    button.onclick = () => this.purchaseRebirthUpgrade(key);
                    if (!canAfford) {
                        button.style.opacity = '0.5';
                        button.style.cursor = 'not-allowed';
                    }
                } else {
                    button.style.cursor = 'default';
                }
                
                container.appendChild(button);
            });
        }
    }
    
    // Lightweight affordability update for rebirth upgrade buttons - runs every UI tick
    updateRebirthUpgradeAffordability() {
        if (!this.rebirthRewards) return;
        const container = document.getElementById('rebirth-upgrades-container');
        if (!container) return;
        
        const buttons = container.querySelectorAll('button[data-upgrade]');
        buttons.forEach(button => {
            const key = button.dataset.upgrade;
            if (!key) return;
            
            const upgrade = this.rebirthRewards.rebirthUpgrades[key];
            if (!upgrade) return;
            
            const currentLevel = this.state.rebirthUpgrades[key] || 0;
            const isMaxed = currentLevel >= upgrade.maxLevel;
            if (isMaxed) return; // Maxed buttons don't need affordability updates
            
            const cost = this.rebirthRewards.getUpgradeCost(key, currentLevel);
            const canAfford = this.state.resources.gold >= cost;
            
            button.style.opacity = canAfford ? '1' : '0.5';
            button.style.cursor = canAfford ? 'pointer' : 'not-allowed';
            
            // Also update the cost display in case level changed
            const costDiv = button.querySelector('.btn-cost');
            if (costDiv) {
                costDiv.textContent = `Cost: ${cost} gold`;
            }
        });
    }
    
    sellResource(resourceType) {
        const sellRates = {
            stone: 0.1,
            coal: 0.5,
            iron: 2.0,
            silver: 8.0
        };
        
        if (this.state.resources[resourceType] >= 1) {
            // Event-based sell multiplier
            const activeEffect = this.getActiveEventEffect ? this.getActiveEventEffect() : null;
            let eventSellMult = 1;
            if (activeEffect === 'doubleSellPrice')  eventSellMult = 2;
            if (activeEffect === 'tripleSellPrice')  eventSellMult = 3;
            if (activeEffect === 'coalBonus' && resourceType === 'coal') eventSellMult = 5;
            if (activeEffect === 'globalBoost')      eventSellMult = 1.5;

            // Soft cap on gold too
            const goldCapMult = this.softCapMultiplier(this.state.resources.gold);
            const goldEarned = sellRates[resourceType] * Math.pow(1.20, this.state.city.banks) * eventSellMult * goldCapMult;
            this.state.resources[resourceType] -= 1;
            this.state.resources.gold += goldEarned;
            this.state.stats.totalGoldEarned += goldEarned;
            
            this.playSound('sell');
            this.flashElement('gold-amount');
            
            // Floating gold earned indicator
            const goldEl = document.getElementById('gold-amount');
            if (goldEl) {
                this.spawnFloatingNumber(goldEl, `+${goldEarned.toFixed(1)} 💰`, '#ffd700');
                this.triggerGoldShimmer('gold-amount');
            }
            
            console.log(`Sold 1 ${resourceType} for ${goldEarned.toFixed(1)} gold`);
        }
    }
    
    rebirth() {
        // Get the effective max decay (scaled by rebirth count)
        const effectiveMaxDecay = this.state.city.adjustedMaxDecay || this.state.city.maxDecay;
        
        // Allow rebirth when decay is at or very close to max (handles floating point issues)
        // Using 99.5% threshold since UI rounds decay for display
        if (this.state.city.decay < (effectiveMaxDecay - 0.5)) {
            console.log(`Cannot rebirth: decay is ${this.state.city.decay.toFixed(1)}/${effectiveMaxDecay.toFixed(1)}`);
            this.showNotification(`City must reach 100% decay before rebirth! (${Math.round(this.state.city.decay)}/${Math.round(effectiveMaxDecay)})`);
            return false;
        }
        
        // Check if this is the final ending
        const currentRebirths = this.state.city.rebirths;
        if (this.rebirthThemes) {
            const currentTheme = this.rebirthThemes.getTheme(currentRebirths);
            
            if (currentTheme.isEnding) {
                // Handle game ending
                this.handleGameEnding();
                return true;
            }
        }
        
        // 🔒 REBIRTH LOCK: Prevent saves during rebirth process
        if (this.saveManager) {
            this.saveManager._isResetting = true;
        }
        
        // Calculate rebirth bonuses based on achievements
        const rebirthBonus = {
            mining: 0.05, // 5% bonus per rebirth
            processing: 0.05,
            trading: 0.03,
            transport: 0.03
        };
        
        // Store current data before reset
        const newRebirthCount = currentRebirths + 1;
        const savedEfficiency = { ...this.state.efficiency };
        const savedRebirthUpgrades = { ...this.state.rebirthUpgrades }; // Preserve rebirth upgrades!
        const savedAchievements = { ...this.state.achievements }; // Preserve achievements across rebirth
        const savedEventsTriggered = this.state.events?.eventsTriggered || 0; // Preserve event count
        
        console.log(`🔄 REBIRTH: Starting rebirth #${newRebirthCount}, preserving upgrades:`, savedRebirthUpgrades);
        
        // Hide any active event banner before reset
        this.hideEventBanner();
        
        // Reset game completely (including unlocks and research)
        this.state = this.getInitialState();
        
        // Restore enhanced efficiency
        this.state.efficiency = savedEfficiency;
        this.state.city.rebirths = newRebirthCount;
        this.state.rebirthUpgrades = savedRebirthUpgrades; // Restore rebirth upgrades!
        this.state.achievements = savedAchievements; // Restore achievements!
        this.state.events.eventsTriggered = savedEventsTriggered; // Restore event count!
        
        console.log(`🔄 REBIRTH: After reset, rebirth count is ${this.state.city.rebirths}`);
        
        // Apply starting gold bonus from rebirth upgrades
        if (this.rebirthRewards && savedRebirthUpgrades) {
            const effects = this.rebirthRewards.getActiveEffects(savedRebirthUpgrades);
            if (effects.startingGold > 0) {
                this.state.resources.gold += effects.startingGold;
                console.log(`💰 Starting gold bonus: +${effects.startingGold} gold`);
            }
            // Apply starting decay from Void Resistance upgrade
            if (effects.startingDecay > 0) {
                const effectiveMaxDecay = this.state.city.maxDecay * (1 + (newRebirthCount * 0.5));
                this.state.city.decay = Math.min(effectiveMaxDecay, effects.startingDecay);
                console.log(`🌀 Starting decay bonus: +${effects.startingDecay} decay`);
            }
        }
        
        // RESET efficiency multipliers to base 1.0 before applying rebirth bonuses
        // This prevents exponential growth from stacking multipliers
        this.state.efficiency.mining = 1.0;
        this.state.efficiency.processing = 1.0;
        this.state.efficiency.trading = 1.0;
        this.state.efficiency.transport = 1.0;
        this.state.efficiency.global = 1.0;
        
        // Now apply rebirth bonuses on clean base
        this.state.efficiency.mining *= (1 + rebirthBonus.mining);
        this.state.efficiency.processing *= (1 + rebirthBonus.processing);
        this.state.efficiency.trading *= (1 + rebirthBonus.trading);
        this.state.efficiency.transport *= (1 + rebirthBonus.transport);
        
        console.log(`🔄 Efficiency reset to base with rebirth bonuses: mining=${this.state.efficiency.mining}, processing=${this.state.efficiency.processing}`);
        
        // Safety check: Ensure gold is never negative after rebirth
        if (this.state.resources.gold < 0) {
            console.warn('⚠️ Rebirth resulted in negative gold, fixing to 10');
            this.state.resources.gold = 10;
        }
        
        // Update resource manager with new theme recipes
        if (this.newResourceManager) {
            this.newResourceManager.state = this.state;
            this.newResourceManager.updateThemeRecipes();
        }
        
        // Apply theme
        if (this.themeManager) {
            setTimeout(() => {
                this.themeManager.updateTheme();
            }, 100);
        }
        
        // Update rebirth upgrades UI
        if (this.rebirthRewards) {
            setTimeout(() => {
                this.updateRebirthUpgradesUI();
            }, 150);
        }
        
        this.playSound('prestige');
        this.showNotification(`🔄 Rebirth #${newRebirthCount} - A new chapter begins...`);
        this.triggerScreenShake();
        this.triggerScreenFlash();
        
        // Dramatic particle burst + confetti from center of screen
        const header = document.querySelector('.game-header');
        if (header) {
            this.spawnParticles(header, '#ffd700', 20);
            this.spawnParticles(header, '#ff416c', 15);
            this.spawnConfetti(header, 20);
        }
        
        console.log(`City rebirth completed! Total rebirths: ${newRebirthCount}`);
        
        // 🔓 REBIRTH UNLOCK: Release lock and force save the new state
        if (this.saveManager) {
            this.saveManager._isResetting = false;
            // Force save immediately to persist the rebirth
            setTimeout(() => {
                console.log('🔄 REBIRTH: Force-saving new rebirth state');
                this.saveManager.saveGame(null, true); // forceReset = true to bypass lock check
            }, 500);
        }
        
        return true;
    }
    
    handleGameEnding() {
        // Game has reached its final conclusion
        console.log('=== GAME ENDING ===');
        
        // Stop the game loop
        this.stop();
        
        // Show ending message
        const endingMessage = `
╔════════════════════════════════════════╗
║                                        ║
║        THE END                         ║
║                                        ║
║    You've journeyed through           ║
║    empires rising and falling,        ║
║    prosperity and poverty,            ║
║    hope and despair.                  ║
║                                        ║
║    In the end, you found peace.       ║
║                                        ║
║    Thank you for playing              ║
║    Industrial Empire                  ║
║                                        ║
╚════════════════════════════════════════╝
        `;
        
        console.log(endingMessage);
        
        // Visual ending
        if (this.themeManager) {
            this.themeManager.handleGameEnding();
        }
        
        // Show ending modal if available
        setTimeout(() => {
            const message = "The journey ends here.\n\n" +
                          "You've witnessed the rise and fall of empires,\n" +
                          "from tech giants to mere survival,\n" +
                          "and finally... to peace.\n\n" +
                          "Thank you for playing Industrial Empire.\n\n" +
                          "You may continue exploring, but there are no more rebirths.";
            
            alert(message);
            
            // Disable rebirth button
            const rebirthBtn = document.getElementById('rebirth-btn');
            if (rebirthBtn) {
                rebirthBtn.disabled = true;
                rebirthBtn.style.opacity = '0.5';
            }
        }, 1000);
    }
    
    // ═══════════════════════════════════
    //  SOFT CAP  - asymptotic 10 Trillion
    // ═══════════════════════════════════
    static SOFT_CAP = 1e13; // 10 Trillion

    /**
     * Diminishing-returns multiplier.  When amount << cap the multiplier is ~1.
     * As amount approaches the cap the multiplier drops toward 0.
     * Formula:  mult = cap / (cap + amount)
     * At 1T  → mult ≈ 0.91  (nearly full speed)
     * At 5T  → mult ≈ 0.67
     * At 10T → mult ≈ 0.50
     * At 50T → mult ≈ 0.17  (trickle)
     */
    softCapMultiplier(currentAmount) {
        if (currentAmount <= 0) return 1;
        return GameEngine.SOFT_CAP / (GameEngine.SOFT_CAP + currentAmount);
    }

    // ═══════════════════════════════════
    //  RANDOM EVENTS
    // ═══════════════════════════════════
    static EVENTS = [
        { id: 'trade_caravan',   emoji: '🐫', name: 'Trade Caravan',       desc: 'A travelling merchant doubles your sell prices!',       duration: 30, effect: 'doubleSellPrice' },
        { id: 'gold_rush',       emoji: '💰', name: 'Gold Rush',           desc: 'Workers find gold nuggets - +50% mining speed!',        duration: 25, effect: 'miningBoost' },
        { id: 'mine_collapse',   emoji: '⚠️', name: 'Mine Collapse',       desc: 'A tunnel collapsed! Mining slowed by 50% for a while.', duration: 20, effect: 'miningPenalty' },
        { id: 'market_boom',     emoji: '📈', name: 'Market Boom',         desc: 'Resource prices surge - sell now for 3× value!',        duration: 20, effect: 'tripleSellPrice' },
        { id: 'lucky_find',      emoji: '🍀', name: 'Lucky Find',          desc: 'Workers discovered a rich vein! Free bonus resources.', duration: 0,  effect: 'freeResources' },
        { id: 'tax_holiday',     emoji: '🎉', name: 'Tax Holiday',         desc: 'The government declared a tax holiday!',               duration: 45, effect: 'noTax' },
        { id: 'efficiency_wave', emoji: '⚡', name: 'Efficiency Wave',     desc: 'Everything runs faster for a short burst!',            duration: 30, effect: 'globalBoost' },
        { id: 'worker_strike',   emoji: '✊', name: 'Worker Strike',       desc: 'Workers demand better pay - production halved!',       duration: 15, effect: 'halfProduction' },
        { id: 'merchant_visit',  emoji: '🏪', name: 'Wandering Merchant',  desc: 'A merchant offers to buy coal at 5× price!',           duration: 20, effect: 'coalBonus' },
        { id: 'decay_storm',     emoji: '🌪️', name: 'Decay Storm',         desc: 'A surge of entropy - decay jumps forward!',            duration: 0,  effect: 'decayBoost' }
    ];

    checkRandomEvents(deltaTime) {
        if (!this.state.events) {
            this.state.events = { lastEventTime: 0, activeEvent: null, eventEndTime: 0, eventsTriggered: 0 };
        }
        const now = this.state.gameTime;
        const timeSinceLast = now - (this.state.events.lastEventTime || 0);
        // Events every 45-90 seconds on average
        const minInterval = 45;
        const chance = deltaTime / 90; // avg once per 90s

        // Expire active event
        if (this.state.events.activeEvent && now >= this.state.events.eventEndTime) {
            this.state.events.activeEvent = null;
            this.state.events.eventEndTime = 0;
            this.hideEventBanner();
        }

        if (timeSinceLast < minInterval) return;
        if (Math.random() > chance) return;

        // Pick a random event
        const event = GameEngine.EVENTS[Math.floor(Math.random() * GameEngine.EVENTS.length)];
        this.state.events.lastEventTime = now;
        this.state.events.eventsTriggered++;

        // Instant events
        if (event.effect === 'freeResources') {
            const bonus = 50 + Math.floor(Math.random() * 200);
            const res = ['stone', 'coal', 'iron', 'silver'][Math.floor(Math.random() * 4)];
            this.state.resources[res] += bonus;
            this.showNotification(`${event.emoji} ${event.name}: +${bonus} ${res}!`);
            return;
        }
        if (event.effect === 'decayBoost') {
            const boost = 5 + Math.random() * 15;
            const maxD = this.state.city.adjustedMaxDecay || this.state.city.maxDecay;
            this.state.city.decay = Math.min(maxD, this.state.city.decay + boost);
            this.showNotification(`${event.emoji} ${event.name}: +${boost.toFixed(0)} decay!`);
            return;
        }

        // Timed events
        this.state.events.activeEvent = event;
        this.state.events.eventEndTime = now + event.duration;
        this.showNotification(`${event.emoji} ${event.name}: ${event.desc} (${event.duration}s)`);
        this.showEventBanner(event);
    }

    getActiveEventEffect() {
        if (!this.state.events?.activeEvent) return null;
        if (this.state.gameTime >= this.state.events.eventEndTime) return null;
        return this.state.events.activeEvent.effect;
    }

    showEventBanner(event) {
        let banner = document.getElementById('event-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'event-banner';
            banner.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999;' +
                'background:linear-gradient(135deg,#2d1b69,#1a1a2e);color:#fff;padding:12px 24px;border-radius:12px;' +
                'box-shadow:0 8px 32px rgba(108,92,231,0.4);font-size:0.92rem;display:flex;align-items:center;gap:10px;' +
                'border:1px solid rgba(108,92,231,0.5);animation:eventSlide 0.4s ease;max-width:90vw;';
            document.body.appendChild(banner);
            // Inject animation
            if (!document.getElementById('event-anim-style')) {
                const s = document.createElement('style');
                s.id = 'event-anim-style';
                s.textContent = '@keyframes eventSlide{from{opacity:0;transform:translateX(-50%) translateY(-30px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}';
                document.head.appendChild(s);
            }
        }
        banner.innerHTML = `<span style="font-size:1.4rem">${event.emoji}</span><span><strong>${event.name}</strong> - ${event.desc}</span>`;
        banner.style.display = 'flex';
    }

    hideEventBanner() {
        const banner = document.getElementById('event-banner');
        if (banner) banner.style.display = 'none';
    }

    // ═══════════════════════════════════
    //  ACHIEVEMENTS
    // ═══════════════════════════════════
    static MILESTONES = [
        { id: 'stone_1k',     check: s => s.resources.stone >= 1000,             msg: '🪨 1,000 Stone - Quarry Master!' },
        { id: 'stone_1m',     check: s => s.resources.stone >= 1e6,              msg: '⛰️ 1M Stone - Mountain Mover!' },
        { id: 'gold_10k',     check: s => s.resources.gold >= 10000,             msg: '💰 10K Gold - Getting Rich!' },
        { id: 'gold_1m',      check: s => s.resources.gold >= 1e6,               msg: '🏦 1M Gold - Millionaire!' },
        { id: 'gold_1b',      check: s => s.resources.gold >= 1e9,               msg: '👑 1B Gold - Billionaire Tycoon!' },
        { id: 'workers_10',   check: s => (s.workers.stoneMiners + s.workers.coalMiners + s.workers.ironMiners + s.workers.silverMiners) >= 10, msg: '👷 10 Workers - Small Team!' },
        { id: 'workers_50',   check: s => (s.workers.stoneMiners + s.workers.coalMiners + s.workers.ironMiners + s.workers.silverMiners) >= 50, msg: '🏭 50 Workers - Corporation!' },
        { id: 'workers_200',  check: s => (s.workers.stoneMiners + s.workers.coalMiners + s.workers.ironMiners + s.workers.silverMiners) >= 200, msg: '🌐 200 Workers - Empire!' },
        { id: 'rebirth_1',    check: s => s.city.rebirths >= 1,                  msg: '🔄 First Rebirth - New Beginning!' },
        { id: 'rebirth_5',    check: s => s.city.rebirths >= 5,                  msg: '🔁 5 Rebirths - Cycle Master!' },
        { id: 'rebirth_10',   check: s => s.city.rebirths >= 10,                 msg: '♾️ 10 Rebirths - Eternal!' },
        { id: 'coal_unlock',  check: s => s.unlock_coal,                         msg: '🔓 Coal Unlocked - Deeper Mining!' },
        { id: 'iron_unlock',  check: s => s.unlock_iron,                         msg: '⚒️ Iron Unlocked - Industrial Age!' },
        { id: 'silver_unlock',check: s => s.unlock_silver,                       msg: '🥈 Silver Unlocked - Precious Metals!' },
        { id: 'event_5',      check: s => (s.events?.eventsTriggered || 0) >= 5, msg: '🎲 5 Events Survived!' },
        { id: 'event_20',     check: s => (s.events?.eventsTriggered || 0) >= 20,msg: '🎰 20 Events - Veteran!' },
        { id: 'iron_100k',    check: s => s.resources.iron >= 1e5,               msg: '⚙️ 100K Iron - Forge Lord!' },
        { id: 'silver_10k',   check: s => s.resources.silver >= 1e4,             msg: '🪙 10K Silver - Silver Baron!' }
    ];

    checkAchievements() {
        if (!this.state.achievements) this.state.achievements = {};

        const rebirths = this.state.city?.rebirths || 0;
        const currentTheme = this.rebirthThemes?.getCurrentTheme(this.state) || null;
        const chapterLabel = currentTheme
            ? `${currentTheme.name} · Chapter ${rebirths + 1}`
            : `Chapter ${rebirths + 1}`;

        for (const m of GameEngine.MILESTONES) {
            if (this.state.achievements[m.id]) continue;
            if (m.check(this.state)) {
                this.state.achievements[m.id] = {
                    unlockedAt: Date.now(),
                    rebirths,
                    theme: currentTheme?.name || null,
                    atmosphere: currentTheme?.atmosphere || null
                };
                this.showNotification(`${chapterLabel} · ${m.msg}`, 'achievement');
                this.playSound('hire'); // reuse celebration sound
            }
        }
    }

    // Utility methods
    formatNumber(num) {
        if (num < 1000) return Math.floor(num).toString();
        if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
        if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M';
        if (num < 1000000000000) return (num / 1000000000).toFixed(1) + 'B';
        return (num / 1000000000000).toFixed(1) + 'T';
    }
    
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
    
    flashElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('flash');
            setTimeout(() => element.classList.remove('flash'), 500);
        }
    }
    
    playSound(type) {
        // Web Audio API micro-sounds - no audio files needed
        try {
            if (!this._audioCtx) {
                this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this._audioCtx;
            if (ctx.state === 'suspended') ctx.resume();
            
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            const now = ctx.currentTime;
            gain.gain.setValueAtTime(0.08, now);
            
            switch (type) {
                case 'mine':
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(220, now);
                    osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    osc.start(now);
                    osc.stop(now + 0.12);
                    break;
                case 'sell':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523, now);
                    osc.frequency.exponentialRampToValueAtTime(784, now + 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    osc.start(now);
                    osc.stop(now + 0.15);
                    break;
                case 'hire':
                case 'research':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(330, now);
                    osc.frequency.exponentialRampToValueAtTime(660, now + 0.06);
                    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                    osc.start(now);
                    osc.stop(now + 0.18);
                    break;
                case 'build':
                    // Chunky thud - low saw wave with quick decay
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(120, now);
                    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
                    gain.gain.setValueAtTime(0.06, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                    osc.start(now);
                    osc.stop(now + 0.2);
                    break;
                case 'transport':
                    // Whoosh - rising square wave
                    osc.type = 'square';
                    gain.gain.setValueAtTime(0.04, now);
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    osc.start(now);
                    osc.stop(now + 0.15);
                    break;
                case 'prestige':
                    // Epic ascending triad
                    osc.type = 'sine';
                    gain.gain.setValueAtTime(0.07, now);
                    osc.frequency.setValueAtTime(262, now);
                    osc.frequency.setValueAtTime(330, now + 0.1);
                    osc.frequency.setValueAtTime(392, now + 0.2);
                    osc.frequency.setValueAtTime(523, now + 0.3);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                    osc.start(now);
                    osc.stop(now + 0.5);
                    break;
                default:
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    osc.start(now);
                    osc.stop(now + 0.1);
            }
        } catch (e) {
            // Audio not available - silently ignore
        }
    }
    
    autoSave() {
        // Only save if user is logged in
        if (!this.saveManager || !this.saveManager.isAuthenticated) {
            return; // Don't save or update UI if not logged in
        }
        
        // This would typically save to localStorage or API
        this.state.lastSave = Date.now();
        
        // Update save status indicator
        const saveStatus = document.getElementById('save-status');
        if (saveStatus) {
            saveStatus.textContent = 'Auto-saved';
            saveStatus.className = '';
            setTimeout(() => {
                saveStatus.textContent = 'Saved';
            }, 2000);
        }
        
        console.log('Game auto-saved');
    }
    
    // Save/Load methods (to be integrated with SaveManager)
    getSaveData() {
        return {
            ...this.state,
            version: '1.0.0',
            savedAt: Date.now()
        };
    }
    
    loadSaveData(saveData) {
        if (saveData && saveData.version) {
            // Deep merge save data with current state, preserving nested object structure
            const initial = this.getInitialState();
            for (const key of Object.keys(initial)) {
                if (saveData[key] !== undefined) {
                    if (typeof initial[key] === 'object' && initial[key] !== null && !Array.isArray(initial[key])) {
                        // Deep merge for nested objects - keep new properties from initial state
                        this.state[key] = { ...initial[key], ...saveData[key] };
                    } else {
                        this.state[key] = saveData[key];
                    }
                }
            }
            
            // Calculate offline progress if applicable
            if (saveData.lastSave) {
                const offlineTime = (Date.now() - saveData.lastSave) / 1000;
                this.calculateOfflineProgress(offlineTime);
            }
            
            // Re-initialize active systems
            if (this.newResourceManager) this.newResourceManager.state = this.state;
            
            console.log('Game loaded from save data');
            return true;
        }
        return false;
    }
    
    calculateOfflineProgress(offlineSeconds) {
        if (offlineSeconds > 60) {
            // Calculate offline stone production from miners
            const stoneMinerRate = (this.state.workers?.stoneMiners || 0) * 1 * this.state.efficiency.mining * this.state.efficiency.global;
            const coalMinerRate = (this.state.workers?.coalMiners || 0) * 0.5 * this.state.efficiency.mining * this.state.efficiency.global;
            const ironMinerRate = (this.state.workers?.ironMiners || 0) * 0.25 * this.state.efficiency.mining * this.state.efficiency.global;
            const silverMinerRate = (this.state.workers?.silverMiners || 0) * 0.1 * this.state.efficiency.mining * this.state.efficiency.global;
            
            // Apply 50% offline efficiency penalty
            const offlineEfficiency = 0.5;
            const stoneGained = stoneMinerRate * offlineSeconds * offlineEfficiency;
            const coalGained = coalMinerRate * offlineSeconds * offlineEfficiency;
            const ironGained = ironMinerRate * offlineSeconds * offlineEfficiency;
            const silverGained = silverMinerRate * offlineSeconds * offlineEfficiency;
            
            this.state.resources.stone += stoneGained;
            this.state.resources.coal += coalGained;
            this.state.resources.iron += ironGained;
            this.state.resources.silver += silverGained;
            
            const totalGained = stoneGained + coalGained + ironGained + silverGained;
            if (totalGained > 0) {
                this.showNotification(`⏰ Offline for ${this.formatTime(offlineSeconds)} - gained resources at 50% rate!`);
                console.log(`Offline for ${this.formatTime(offlineSeconds)}, gained ${Math.floor(stoneGained)} stone, ${Math.floor(coalGained)} coal, ${Math.floor(ironGained)} iron, ${Math.floor(silverGained)} silver`);
            }
        }
    }
    
    reset() {
        console.log('🔄 RESET: Starting game reset...');
        
        // Return a promise so UI can wait for completion
        return new Promise((resolve, reject) => {
            // Set reset flag to prevent auto-save interference
            if (this.saveManager) {
                this.saveManager._isResetting = true;
                console.log('🔒 RESET: Lock acquired, auto-save blocked');
            }
            
            this.stop();
            const freshState = this.getInitialState();
            
            // Set timestamp
            freshState.lastSave = Date.now();
            
            // CRITICAL: Immediately assign fresh state so save captures empty game
            this.state = freshState;
            
            // Reinitialize all managers with fresh state
            if (this.resourceManager) this.resourceManager.setState(this.state);
            if (this.upgradeSystem) this.upgradeSystem.setState(this.state);
            if (this.marketSystem) this.marketSystem.setState(this.state);
            if (this.newResourceManager) {
                this.newResourceManager.state = this.state;
                this.newResourceManager.updateThemeRecipes();
            }
            if (this.rebirthRewards) this.rebirthRewards.state = this.state;
            if (this.arcadeManager) {
                // Completely reset arcade - clear all progress
                this.state.arcade = {
                    unlockedGames: [],
                    playTime: {},
                    highScores: {},
                    totalPlayTime: 0,
                    activeGame: null,
                    gameStartTime: null
                };
                this.arcadeManager.state = this.state;
            }
            if (this.themeManager) {
                this.themeManager.updateTheme();
            }
            
            // Hide prestige panel
            const prestigePanel = document.getElementById('prestige-panel');
            if (prestigePanel) {
                prestigePanel.style.display = 'none';
            }
            
            // Hide any active event banner
            this.hideEventBanner();
            
            console.log('💾 RESET: Saving EMPTY state to server to overwrite old save...');
            console.log('🔍 RESET: Fresh state to save:', {
                gold: this.state.resources.gold,
                rebirths: this.state.city.rebirths,
                workers: this.state.workers,
                hasArcade: !!this.state.arcade
            });
            
            // CRITICAL: Save empty state to server BEFORE resolving promise
            // This prevents reload from loading old data
            if (this.saveManager) {
                this.saveManager.saveGame(this.state, true).then(() => {
                    // Release the lock after save completes
                    this.saveManager._isResetting = false;
                    console.log('🔓 RESET: Lock released after save');
                    console.log('✅ RESET: Empty state saved to server successfully!');
                    
                    this.start();
                    resolve(); // Resolve promise after successful save
                }).catch((error) => {
                    console.error('❌ RESET: Save failed:', error);
                    this.saveManager._isResetting = false;
                    console.log('🔓 RESET: Lock released (error)');
                    this.start();
                    reject(error); // Reject promise on error
                });
            } else {
                this.start();
                resolve(); // No save manager, just resolve
            }
        });
    }

    // Alias for UI compatibility
    resetGame() {
        return this.reset();
    }

    applyPrestigeBonus(target, cost) {
        // Prestige system not yet implemented - guard against missing state
        if (!this.state.prestige || !this.state.prestige.bonuses) {
            console.warn('Prestige system not available');
            this.showNotification('⚠️ Prestige system is not yet available.');
            return;
        }
        
        const bonusCosts = {
            'mining': Math.max(1, Math.floor(100 * Math.pow(2, this.state.prestige.bonuses.mining || 0))),
            'processing': Math.max(1, Math.floor(200 * Math.pow(2, this.state.prestige.bonuses.processing || 0))),
            'trading': Math.max(1, Math.floor(300 * Math.pow(2, this.state.prestige.bonuses.trading || 0))),
            'transport': Math.max(1, Math.floor(500 * Math.pow(2, this.state.prestige.bonuses.transport || 0))),
            'city': Math.max(1, Math.floor(1000 * Math.pow(2, this.state.prestige.bonuses.city || 0)))
        };

        if (this.state.prestige.points >= bonusCosts[target]) {
            this.state.prestige.points -= bonusCosts[target];
            this.state.prestige.bonuses[target] = (this.state.prestige.bonuses[target] || 0) + 1;
            
            // Apply the bonus effect
            switch(target) {
                case 'mining':
                    this.state.efficiency.mining *= 1.5;
                    break;
                case 'processing':
                    this.state.efficiency.processing *= 1.3;
                    break;
                case 'trading':
                    this.state.efficiency.trading *= 1.25;
                    break;
                case 'transport':
                    this.state.efficiency.transport *= 1.2;
                    break;
                case 'city':
                    this.state.efficiency.city *= 1.15;
                    break;
            }
            
            console.log(`Applied ${target} prestige bonus! New level: ${this.state.prestige.bonuses[target]}`);
        }
    }

    watchAdForDoubleResources() {
        const now = Date.now();
        if (this.state.ads.doubleResources.cooldown > now) {
            console.log('Ad still on cooldown');
            return false;
        }
        
        // Simulate ad viewing (in real implementation, this would trigger actual ad)
        this.simulateAdView(() => {
            this.state.ads.doubleResources.active = true;
            this.state.ads.doubleResources.endTime = now + 300000; // 5 minutes
            this.state.ads.doubleResources.cooldown = now + 900000; // 15 minute cooldown
            
            console.log('Double resources active for 5 minutes!');
            this.showNotification('🎉 Double Resources Active for 5 minutes!');
        });
        
        return true;
    }
    
    watchAdForResourceConversion() {
        const now = Date.now();
        if (this.state.ads.convertResources.cooldown > now) {
            console.log('Ad still on cooldown');
            return false;
        }
        
        this.simulateAdView(() => {
            // Convert all resources to gold at premium rates
            const stone = this.state.resources.stone;
            const coal = this.state.resources.coal;
            const iron = this.state.resources.iron;
            const silver = this.state.resources.silver;
            
            const goldGained = (stone * 0.2) + (coal * 1.0) + (iron * 4.0) + (silver * 16.0);
            
            this.state.resources.stone = 0;
            this.state.resources.coal = 0;
            this.state.resources.iron = 0;
            this.state.resources.silver = 0;
            this.state.resources.gold += goldGained;
            
            this.state.ads.convertResources.cooldown = now + 600000; // 10 minute cooldown
            
            console.log(`Converted all resources to ${goldGained.toFixed(1)} gold!`);
            this.showNotification(`💰 Converted resources to ${goldGained.toFixed(1)} gold!`);
        });
        
        return true;
    }
    
    watchAdForGoldBonus() {
        const now = Date.now();
        if (this.state.ads.goldBonus.cooldown > now) {
            console.log('Ad still on cooldown');
            return false;
        }
        
        this.simulateAdView(() => {
            this.state.resources.gold += 1000;
            this.state.ads.goldBonus.cooldown = now + 300000; // 5 minute cooldown
            
            console.log('Received 1000 gold bonus!');
            this.showNotification('💰 +1000 Gold Bonus!');
        });
        
        return true;
    }
    
    watchAdForEfficiencyBoost() {
        const now = Date.now();
        if (this.state.ads.efficiencyBoost.cooldown > now) {
            console.log('Ad still on cooldown');
            return false;
        }
        
        this.simulateAdView(() => {
            this.state.ads.efficiencyBoost.active = true;
            this.state.ads.efficiencyBoost.endTime = now + 600000; // 10 minutes
            this.state.ads.efficiencyBoost.cooldown = now + 1200000; // 20 minute cooldown
            
            console.log('Mining efficiency boost active for 10 minutes!');
            this.showNotification('⚡ +50% Mining Efficiency for 10 minutes!');
        });
        
        return true;
    }
    
    simulateAdView(rewardCallback) {
        // In a real implementation, this would integrate with AdMob or similar
        // For now, we'll simulate the ad viewing process
        console.log('🎥 Showing advertisement...');
        
        // Simulate ad display time (3 seconds for demo)
        setTimeout(() => {
            console.log('✅ Advertisement completed!');
            rewardCallback();
        }, 3000);
    }
    
    showNotification(message, tone = 'default') {
        // Simple notification system
        console.log(`📢 ${message}`);
        
        // Stack notifications - find existing ones and push them down
        const existingNotifs = document.querySelectorAll('.game-notification:not(.notification-exit)');
        existingNotifs.forEach((notif, i) => {
            const currentTop = parseInt(notif.style.top) || 20;
            notif.style.top = (currentTop + 70) + 'px';
        });
        
        const notification = document.createElement('div');
        notification.className = tone === 'achievement' ? 'game-notification achievement' : 'game-notification';
        notification.textContent = message;
        notification.style.top = '20px';
        notification.style.right = '20px';
        
        document.body.appendChild(notification);
        
        // Animate out then remove
        setTimeout(() => {
            notification.classList.add('notification-exit');
            setTimeout(() => notification.remove(), 300);
        }, 2700);
    }
    
    updateAdCooldowns() {
        const now = Date.now();
        
        // Update active effects
        if (this.state.ads.doubleResources.active && now > this.state.ads.doubleResources.endTime) {
            this.state.ads.doubleResources.active = false;
            this.showNotification('Double resources effect ended');
        }
        
        if (this.state.ads.efficiencyBoost.active && now > this.state.ads.efficiencyBoost.endTime) {
            this.state.ads.efficiencyBoost.active = false;
            this.showNotification('Efficiency boost ended');
        }
        
        // Update UI cooldown displays
        this.updateAdCooldownDisplays();
    }
    
    updateAdCooldownDisplays() {
        const now = Date.now();
        
        const updateCooldownDisplay = (id, cooldownTime) => {
            const element = document.getElementById(id);
            if (element) {
                if (cooldownTime > now) {
                    const remaining = Math.ceil((cooldownTime - now) / 1000);
                    const minutes = Math.floor(remaining / 60);
                    const seconds = remaining % 60;
                    element.textContent = `Cooldown: ${minutes}:${seconds.toString().padStart(2, '0')}`;
                } else {
                    element.textContent = 'Ready!';
                }
            }
        };
        
        updateCooldownDisplay('ad-double-cooldown', this.state.ads.doubleResources.cooldown);
        updateCooldownDisplay('ad-convert-cooldown', this.state.ads.convertResources.cooldown);
        updateCooldownDisplay('ad-gold-cooldown', this.state.ads.goldBonus.cooldown);
        updateCooldownDisplay('ad-efficiency-cooldown', this.state.ads.efficiencyBoost.cooldown);
    }

    // Save/Load System Integration
    async saveGame() {
        if (this.saveManager) {
            return await this.saveManager.saveGame();
        } else {
            this.showNotification('❌ Save system not available');
            return { success: false, message: 'Save system not available' };
        }
    }

    async loadGame() {
        if (this.saveManager) {
            return await this.saveManager.loadGame();
        } else {
            this.showNotification('❌ Save system not available');
            return { success: false, message: 'Save system not available' };
        }
    }

    async loginUser(username, password) {
        if (this.saveManager) {
            return await this.saveManager.login(username, password);
        } else {
            this.showNotification('❌ Save system not available');
            return { success: false, message: 'Save system not available' };
        }
    }

    async registerUser(username, password, email = '') {
        if (this.saveManager) {
            return await this.saveManager.register(username, password, email);
        } else {
            this.showNotification('❌ Save system not available');
            return { success: false, message: 'Save system not available' };
        }
    }

    logoutUser() {
        if (this.saveManager) {
            this.saveManager.logout();
        } else {
            this.showNotification('❌ Save system not available');
        }
    }

    async getLeaderboard() {
        if (this.saveManager) {
            return await this.saveManager.getLeaderboard();
        } else {
            return [];
        }
    }

    prestigeTier() {
        const points = this.state.prestige?.points || 0;
        if (points >= 100) return 'Legendary';
        if (points >= 50) return 'Epic';
        if (points >= 20) return 'Rare';
        if (points >= 5) return 'Uncommon';
        return 'Common';
    }

    // ============================================
    // ANIMATION & VISUAL FEEDBACK METHODS
    // ============================================

    /**
     * Spawn a floating number near an element (e.g. "+1", "-5 💰")
     */
    spawnFloatingNumber(element, text, color) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const el = document.createElement('div');
        el.className = 'floating-number';
        el.textContent = text;
        el.style.color = color || '#64ffda';
        // Place slightly above the element with some random horizontal jitter
        const jitterX = (Math.random() - 0.5) * 30;
        el.style.left = (rect.left + rect.width / 2 + jitterX - 20) + 'px';
        el.style.top = (rect.top - 5) + 'px';
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }

    /**
     * Spawn a click ripple inside a button from click position
     */
    spawnClickRipple(button, event) {
        if (!button) return;
        const ripple = document.createElement('div');
        ripple.className = 'click-ripple';
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        
        // Position ripple at click point or center
        let x, y;
        if (event) {
            x = event.clientX - rect.left - size / 2;
            y = event.clientY - rect.top - size / 2;
        } else {
            x = rect.width / 2 - size / 2;
            y = rect.height / 2 - size / 2;
        }
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        button.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
    }

    /**
     * Quick micro-shake on the mine button after clicking
     */
    triggerMineShake(element) {
        if (!element) return;
        element.classList.remove('mine-click-shake');
        // Force reflow to restart animation
        void element.offsetWidth;
        element.classList.add('mine-click-shake');
        setTimeout(() => element.classList.remove('mine-click-shake'), 150);
    }

    /**
     * Spawn colored particles bursting out of an element
     */
    spawnParticles(element, color, count) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        
        for (let i = 0; i < (count || 6); i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.background = color || '#64ffda';
            p.style.left = cx + 'px';
            p.style.top = cy + 'px';
            
            // Random direction
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
            const dist = 30 + Math.random() * 50;
            p.style.setProperty('--px', Math.cos(angle) * dist + 'px');
            p.style.setProperty('--py', Math.sin(angle) * dist + 'px');
            p.style.width = (3 + Math.random() * 5) + 'px';
            p.style.height = p.style.width;
            
            document.body.appendChild(p);
            p.addEventListener('animationend', () => p.remove());
        }
    }

    /**
     * Trigger a green flash on a button after a successful purchase
     */
    triggerPurchaseEffect(buttonId) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        btn.classList.remove('purchase-success');
        void btn.offsetWidth;
        btn.classList.add('purchase-success');
        setTimeout(() => btn.classList.remove('purchase-success'), 500);
    }

    /**
     * Gold shimmer animation on a resource value element
     */
    triggerGoldShimmer(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.classList.remove('gold-earned');
        void el.offsetWidth;
        el.classList.add('gold-earned');
        setTimeout(() => el.classList.remove('gold-earned'), 600);
    }

    /**
     * Subtle screen shake for big events (unlocks, rebirths)
     */
    triggerScreenShake() {
        const container = document.getElementById('game-container');
        if (!container) return;
        container.classList.remove('screen-shake');
        void container.offsetWidth;
        container.classList.add('screen-shake');
        setTimeout(() => container.classList.remove('screen-shake'), 300);
    }

    /**
     * Full-screen golden flash for huge moments
     */
    triggerScreenFlash(color) {
        const flash = document.createElement('div');
        flash.className = 'screen-flash';
        if (color) flash.style.setProperty('background', color);
        document.body.appendChild(flash);
        flash.addEventListener('animationend', () => flash.remove());
    }

    /**
     * Spawn confetti-like emoji particles for celebrations
     */
    spawnConfetti(element, count) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const emojis = ['✨', '⭐', '🎉', '💫', '🌟', '🎊', '💎', '🏆'];
        
        for (let i = 0; i < (count || 8); i++) {
            const c = document.createElement('div');
            c.className = 'confetti';
            c.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            c.style.left = (cx + (Math.random() - 0.5) * 40) + 'px';
            c.style.top = (cy - 10) + 'px';
            c.style.setProperty('--cx', ((Math.random() - 0.5) * 200) + 'px');
            c.style.setProperty('--cy', (Math.random() * -150 - 50) + 'px');
            c.style.setProperty('--cr', (Math.random() * 720 - 360) + 'deg');
            c.style.animationDelay = (Math.random() * 0.15) + 's';
            document.body.appendChild(c);
            c.addEventListener('animationend', () => c.remove());
        }
    }

    /**
     * Display a large floating gold number for big sales
     */
    spawnBigGoldNumber(text) {
        const goldEl = document.getElementById('gold-amount');
        if (!goldEl) return;
        const rect = goldEl.getBoundingClientRect();
        const el = document.createElement('div');
        el.className = 'big-gold-number';
        el.textContent = text;
        el.style.left = (rect.left + rect.width / 2 - 60) + 'px';
        el.style.top = (rect.top - 10) + 'px';
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }

    /**
     * Bounce a worker/building count element when it changes
     */
    bounceElement(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.classList.remove('worker-hired');
        void el.offsetWidth;
        el.classList.add('worker-hired');
        setTimeout(() => el.classList.remove('worker-hired'), 400);
    }

    /**
     * Building construction animation on a button
     */
    triggerBuildAnimation(buttonId) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        btn.classList.remove('building-construct');
        void btn.offsetWidth;
        btn.classList.add('building-construct');
        setTimeout(() => btn.classList.remove('building-construct'), 600);
    }

    /**
     * Track rapid clicks and show a combo counter
     */
    trackCombo() {
        const now = Date.now();
        if (!this._comboCount) this._comboCount = 0;
        if (!this._lastMineClick) this._lastMineClick = 0;
        
        // Reset combo if more than 800ms between clicks
        if (now - this._lastMineClick > 800) {
            this._comboCount = 0;
        }
        this._lastMineClick = now;
        this._comboCount++;
        
        // Show combo indicator for streaks of 5+
        if (this._comboCount >= 5 && this._comboCount % 3 === 0) {
            const btn = document.getElementById('mine-stone-btn');
            if (btn) {
                const rect = btn.getBoundingClientRect();
                
                // Remove old combo indicator
                const oldCombo = document.querySelector('.combo-indicator');
                if (oldCombo) oldCombo.remove();
                
                const combo = document.createElement('div');
                combo.className = 'combo-indicator';
                combo.textContent = `🔥 x${this._comboCount}`;
                combo.style.left = (rect.left + rect.width / 2 - 30) + 'px';
                combo.style.top = (rect.top - 40) + 'px';
                
                // Scale up with combo
                const scale = Math.min(1.5, 1 + this._comboCount * 0.02);
                combo.style.transform = `scale(${scale})`;
                
                document.body.appendChild(combo);
                setTimeout(() => combo.remove(), 1500);
            }
        }
    }

    /**
     * Add per-second income indicators to resource items in the header
     */
    updateIncomeIndicators() {
        const resources = ['stone', 'coal', 'iron', 'silver', 'gold'];
        
        resources.forEach(res => {
            const resourceItem = document.querySelector(`.resource-item.${res}`);
            if (!resourceItem) return;
            
            // Calculate income per second for this resource
            let perSec = 0;
            if (res === 'stone') perSec = this.state.workers.stoneMiners || 0;
            else if (res === 'coal') perSec = this.state.workers.coalMiners || 0;
            else if (res === 'iron') perSec = this.state.workers.ironMiners || 0;
            else if (res === 'silver') perSec = this.state.workers.silverMiners || 0;
            
            // Only show if there's meaningful income
            if (perSec <= 0 && res !== 'gold') return;
            
            let indicator = resourceItem.querySelector('.idle-income-indicator');
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.className = 'idle-income-indicator positive';
                resourceItem.style.position = 'relative';
                resourceItem.appendChild(indicator);
            }
            
            if (perSec > 0) {
                indicator.textContent = `+${this.formatNumber(perSec)}/s`;
                indicator.className = 'idle-income-indicator positive';
            }
        });
    }
}

// Export for use in other modules
window.GameEngine = GameEngine;