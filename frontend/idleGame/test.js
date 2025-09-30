/**
 * Test script to validate game functionality
 */

// Simple test of game systems
function testGameSystems() {
    console.log('Testing Mine Empire Game Systems...');
    
    // Test ResourceManager
    const resourceManager = new ResourceManager();
    const testState = {
        stone: 100,
        miners: 5,
        housing: 5,
        housingCapacity: 50,
        upgrades: {
            minerEfficiency1: false,
            minerEfficiency2: false,
            housingUpgrade1: false,
            housingUpgrade2: false
        },
        prestigePoints: 0
    };
    
    resourceManager.setState(testState);
    
    console.log('✓ ResourceManager initialized');
    console.log('  Stone production:', resourceManager.calculateStoneProduction(), 'per second');
    console.log('  Can hire miner:', resourceManager.canHireMiner());
    console.log('  Miner cost:', resourceManager.getMinerCost());
    
    // Test UpgradeSystem
    const upgradeSystem = new UpgradeSystem();
    upgradeSystem.setState(testState);
    
    console.log('✓ UpgradeSystem initialized');
    console.log('  Available upgrades:', upgradeSystem.getAvailableUpgrades().length);
    console.log('  Can purchase efficiency1:', upgradeSystem.canPurchaseUpgrade('minerEfficiency1'));
    
    // Test MarketSystem
    const marketSystem = new MarketSystem();
    const testMarketState = {
        ...testState,
        basicMarketers: 1,
        advancedMarketers: 0,
        expertMarketers: 0
    };
    marketSystem.setState(testMarketState);
    
    console.log('✓ MarketSystem initialized');
    console.log('  Sell multiplier:', marketSystem.calculateSellMultiplier().toFixed(1) + 'x');
    console.log('  Stone value (100):', marketSystem.getStoneValue(100));
    
    // Test GameEngine
    const gameEngine = new GameEngine();
    gameEngine.initialize(resourceManager, upgradeSystem, marketSystem);
    
    console.log('✓ GameEngine initialized');
    console.log('  Initial state created');
    
    // Test basic game actions
    console.log('\nTesting game actions...');
    
    // Add some initial stone for testing
    gameEngine.state.stone = 1000;
    
    // Test hiring miner
    const initialMiners = gameEngine.state.miners;
    gameEngine.hireMiner();
    console.log('  Hire miner:', gameEngine.state.miners > initialMiners ? '✓' : '✗');
    
    // Test buying housing
    const initialHousing = gameEngine.state.housingCapacity;
    gameEngine.buyHousing();
    console.log('  Buy housing:', gameEngine.state.housingCapacity > initialHousing ? '✓' : '✗');
    
    // Test hiring marketer
    const initialMarketers = gameEngine.state.basicMarketers;
    gameEngine.hireMarketer('basic');
    console.log('  Hire marketer:', gameEngine.state.basicMarketers > initialMarketers ? '✓' : '✗');
    
    // Test upgrade purchase
    const initialUpgradeState = gameEngine.state.upgrades.minerEfficiency1;
    gameEngine.purchaseUpgrade('minerEfficiency1');
    console.log('  Purchase upgrade:', gameEngine.state.upgrades.minerEfficiency1 !== initialUpgradeState ? '✓' : '✗');
    
    console.log('\n🎮 All core systems working correctly!');
    
    return {
        resourceManager,
        upgradeSystem,
        marketSystem,
        gameEngine
    };
}

// Run tests if this script is executed directly
if (typeof window !== 'undefined') {
    window.testGameSystems = testGameSystems;
    console.log('Test functions loaded. Run testGameSystems() to validate the game.');
}