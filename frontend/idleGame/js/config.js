// =============================================================================
// KINGDOM QUARRY - GAME CONFIGURATION
// =============================================================================

// API Configuration
const API_CONFIG = {
    baseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8000' 
        : '', // Use relative URLs in production
    endpoints: {
        gameStatus: '/api/v1/game/status',
        register: '/api/v1/game/auth/register',
        login: '/api/v1/game/auth/login',
        save: '/api/v1/game/save',
        resources: '/api/v1/game/resources',
        upgrades: '/api/v1/game/upgrades',
        leaderboard: '/api/v1/game/leaderboard',
        stats: '/api/v1/game/stats'
    }
};

// Game Configuration
const GAME_CONFIG = {
    version: '1.0.0',
    tickRate: 100, // milliseconds between game updates
    saveInterval: 60000, // Auto-save every 60 seconds
    
    // Resource Generation
    baseStonePerClick: 3,
    baseStonePerSecond: 0,
    
    // Character Costs and Production
    characters: {
        peasant: {
            baseCost: { gold: 15 },
            baseProduction: { stone: 2, gold: 0.2 }, // per second
            costMultiplier: 1.15
        },
        miner: {
            baseCost: { gold: 50 },
            baseProduction: { stone: 5, gold: 0.1 },
            costMultiplier: 1.2,
            unlockRequirement: { stone: 1000 }
        },
        foreman: {
            baseCost: { gold: 200, crystals: 1 },
            baseProduction: { stone: 15, gold: 0.5 },
            costMultiplier: 1.25,
            unlockRequirement: { stone: 10000, gold: 500 }
        },
        engineer: {
            baseCost: { gold: 1000, crystals: 5 },
            baseProduction: { stone: 50, gold: 2 },
            costMultiplier: 1.3,
            unlockRequirement: { stone: 100000, gold: 5000 }
        },
        master: {
            baseCost: { gold: 5000, crystals: 25 },
            baseProduction: { stone: 200, gold: 10, crystals: 0.1 },
            costMultiplier: 1.35,
            unlockRequirement: { stone: 1000000, gold: 50000 }
        }
    },
    
    // Transport Upgrades
    transport: {
        cart: {
            baseCost: { gold: 75 },
            productionMultiplier: 1.25,
            costMultiplier: 1.5,
            unlockRequirement: { stone: 1000 }
        },
        wagon: {
            baseCost: { gold: 500, crystals: 2 },
            productionMultiplier: 1.5,
            costMultiplier: 1.6,
            unlockRequirement: { stone: 50000, gold: 1000 }
        },
        steamEngine: {
            baseCost: { gold: 2500, crystals: 10 },
            productionMultiplier: 2.0,
            costMultiplier: 1.8,
            unlockRequirement: { stone: 500000, gold: 10000 }
        },
        magicPortal: {
            baseCost: { gold: 10000, crystals: 50 },
            productionMultiplier: 3.0,
            costMultiplier: 2.0,
            unlockRequirement: { stone: 5000000, gold: 100000 }
        }
    },
    
    // Market Exchange Rates
    market: {
        stoneToGold: {
            baseRate: 10, // 10 stone = 1 gold
            rateMultiplier: 1.02 // Rate increases slightly with each trade
        },
        goldToCrystals: {
            baseRate: 100, // 100 gold = 1 crystal
            rateMultiplier: 1.01
        },
        dailyBonuses: {
            enabled: true,
            stoneBonus: 1000,
            goldBonus: 100,
            crystalBonus: 5
        }
    },
    
    // Prestige System
    prestige: {
        baseCrystalCost: 100,
        costMultiplier: 2.0,
        bonusPerLevel: 0.1, // 10% production bonus per prestige level
        crystalsPerLevel: 1 // Crystals gained per prestige level
    },
    
    // Achievement Thresholds
    achievements: {
        stoneCollector: [1000, 10000, 100000, 1000000, 10000000],
        goldEarner: [100, 1000, 10000, 100000, 1000000],
        crystalFinder: [1, 10, 50, 200, 1000],
        workerManager: [5, 25, 100, 500, 2000],
        prestigeMaster: [1, 5, 10, 25, 50]
    },
    
    // Visual Settings
    graphics: {
        particleCount: {
            low: 10,
            medium: 25,
            high: 50
        },
        animationSpeed: {
            low: 0.5,
            medium: 1.0,
            high: 1.5
        }
    },
    
    // Audio Settings
    audio: {
        clickSounds: ['click1', 'click2', 'click3'],
        backgroundMusic: 'medieval_ambience',
        effectVolume: 0.7,
        musicVolume: 0.4
    }
};

