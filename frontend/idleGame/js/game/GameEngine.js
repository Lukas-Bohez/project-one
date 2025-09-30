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
        this.upgradeSystem = null;
        this.marketSystem = null;
        this.saveManager = null;
        
        // UI update throttling
        this.lastUIUpdate = 0;
        this.uiUpdateRate = 100; // Update UI every 100ms
        
        // Auto-save
        this.lastAutoSave = 0;
        this.autoSaveInterval = 30000; // Auto-save every 30 seconds
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
                smelters: 0,    // Stone -> Coal
                forges: 0,      // Coal -> Iron
                refineries: 0,  // Iron -> Silver
                mints: 0        // Silver -> Gold
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
                usage: 0
            },
            
            // City services
            city: {
                police: 0,
                banks: 0,
                markets: 0,
                universities: 0,
                corruption: 0
            },
            
            // Research
            research: {
                mining: false,
                processing: false,
                automation: false,
                logistics: false,
                quantum: false
            },
            
            // Statistics
            stats: {
                totalResourcesMined: {
                    stone: 0,
                    coal: 0,
                    iron: 0,
                    silver: 0
                },
                totalGoldEarned: 0,
                totalGoldSpent: 0
            },
            
            // Prestige
            prestige: {
                points: 0,
                resets: 0,
                unlocked: false,
                bonuses: {
                    mining: 0,
                    processing: 0,
                    trading: 0,
                    transport: 0,
                    city: 0
                }
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
        console.log('Checking for UIManager class:', typeof window.UIManager);
        if (window.UIManager) {
            console.log('Creating UIManager instance...');
            this.uiManager = new UIManager(this);
            console.log('UIManager initialized successfully');
        } else {
            console.error('UIManager class not found! Make sure js/ui/UIManager.js is loaded.');
        }
        
        // Start the main game loop
        this.tickInterval = setInterval(() => {
            this.tick();
        }, 1000 / this.tickRate);
        
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
        this.checkPrestige();
        
        // Update UI periodically (not every tick for performance)
        if (now - this.lastUIUpdate > this.uiUpdateRate) {
            this.updateUI();
            this.lastUIUpdate = now;
        }
        
        // Auto-save periodically
        if (now - this.lastAutoSave > this.autoSaveInterval) {
            this.autoSave();
            this.lastAutoSave = now;
        }
    }
    
    updateResources(deltaTime) {
        // Calculate base production from workers
        this.updateMiningProduction(deltaTime);
        
        // Calculate processing chain production
        this.updateProcessingProduction(deltaTime);
        
        // Handle automatic trading
        this.updateAutomaticTrading(deltaTime);
        
        // Apply city services costs
        this.updateCityServices(deltaTime);
        
        // Update transport capacity usage
        this.updateTransport();
    }
    
    updateMiningProduction(deltaTime) {
        let efficiency = this.state.efficiency.mining * this.state.efficiency.global;
        
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
        const efficiency = this.state.efficiency.processing * this.state.efficiency.global;
        
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
        const efficiency = this.state.efficiency.trading * (1 - corruption) * this.state.efficiency.global;
        
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
        const policeCost = this.state.city.police * 50 * deltaTime;
        if (this.state.resources.gold >= policeCost) {
            this.state.resources.gold -= policeCost;
            this.state.stats.totalGoldSpent += policeCost;
            this.state.city.corruption = Math.max(0, this.state.city.corruption - 1 * deltaTime);
        } else {
            // Can't afford police, corruption increases
            this.state.city.corruption = Math.min(100, this.state.city.corruption + 2 * deltaTime);
        }
    }
    
    updateTransport() {
        // Calculate total transport capacity
        const capacity = 
            this.state.transport.carts * 10 +
            this.state.transport.wagons * 50 +
            this.state.transport.trains * 200;
            
        this.state.transport.capacity = capacity * this.state.efficiency.transport;
        
        // Calculate current usage (based on resource production needs)
        const usage = Math.min(100, 
            (this.state.production.stone + this.state.resources.coal + this.state.resources.iron + this.state.resources.silver) / 
            Math.max(1, this.state.transport.capacity) * 100
        );
        this.state.transport.usage = usage;
        
        // Transport bottleneck reduces efficiency
        if (usage > 80) {
            this.state.efficiency.trading *= 0.8;
            this.state.efficiency.processing *= 0.9;
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
    
    checkPrestige() {
        // Unlock prestige when total stone sold reaches 1M
        if (this.state.totalStoneSold >= 1000000 && !this.state.prestigeUnlocked) {
            this.state.prestigeUnlocked = true;
            this.showPrestigePanel();
        }
    }
    
    showPrestigePanel() {
        const prestigePanel = document.getElementById('prestige-panel');
        if (prestigePanel) {
            prestigePanel.style.display = 'block';
        }
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
        this.updateElement('mining-efficiency', Math.round(this.state.efficiency.mining * 100) + '%');
        
        // Update processing status
        this.updateElement('smelters-count', this.state.processors.smelters.toString());
        this.updateElement('forges-count', this.state.processors.forges.toString());
        this.updateElement('refineries-count', this.state.processors.refineries.toString());
        this.updateElement('mints-count', this.state.processors.mints.toString());
        this.updateElement('processing-efficiency', Math.round(this.state.efficiency.processing * 100) + '%');
        
        // Update market status
        this.updateElement('stone-traders-count', this.state.traders.stoneTraders.toString());
        this.updateElement('coal-traders-count', this.state.traders.coalTraders.toString());
        this.updateElement('metal-traders-count', this.state.traders.metalTraders.toString());
        this.updateElement('market-efficiency', Math.round(this.state.efficiency.trading * 100) + '%');
        this.updateElement('corruption-level', Math.round(this.state.city.corruption) + '%');
        
        // Update transport status
        this.updateElement('carts-count', this.state.transport.carts.toString());
        this.updateElement('wagons-count', this.state.transport.wagons.toString());
        this.updateElement('trains-count', this.state.transport.trains.toString());
        this.updateElement('transport-capacity', this.formatNumber(this.state.transport.capacity));
        this.updateElement('transport-usage', Math.round(this.state.transport.usage) + '%');
        
        // Update city status
        this.updateElement('police-count', this.state.city.police.toString());
        this.updateElement('banks-count', this.state.city.banks.toString());
        this.updateElement('markets-count', this.state.city.markets.toString());
        this.updateElement('universities-count', this.state.city.universities.toString());
        
        // Update research status
        const completedResearch = Object.values(this.state.research).filter(r => r).length;
        this.updateElement('completed-research', completedResearch.toString());
        
        // Update prestige info
        this.updateElement('prestige-points', this.state.prestige.points.toString());
        this.updateElement('prestige-efficiency', Math.round(this.state.efficiency.global * 100) + '%');
        this.updateElement('prestige-resets', this.state.prestige.resets.toString());
        
        // Check prestige unlock
        if (this.state.stats.totalGoldEarned >= 10000 && !this.state.prestige.unlocked) {
            this.state.prestige.unlocked = true;
            document.getElementById('prestige-tab').style.display = 'block';
        }
        
        // Update button states
        this.updateButtonStates();
    }
    
    updateButtonStates() {
        // Mining buttons
        this.updateButtonState('mine-stone-btn', true); // Always available
        this.updateButtonState('hire-stone-miner-btn', this.state.resources.gold >= 5);
        this.updateButtonState('hire-coal-miner-btn', this.state.resources.gold >= 25);
        this.updateButtonState('hire-iron-miner-btn', this.state.resources.gold >= 100);
        this.updateButtonState('hire-silver-miner-btn', this.state.resources.gold >= 500);
        
        // Processing buttons
        this.updateButtonState('build-smelter-btn', this.state.resources.gold >= 20);
        this.updateButtonState('build-forge-btn', this.state.resources.gold >= 100);
        this.updateButtonState('build-refinery-btn', this.state.resources.gold >= 500);
        this.updateButtonState('build-mint-btn', this.state.resources.gold >= 2000);
        
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
        this.updateButtonState('hire-police-btn', this.state.resources.gold >= 100);
        this.updateButtonState('build-bank-btn', this.state.resources.gold >= 500);
        this.updateButtonState('build-market-btn', this.state.resources.gold >= 1000);
        this.updateButtonState('build-university-btn', this.state.resources.gold >= 2500);
        
        // Research buttons
        this.updateResearchButtonState('research-mining-btn', 'mining', 50);
        this.updateResearchButtonState('research-processing-btn', 'processing', 100);
        this.updateResearchButtonState('research-automation-btn', 'automation', 500);
        this.updateResearchButtonState('research-logistics-btn', 'logistics', 1000);
        
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
    }
    
    updateResearchButtonState(buttonId, researchType, cost) {
        const button = document.getElementById(buttonId);
        if (button) {
            const isCompleted = this.state.research[researchType];
            const canAfford = this.state.resources.gold >= cost;
            
            button.disabled = isCompleted || !canAfford;
            
            if (isCompleted) {
                button.classList.add('purchased');
                button.querySelector('.research-cost').textContent = 'COMPLETED';
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
    
    buildProcessor(processorType) {
        const costs = {
            smelter: 20,
            forge: 100,
            refinery: 500,
            mint: 2000
        };
        
        const cost = costs[processorType];
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            this.state.processors[processorType + 's']++;
            
            this.playSound('build');
            this.flashElement('gold-amount');
            console.log(`Built ${processorType} for ${cost} gold`);
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
            const cost = 100;
            if (this.state.resources.gold >= cost) {
                this.state.resources.gold -= cost;
                this.state.stats.totalGoldSpent += cost;
                this.state.city.police++;
                
                this.playSound('hire');
                this.flashElement('gold-amount');
                console.log(`Hired police for ${cost} gold (also 10 gold/sec upkeep)`);
                return true;
            }
        }
        return false;
    }
    
    buildCity(buildingType) {
        const costs = {
            bank: 500,
            market: 1000,
            university: 2500
        };
        
        const cost = costs[buildingType];
        if (this.state.resources.gold >= cost) {
            this.state.resources.gold -= cost;
            this.state.stats.totalGoldSpent += cost;
            this.state.city[buildingType + 's']++;
            
            this.playSound('build');
            this.flashElement('gold-amount');
            console.log(`Built ${buildingType} for ${cost} gold`);
            return true;
        }
        return false;
    }
    
    purchaseResearch(researchType) {
        const costs = {
            mining: 50,
            processing: 100,
            automation: 500,
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
            
            this.playSound('research');
            this.flashElement('gold-amount');
            console.log(`Completed research: ${researchType} for ${cost} gold`);
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
    
    prestige() {
        if (this.state.stats.totalGoldEarned >= 10000) {
            const prestigeGain = Math.floor(this.state.stats.totalGoldEarned / 10000);
            
            // Store current prestige data
            const currentPrestige = {
                points: this.state.prestige.points + prestigeGain,
                resets: this.state.prestige.resets + 1,
                unlocked: true
            };
            
            // Reset most things but keep prestige
            this.state = this.getInitialState();
            this.state.prestige = currentPrestige;
            
            // Apply prestige bonuses
            this.state.efficiency.global = 1.0 + (currentPrestige.points * 0.1); // 10% bonus per point
            
            this.playSound('prestige');
            console.log(`Prestiged! Gained ${prestigeGain} prestige points. Total: ${currentPrestige.points}`);
            
            // Show prestige tab
            document.getElementById('prestige-tab').style.display = 'block';
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
        // Placeholder for sound effects
        // Could be expanded to play actual audio files
        console.log(`Playing ${type} sound`);
    }
    
    autoSave() {
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
        
        this.start();
        console.log('Game reset');
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

    // Advertisement Reward System
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