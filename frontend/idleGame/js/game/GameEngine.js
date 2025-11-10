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
                penaltyProcessing: 1.0
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
                }
            },
            
            // Efficiency multipliers
            efficiency: {
                mining: 1.0,
                processing: 1.0,
                trading: 1.0,
                transport: 1.0,
                global: 1.0
            },
            
            // Game time
            gameTime: 0,
            offlineTime: 0,
            lastSave: Date.now()
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
        
        // 🛡️ SAFETY: Ensure gold never goes negative during gameplay
        if (this.state.resources.gold < 0) {
            console.warn('⚠️ Gold went negative during tick:', this.state.resources.gold, '- fixing to 0');
            this.state.resources.gold = 0;
        }
        
        // Update UI periodically (not every tick for performance)
        if (now - this.lastUIUpdate > this.uiUpdateRate) {
            this.updateUI();
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
        
        // Sell ALL items in city at once
        const inv = this.state.cityInventory?.finished || {};
        let itemsSold = 0;
        for (const k in inv) { 
            while (inv[k] > 0) { 
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
        // Each lab adds +10% to global efficiency AND market efficiency
        const labs = this.state.city.universities || 0;
        const baseEfficiency = 1.0;
        const rdBonus = labs * 0.10; // 10% per lab
        
        // Markets boost trading efficiency (+15% per market)
        const markets = this.state.city.markets || 0;
        const marketBonus = markets * 0.15; // 15% per market
        
        // Politicians boost trading efficiency (+5% per politician)
        const politicians = this.state.city.politicians || 0;
        const politicianBonus = politicians * 0.05; // 5% per politician
        
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
        // Base efficiency from global and mining
        let efficiency = this.state.efficiency.mining * this.state.efficiency.global;
        
        // Apply Mining Academy bonus (+15% per level)
        const miningAcademy = this.state.city.miningAcademy || 0;
        if (miningAcademy > 0) {
            efficiency *= (1 + miningAcademy * 0.15);
        }
        
        // Apply ad bonuses
        if (this.state.ads.efficiencyBoost.active) {
            efficiency *= 1.5; // +50% from ad boost
        }
        
        // Stone mining
        let stoneProduced = this.state.workers.stoneMiners * efficiency * deltaTime;
        
        // Apply double resources bonus
        if (this.state.ads.doubleResources.active) {
            stoneProduced *= 2;
        }
        
        this.state.resources.stone += stoneProduced;
        this.state.stats.totalResourcesMined.stone += stoneProduced;
        this.state.production.stone = this.state.workers.stoneMiners * efficiency;
        
        // Coal mining (direct)
        let coalProduced = this.state.workers.coalMiners * efficiency * deltaTime;
        if (this.state.ads.doubleResources.active) coalProduced *= 2;
        this.state.resources.coal += coalProduced;
        this.state.stats.totalResourcesMined.coal += coalProduced;
        this.state.production.coal = this.state.workers.coalMiners * efficiency;
        
        // Iron mining (direct)
        let ironProduced = this.state.workers.ironMiners * efficiency * deltaTime;
        if (this.state.ads.doubleResources.active) ironProduced *= 2;
        this.state.resources.iron += ironProduced;
        this.state.stats.totalResourcesMined.iron += ironProduced;
        
        // Silver mining (direct)
        let silverProduced = this.state.workers.silverMiners * efficiency * deltaTime;
        if (this.state.ads.doubleResources.active) silverProduced *= 2;
        this.state.resources.silver += silverProduced;
        this.state.stats.totalResourcesMined.silver += silverProduced;
    }
    
    updateProcessingProduction(deltaTime) {
        // Apply per-tick transport penalty to processing efficiency
        const penaltyProcessing = (this.state.transport && this.state.transport.penaltyProcessing) ? this.state.transport.penaltyProcessing : 1.0;
        const efficiency = this.state.efficiency.processing * penaltyProcessing * this.state.efficiency.global;
        
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
        const efficiency = this.state.efficiency.trading * penaltyTrading * (1 - corruption) * this.state.efficiency.global;
        
        // Auto-sell stone
        const stoneToSell = Math.min(
            this.state.traders.stoneTraders * 2 * efficiency * deltaTime,
            this.state.resources.stone
        );
        if (stoneToSell > 0) {
            this.state.resources.stone -= stoneToSell;
            const goldEarned = stoneToSell * 0.1 * (1 + this.state.city.banks * 0.2);
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
            const goldEarned = coalToSell * 0.5 * (1 + this.state.city.banks * 0.2);
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
            const goldEarned = ironToSell * 2 * (1 + this.state.city.banks * 0.2);
            this.state.resources.gold += goldEarned;
            this.state.stats.totalGoldEarned += goldEarned;
        }
        
        const silverToSell = Math.min(
            this.state.traders.metalTraders * 0.3 * efficiency * deltaTime,
            this.state.resources.silver
        );
        if (silverToSell > 0) {
            this.state.resources.silver -= silverToSell;
            const goldEarned = silverToSell * 8 * (1 + this.state.city.banks * 0.2);
            this.state.resources.gold += goldEarned;
            this.state.stats.totalGoldEarned += goldEarned;
        }
    }
    
    updateCityServices(deltaTime) {
        // Police cost gold per second but reduce corruption
        // Changed from 50 to 0.5 gold/sec (30 gold/min per police officer)
        const policeCost = this.state.city.police * 0.5 * deltaTime;
        if (this.state.resources.gold >= policeCost) {
            this.state.resources.gold -= policeCost;
            this.state.stats.totalGoldSpent += policeCost;
            this.state.city.corruption = Math.max(0, this.state.city.corruption - 1 * deltaTime);
        } else {
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
        
        // City decay system - REDESIGNED
        // Decay is ONLY generated by Security Guards (police), NOT by passive city growth
        // This makes reaching 100% decay much harder and requires active investment
        
        // Only Security Guards generate decay
        const decayGeneration = (this.state.city.police || 0) * 0.5; // Each guard generates 0.5 decay per second
        
        // Scale decay requirement with rebirths (each rebirth increases the challenge)
        const rebirthMultiplier = 1 + (this.state.city.rebirths * 0.5); // +50% per rebirth
        const adjustedMaxDecay = this.state.city.maxDecay * rebirthMultiplier;
        
        // Apply decay generation
        if (decayGeneration > 0) {
            this.state.city.decay = Math.min(adjustedMaxDecay, 
                this.state.city.decay + decayGeneration * deltaTime);
        }
        
        // Store adjusted max for UI display
        this.state.city.adjustedMaxDecay = adjustedMaxDecay;
        
        // Apply taxes on gold income (reduced by politicians)
        const taxReduction = this.state.city.politicians * 0.02; // 2% reduction per politician
        const effectiveTaxRate = Math.max(0, this.state.city.taxRate - taxReduction);
        
        // Track gold earned this tick for tax calculation
        const goldEarnedThisTick = this.state.stats.totalGoldEarned - (this.lastGoldEarned || 0);
        if (goldEarnedThisTick > 0) {
            const taxAmount = goldEarnedThisTick * effectiveTaxRate;
            this.state.resources.gold -= taxAmount;
            this.state.stats.totalTaxesPaid += taxAmount;
        }
        this.lastGoldEarned = this.state.stats.totalGoldEarned;
    }
    
    updateTransport() {
        // Calculate total transport capacity (reduced for better balance)
        const capacity = 
            this.state.transport.carts * 1 +      // Was 10, now 1
            this.state.transport.wagons * 5 +     // Was 50, now 5
            this.state.transport.trains * 20;     // Was 200, now 20
            
        this.state.transport.capacity = capacity * this.state.efficiency.transport;
        
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
        const bankBonusPct = this.state.city.banks * 20; // 20% per bank
        this.updateElement('bank-bonus-display', `+${bankBonusPct}%`);
        
        // Update sales department with level and interval info
        const salesDept = this.state.city.salesDepartment || 0;
        const interval = salesDept > 0 ? Math.max(5, 60 - (salesDept - 1) * 10) : 0;
        const salesSpeed = salesDept > 0 ? `Level ${salesDept} (sells all every ${interval}s)` : 'Level 0';
        this.updateElement('sales-dept-count', salesSpeed);
        
        // Update mining academy display
        const miningAcademy = this.state.city.miningAcademy || 0;
        const miningBonus = miningAcademy * 15; // 15% per level
        const miningText = miningAcademy > 0 ? `Level ${miningAcademy} (+${miningBonus}% gathering)` : 'Level 0';
        this.updateElement('mining-academy-count', miningText);
        
        // Update automation lab display
        const automationLab = this.state.city.automationLab || 0;
        const craftSpeed = automationLab > 0 ? `Level ${automationLab} (${automationLab + 1}x speed)` : 'Level 0';
        this.updateElement('automation-lab-count', craftSpeed);
        
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
    }
    
    updateButtonStates() {
        // Mining buttons (check both gold cost AND unlock status)
        this.updateButtonState('mine-stone-btn', true); // Always available
        this.updateButtonState('hire-stone-miner-btn', this.state.resources.gold >= 5);
        this.updateButtonState('hire-coal-miner-btn', this.state.resources.gold >= 25 && this.state.unlock_coal);
        this.updateButtonState('hire-iron-miner-btn', this.state.resources.gold >= 100 && this.state.unlock_iron);
        this.updateButtonState('hire-silver-miner-btn', this.state.resources.gold >= 500 && this.state.unlock_silver);
        
    // Processing buttons (gated by unlocks)
    this.updateButtonState('build-smelter-btn', this.state.resources.gold >= 20 && this.state.unlock_processing);
    this.updateButtonState('build-forge-btn', this.state.resources.gold >= 100 && this.state.unlock_processing);
    this.updateButtonState('build-refinery-btn', this.state.resources.gold >= 500 && this.state.unlock_processing);
    this.updateButtonState('build-mint-btn', this.state.resources.gold >= 2000 && this.state.unlock_processing);
    this.updateButtonState('build-polisher-btn', this.state.resources.gold >= 50 && this.state.unlock_processing);
    this.updateButtonState('build-coker-btn', this.state.resources.gold >= 150 && this.state.unlock_processing);
    this.updateButtonState('build-chemplant-btn', this.state.resources.gold >= 400 && this.state.unlock_oil);
    this.updateButtonState('build-chipfab-btn', this.state.resources.gold >= 1200 && this.state.unlock_electronics);
    this.updateButtonState('build-jeweler-btn', this.state.resources.gold >= 900 && this.state.unlock_jewelry);
    this.updateButtonState('build-assembly-btn', this.state.resources.gold >= 1600 && this.state.unlock_electronics);
    this.updateButtonState('build-autoplant-btn', this.state.resources.gold >= 5000 && this.state.unlock_automotive);
        
        // Market buttons
        this.updateButtonState('sell-stone-btn', this.state.resources.stone >= 1);
        this.updateButtonState('sell-coal-btn', this.state.resources.coal >= 1);
        this.updateButtonState('sell-iron-btn', this.state.resources.iron >= 1);
        this.updateButtonState('sell-silver-btn', this.state.resources.silver >= 1);
        this.updateButtonState('hire-stone-trader-btn', this.state.resources.gold >= 15);
        this.updateButtonState('hire-coal-trader-btn', this.state.resources.gold >= 75);
        this.updateButtonState('hire-metal-trader-btn', this.state.resources.gold >= 300);
        
        // Transport buttons
        this.updateButtonState('buy-cart-btn', this.state.resources.gold >= 30);
        this.updateButtonState('buy-wagon-btn', this.state.resources.gold >= 150);
        this.updateButtonState('buy-train-btn', this.state.resources.gold >= 800);
        
        // City buttons
        this.updateButtonState('hire-police-btn', this.state.resources.gold >= 5000);
        this.updateButtonState('hire-politician-btn', this.state.resources.gold >= 250);
        this.updateButtonState('build-bank-btn', this.state.resources.gold >= 500);
        this.updateButtonState('build-market-btn', this.state.resources.gold >= 1000);
        this.updateButtonState('build-university-btn', this.state.resources.gold >= 2500);
        
        // Sales department button - dynamic cost based on level
        const salesDeptLevel = this.state.city.salesDepartment || 0;
        const salesDeptCost = 300 * Math.pow(1.5, salesDeptLevel);
        this.updateElement('sales-dept-cost', Math.floor(salesDeptCost).toString());
        this.updateButtonState('build-sales-dept-btn', this.state.resources.gold >= salesDeptCost);
        
        // Update button text based on level
        const salesBtn = document.getElementById('build-sales-dept-btn');
        if (salesBtn) {
            const titleDiv = salesBtn.querySelector('.btn-title');
            if (titleDiv) {
                titleDiv.textContent = salesDeptLevel === 0 ? 'Build Sales Bot' : `Upgrade Sales Bot (Lv ${salesDeptLevel})`;
            }
        }
        
        // Mining Academy button - dynamic cost based on level
        const miningAcademyLevel = this.state.city.miningAcademy || 0;
        const miningAcademyCost = 400 * Math.pow(1.5, miningAcademyLevel);
        this.updateElement('mining-academy-cost', Math.floor(miningAcademyCost).toString());
        this.updateButtonState('build-mining-academy-btn', this.state.resources.gold >= miningAcademyCost);
        
        const miningAcademyBtn = document.getElementById('build-mining-academy-btn');
        if (miningAcademyBtn) {
            const titleDiv = miningAcademyBtn.querySelector('.btn-title');
            if (titleDiv && window.rebirthThemes) {
                const theme = window.rebirthThemes.getCurrentTheme();
                const themeName = theme.city.miningAcademy.name;
                titleDiv.textContent = miningAcademyLevel === 0 ? `Build ${themeName}` : `Upgrade ${themeName} (Lv ${miningAcademyLevel})`;
            }
        }
        
        // Automation Lab button - dynamic cost based on level
        const automationLabLevel = this.state.city.automationLab || 0;
        const automationLabCost = 600 * Math.pow(1.5, automationLabLevel);
        this.updateElement('automation-lab-cost', Math.floor(automationLabCost).toString());
        this.updateButtonState('build-automation-lab-btn', this.state.resources.gold >= automationLabCost);
        
        const automationLabBtn = document.getElementById('build-automation-lab-btn');
        if (automationLabBtn) {
            const titleDiv = automationLabBtn.querySelector('.btn-title');
            if (titleDiv && window.rebirthThemes) {
                const theme = window.rebirthThemes.getCurrentTheme();
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
        
        // Hide the unlock button after purchasing
        const button = document.querySelector(`[data-unlock="${key}"]`);
        if (button) {
            button.style.setProperty('display', 'none', 'important');
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
    
    // Action handlers
    mineStone() {
        // Manual stone collection - gives 1 stone per click
        this.state.resources.stone += 1;
        this.state.stats.totalResourcesMined.stone += 1;
        
        this.playSound('mine');
        this.flashElement('stone-amount');
        
        console.log('Mined 1 stone manually');
    }
    
    hireWorker(workerType) {
        const costs = {
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
        
        const cost = costs[workerType];
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            this.state.workers[workerType + 's']++;
            
            this.playSound('hire');
            this.flashElement('gold-amount');
            console.log(`Hired ${workerType} for ${cost} gold`);
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
        
        // Consume resources
        for (const [resource, amount] of Object.entries(recipe.requires)) {
            if (resource === 'basic' || resource === 'intermediate' || resource === 'advanced' || resource === 'premium') {
                this.state.crafted[resource] -= amount;
            } else {
                this.state.resources[resource] -= amount;
                this.flashElement(`${resource}-amount`);
            }
        }
        
        // Produce crafted item - mark for transport in factory finished inventory
        this.state.crafted[recipe.produces] = (this.state.crafted[recipe.produces] || 0) + recipe.amount;
        
        // Mark item for transport in factory finished inventory
        if (this.state.factory && this.state.factory.finished) {
            const itemName = recipe.producesItem;
            this.state.factory.finished[itemName] = (this.state.factory.finished[itemName] || 0) + recipe.amount;
        }
        
        this.playSound('build');
        // Removed annoying notification popup for crafting
        // this.showNotification(`🔨 Crafted ${recipe.name}! (Ready for transport)`);
        console.log(`Crafted ${tier}: ${recipe.name}`);
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
        
        // Don't auto-transport if we have no transport capacity
        const totalTransport = (this.state.transport?.carts || 0) + 
                               (this.state.transport?.wagons || 0) + 
                               (this.state.transport?.trains || 0);
        if (totalTransport === 0) return;
        
        // Get current theme item names
        const rebirths = this.state.city?.rebirths || 0;
        const theme = this.rebirthThemes?.getTheme(rebirths);
        const themeItemNames = {
            basic: theme?.crafting?.basic?.result || 'Deployable App',
            intermediate: theme?.crafting?.intermediate?.result || 'SaaS Platform',
            advanced: theme?.crafting?.advanced?.result || 'Enterprise Product',
            premium: theme?.crafting?.premium?.result || 'Unicorn Startup'
        };
        
        let transported = false;
        
        // Try each tier that's enabled (transport all items at once for efficiency)
        for (const [tier, enabled] of Object.entries(this.state.autoTransport)) {
            if (!enabled) continue;
            
            const itemName = themeItemNames[tier];
            const factoryAmount = this.state.factory?.finished?.[itemName] || 0;
            
            if (factoryAmount > 0) {
                // Move ALL items of this tier from factory to city
                this.state.factory.finished[itemName] = 0;
                if (!this.state.cityInventory.finished[itemName]) {
                    this.state.cityInventory.finished[itemName] = 0;
                }
                this.state.cityInventory.finished[itemName] += factoryAmount;
                
                // Decrease crafted inventory counter
                this.state.crafted[tier] = Math.max(0, (this.state.crafted[tier] || 0) - factoryAmount);
                
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
        
        // Add gold (with city bonuses applied)
        const bankBonus = 1 + (this.state.city.banks * 0.2);
        const finalValue = Math.floor(value * bankBonus);
        
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
        
        // Add gold (with city bonuses applied)
        const bankBonus = 1 + (this.state.city.banks * 0.2);
        const finalValue = Math.floor(value * bankBonus * cityAmount);
        
        // Remove ALL from city
        this.state.cityInventory.finished[itemName] = 0;
        
        // Also decrease the crafted inventory counter
        this.state.crafted[tier] = Math.max(0, (this.state.crafted[tier] || 0) - cityAmount);
        
        this.state.resources.gold += finalValue;
        this.state.stats.totalGoldEarned += finalValue;
        
        this.playSound('sell');
        this.flashElement('gold-amount');
        this.showNotification(`💰 Sold ${cityAmount}x ${itemName} for ${finalValue} capital!`);
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
        
        // Check which tiers are unlocked and try crafting from highest to lowest
        const tierUnlocks = {
            premium: this.state.unlock_autocraft_premium,
            advanced: this.state.unlock_autocraft_advanced,
            intermediate: this.state.unlock_autocraft_intermediate,
            basic: this.state.unlock_autocraft_basic
        };
        
        // Automation Lab increases auto-craft speed
        // Level 0: 1 craft per tick, Level 1: 2 crafts, Level 2: 3 crafts, etc.
        const automationLab = this.state.city.automationLab || 0;
        const craftsPerTick = 1 + automationLab;
        
        const tiers = ['premium', 'advanced', 'intermediate', 'basic'];
        let craftsMade = 0;
        
        // Try to craft multiple items per tick based on automation lab level
        while (craftsMade < craftsPerTick) {
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
        
        const cost = costs[processorType];
        const stateKey = stateKeyMap[processorType];
        
        if (!stateKey) {
            console.error(`Unknown processor type: ${processorType}`);
            return false;
        }
        
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            // Use the plural state key
            this.state.processors[stateKey] = (this.state.processors[stateKey] || 0) + 1;
            
            this.playSound('build');
            this.flashElement('gold-amount');
            console.log(`Built ${processorType} (${stateKey}) for ${cost} gold`);
            return true;
        }
        return false;
    }
    
    hireTrader(traderType) {
        const costs = {
            stoneTrader: 15,
            coalTrader: 75,
            metalTrader: 300
        };
        
        const cost = costs[traderType];
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            this.state.traders[traderType + 's']++;
            
            this.playSound('hire');
            this.flashElement('gold-amount');
            console.log(`Hired ${traderType} for ${cost} gold`);
            return true;
        }
        return false;
    }
    
    buyTransport(transportType) {
        const costs = {
            cart: 30,
            wagon: 150,
            train: 800
        };
        
        const cost = costs[transportType];
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            this.state.transport[transportType + 's']++;
            
            this.playSound('build');
            this.flashElement('gold-amount');
            console.log(`Bought ${transportType} for ${cost} gold`);
            return true;
        }
        return false;
    }
    
    hireService(serviceType) {
        if (serviceType === 'police') {
            const cost = 5000;
            if (this.state.resources.gold >= cost) {
                this.state.resources.gold -= cost;
                this.state.stats.totalGoldSpent += cost;
                this.state.city.police++;
                
                this.playSound('hire');
                this.flashElement('gold-amount');
                console.log(`Hired police for ${cost} gold (upkeep: 0.5 gold/sec or 30 gold/min)`);
                return true;
            }
        } else if (serviceType === 'politician') {
            const cost = 250;
            if (this.state.resources.gold >= cost) {
                this.state.resources.gold -= cost;
                this.state.stats.totalGoldSpent += cost;
                this.state.city.politicians++;
                this.playSound('hire');
                this.flashElement('gold-amount');
                console.log(`Hired politician for ${cost} gold (reduces tax rate by 2%)`);
                return true;
            }
        }
        return false;
    }

    // Manual transport: move one best item based on value/weight
    transportNext() {
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
        
        // Create reverse mapping
        const craftedItemsReverse = {};
        for (const [tier, itemName] of Object.entries(themeItemNames)) {
            craftedItemsReverse[itemName] = tier;
        }
        
        // Use smallest capacity unit (1 weight) as click-based transport
        const result = this.newResourceManager.transportOne(1, this.state.autoTransport);
        if (result.moved) {
            // If a crafted item was transported, decrease the crafted counter
            if (result.item && result.tier === 'finished') {
                const craftTier = craftedItemsReverse[result.item];
                if (craftTier) {
                    this.state.crafted[craftTier] = Math.max(0, (this.state.crafted[craftTier] || 0) - 1);
                }
            }
            
            this.playSound('transport');
            return true;
        }
        return false;
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
            const bankBonus = 1 + (this.state.city.banks * 0.2);
            const finalValue = Math.floor(craftInfo.value * bankBonus);
            
            // Remove one from city
            this.state.cityInventory.finished[item] -= 1;
            
            // Decrease crafted inventory counter
            this.state.crafted[craftInfo.tier] = Math.max(0, (this.state.crafted[craftInfo.tier] || 0) - 1);
            
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
        // Define costs and proper state keys
        const buildingConfig = {
            bank: { cost: 500, stateKey: 'banks' },
            market: { cost: 1000, stateKey: 'markets' },
            university: { cost: 2500, stateKey: 'universities' },
            salesDepartment: { cost: 300, stateKey: 'salesDepartment' },
            miningAcademy: { cost: 400, stateKey: 'miningAcademy' },
            automationLab: { cost: 600, stateKey: 'automationLab' }
        };
        
        const config = buildingConfig[buildingType];
        if (!config) return false;
        
        // Upgradable buildings (scaling costs)
        const upgradableBuildings = ['salesDepartment', 'miningAcademy', 'automationLab'];
        
        if (upgradableBuildings.includes(buildingType)) {
            const currentLevel = this.state.city[config.stateKey] || 0;
            const cost = Math.floor(config.cost * Math.pow(1.5, currentLevel));
            
            console.log(`${buildingType}: Current level ${currentLevel}, Cost: ${cost}, Gold: ${this.state.resources.gold}`);
            
            if (this.state.resources.gold >= cost) {
                this.state.resources.gold -= cost;
                this.state.stats.totalGoldSpent += cost;
                this.state.city[config.stateKey]++;
                
                this.playSound('build');
                this.flashElement('gold-amount');
                console.log(`✅ ${buildingType} upgraded! New level: ${this.state.city[config.stateKey]}`);
                
                // Apply efficiency bonuses
                this.updateRDLabsEfficiency();
                
                this.updateUI(); // Force UI update
                return true;
            }
            console.log(`❌ Not enough gold for ${buildingType} (need ${cost})`);
            return false;
        }
        
        // Regular buildings (bank, market, university)
        const cost = config.cost;
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            this.state.city[config.stateKey]++;
            
            this.playSound('build');
            this.flashElement('gold-amount');
            console.log(`Built ${buildingType} (${config.stateKey}) for ${cost} gold. Total: ${this.state.city[config.stateKey]}`);
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
                this.state.efficiency.global *= 2.0;
                break;
        }
    }
    
    sellResource(resourceType) {
        const sellRates = {
            stone: 0.1,
            coal: 0.5,
            iron: 2.0,
            silver: 8.0
        };
        
        if (this.state.resources[resourceType] >= 1) {
            const goldEarned = sellRates[resourceType] * (1 + this.state.city.banks * 0.2);
            this.state.resources[resourceType] -= 1;
            this.state.resources.gold += goldEarned;
            this.state.stats.totalGoldEarned += goldEarned;
            
            this.playSound('sell');
            this.flashElement('gold-amount');
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
        
        // Reset game completely (including unlocks and research)
        this.state = this.getInitialState();
        
        // Restore enhanced efficiency
        this.state.efficiency = savedEfficiency;
        this.state.city.rebirths = newRebirthCount;
        
        // Apply rebirth bonuses
        this.state.efficiency.mining *= (1 + rebirthBonus.mining);
        this.state.efficiency.processing *= (1 + rebirthBonus.processing);
        this.state.efficiency.trading *= (1 + rebirthBonus.trading);
        this.state.efficiency.transport *= (1 + rebirthBonus.transport);
        
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
        
        this.playSound('prestige');
        this.showNotification(`🔄 Rebirth #${newRebirthCount} - A new chapter begins...`);
        console.log(`City rebirth completed! Total rebirths: ${newRebirthCount}`);
        
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
        // Placeholder for sound effects
        // Could be expanded to play actual audio files
        console.log(`Playing ${type} sound`);
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
            // Merge save data with current state, preserving any new properties
            this.state = { ...this.state, ...saveData };
            
            // Calculate offline progress if applicable
            if (saveData.lastSave) {
                const offlineTime = (Date.now() - saveData.lastSave) / 1000;
                this.calculateOfflineProgress(offlineTime);
            }
            
            // Re-initialize systems
            if (this.resourceManager) this.resourceManager.setState(this.state);
            if (this.upgradeSystem) this.upgradeSystem.setState(this.state);
            if (this.marketSystem) this.marketSystem.setState(this.state);
            
            console.log('Game loaded from save data');
            return true;
        }
        return false;
    }
    
    calculateOfflineProgress(offlineSeconds) {
        if (offlineSeconds > 60) { // Only calculate if offline for more than 1 minute
            const offlineProduction = this.resourceManager.calculateStoneProduction() * offlineSeconds;
            this.state.stone += offlineProduction;
            this.state.totalStoneMined += offlineProduction;
            this.state.offlineTime = offlineSeconds;
            
            console.log(`Offline for ${this.formatTime(offlineSeconds)}, gained ${this.formatNumber(offlineProduction)} stone`);
        }
    }
    
    reset() {
        console.log('🔄 RESET: Starting game reset...');
        
        // Set reset flag to prevent auto-save interference
        if (this.saveManager) {
            this.saveManager._isResetting = true;
            console.log('🔒 RESET: Lock acquired, auto-save blocked');
        }
        
        this.stop();
        this.state = this.getInitialState();
        
        if (this.resourceManager) this.resourceManager.setState(this.state);
        if (this.upgradeSystem) this.upgradeSystem.setState(this.state);
        if (this.marketSystem) this.marketSystem.setState(this.state);
        
        // Hide prestige panel
        const prestigePanel = document.getElementById('prestige-panel');
        if (prestigePanel) {
            prestigePanel.style.display = 'none';
        }
        
        console.log('💾 RESET: Immediately saving reset state to prevent auto-save corruption...');
        // CRITICAL: Save immediately after reset to prevent auto-save from restoring old state
        if (this.saveManager) {
            this.saveManager.saveGame(this.state).then(() => {
                // Release the lock after save completes
                this.saveManager._isResetting = false;
                console.log('🔓 RESET: Lock released after save');
            }).catch((error) => {
                console.error('❌ RESET: Save failed:', error);
                this.saveManager._isResetting = false;
                console.log('🔓 RESET: Lock released (error)');
            });
        }
        
        this.start();
        console.log('✅ RESET: Game reset complete and saved!');
    }

    // Alias for UI compatibility
    resetGame() {
        return this.reset();
    }

    applyPrestigeBonus(target, cost) {
        const bonusCosts = {
            'mining': Math.max(1, Math.floor(100 * Math.pow(2, this.state.prestige.bonuses.mining))),
            'processing': Math.max(1, Math.floor(200 * Math.pow(2, this.state.prestige.bonuses.processing))),
            'trading': Math.max(1, Math.floor(300 * Math.pow(2, this.state.prestige.bonuses.trading))),
            'transport': Math.max(1, Math.floor(500 * Math.pow(2, this.state.prestige.bonuses.transport))),
            'city': Math.max(1, Math.floor(1000 * Math.pow(2, this.state.prestige.bonuses.city)))
        };

        if (this.state.prestige.points >= bonusCosts[target]) {
            this.state.prestige.points -= bonusCosts[target];
            this.state.prestige.bonuses[target] += 1;
            
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
    
    showNotification(message) {
        // Simple notification system
        console.log(`📢 ${message}`);
        
        // You could also create a UI notification here
        const notification = document.createElement('div');
        notification.className = 'game-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
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
        if (this.state.prestige.points >= 100) return 'Legendary';
        if (this.state.prestige.points >= 50) return 'Epic';
        if (this.state.prestige.points >= 20) return 'Rare';
        if (this.state.prestige.points >= 5) return 'Uncommon';
        return 'Common';
    }
}

// Export for use in other modules
window.GameEngine = GameEngine;