// Default Game State
const DEFAULT_GAME_STATE = {
    version: GAME_CONFIG.version,
    player: {
        name: 'Noble',
        prestigeLevel: 1,
        totalPlayTime: 0,
        lastSave: Date.now()
    },
    resources: {
        stone: 20,
        gold: 25,
        crystals: 0
    },
    characters: {
        peasant: { count: 0, unlocked: true },
        miner: { count: 0, unlocked: false },
        foreman: { count: 0, unlocked: false },
        engineer: { count: 0, unlocked: false },
        master: { count: 0, unlocked: false }
    },
    transport: {
        cart: { level: 0, unlocked: false },
        wagon: { level: 0, unlocked: false },
        steamEngine: { level: 0, unlocked: false },
        magicPortal: { level: 0, unlocked: false }
    },
    market: {
        tradesMade: 0,
        currentRates: {
            stoneToGold: GAME_CONFIG.market.stoneToGold.baseRate,
            goldToCrystals: GAME_CONFIG.market.goldToCrystals.baseRate
        },
        lastDailyBonus: 0
    },
    achievements: {
        unlocked: [],
        progress: {}
    },
    settings: {
        soundEnabled: true,
        musicEnabled: true,
        autoSaveInterval: 60,
        graphicsQuality: 'medium'
    },
    statistics: {
        totalStoneCollected: 0,
        totalGoldEarned: 0,
        totalCrystalsFound: 0,
        totalClicks: 0,
        totalPlaySessions: 0,
        longestSession: 0
    }
};

// UI Configuration
const UI_CONFIG = {
    animations: {
        clickIndicatorDuration: 1000,
        resourceUpdateDuration: 300,
        modalFadeDuration: 200
    },
    
    formatting: {
        // Number formatting thresholds
        thousand: 1000,
        million: 1000000,
        billion: 1000000000,
        trillion: 1000000000000
    },
    
    colors: {
        stone: '#696969',
        gold: '#FFD700',
        crystals: '#87CEEB',
        success: '#228B22',
        warning: '#DAA520',
        error: '#B22222'
    }
};

// Utility Functions for Configuration
const CONFIG_UTILS = {
    // Format large numbers with appropriate suffixes
    formatNumber: (num) => {
        if (num >= UI_CONFIG.formatting.trillion) {
            return (num / UI_CONFIG.formatting.trillion).toFixed(2) + 'T';
        } else if (num >= UI_CONFIG.formatting.billion) {
            return (num / UI_CONFIG.formatting.billion).toFixed(2) + 'B';
        } else if (num >= UI_CONFIG.formatting.million) {
            return (num / UI_CONFIG.formatting.million).toFixed(2) + 'M';
        } else if (num >= UI_CONFIG.formatting.thousand) {
            return (num / UI_CONFIG.formatting.thousand).toFixed(1) + 'K';
        } else {
            return Math.floor(num).toString();
        }
    },
    
    // Calculate cost with multiplier
    calculateCost: (baseCost, count, multiplier) => {
        const cost = {};
        for (const [resource, amount] of Object.entries(baseCost)) {
            cost[resource] = Math.floor(amount * Math.pow(multiplier, count));
        }
        return cost;
    },
    
    // Calculate production with prestige bonus
    calculateProduction: (baseProduction, prestigeLevel) => {
        const bonus = 1 + (prestigeLevel - 1) * GAME_CONFIG.prestige.bonusPerLevel;
        const production = {};
        for (const [resource, amount] of Object.entries(baseProduction)) {
            production[resource] = amount * bonus;
        }
        return production;
    },
    
    // Check if requirements are met
    checkRequirements: (requirements, currentResources) => {
        for (const [resource, required] of Object.entries(requirements)) {
            if ((currentResources[resource] || 0) < required) {
                return false;
            }
        }
        return true;
    },
    
    // Deep merge objects
    deepMerge: (target, source) => {
        const result = { ...target };
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = CONFIG_UTILS.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }
};

// Export configuration (for module systems)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_CONFIG,
        GAME_CONFIG,
        DEFAULT_GAME_STATE,
        UI_CONFIG,
        CONFIG_UTILS
    };
}