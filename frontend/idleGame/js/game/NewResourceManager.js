/**
 * NewResourceManager.js - Advanced resource and production system
 * Supports raw -> processed -> finished goods, recipes, weights, and transport priority
 */

class NewResourceManager {
	constructor(state) {
		this.state = state;

		// Catalog definitions: value (gold), weight (unit weight), unlocked via research flags
		this.catalog = {
			// Raw resources (development inputs)
			raw: {
				stone: { value: 0.1, weight: 1, research: 'unlock_stone' },      // code commits
				coal: { value: 0.5, weight: 1, research: 'unlock_coal' },        // cloud servers
				iron: { value: 1.2, weight: 2, research: 'unlock_iron' },        // user accounts
				silver: { value: 6, weight: 2, research: 'unlock_silver' },      // premium subs
				gold: { value: 15, weight: 2, research: 'unlock_gold' },         // venture capital
				oil: { value: 3, weight: 1, research: 'unlock_oil' },
				rubber: { value: 1, weight: 1, research: 'unlock_rubber' }
			},
			// Processed materials (deployed products)
			processed: {
				deployedApp: { value: 4, weight: 2, research: 'unlock_processing' },           // from Code Compiler
				cloudInstance: { value: 18, weight: 2, research: 'unlock_processing' },        // from Data Center
				premiumConversion: { value: 45, weight: 2, research: 'unlock_processing' },    // from Marketing Engine
				ipoShares: { value: 120, weight: 2, research: 'unlock_processing' },           // from IPO Machine
				polishedStone: { value: 0.6, weight: 1, research: 'unlock_processing' },
				coke: { value: 1.5, weight: 1, research: 'unlock_processing' },
				fuel: { value: 5, weight: 1, research: 'unlock_oil' },
				plastic: { value: 6, weight: 1, research: 'unlock_oil' },
				microconductors: { value: 25, weight: 1, research: 'unlock_electronics' },
				jewelry: { value: 80, weight: 1, research: 'unlock_jewelry' }
			},
			// Finished goods
			finished: {
				motherboard: { value: 120, weight: 2, research: 'unlock_electronics' },
				gpu: { value: 240, weight: 3, research: 'unlock_electronics' },
				computer: { value: 600, weight: 6, research: 'unlock_electronics' },
				car: { value: 1200, weight: 15, research: 'unlock_automotive' }
			}
		};

		// Processing and crafting recipes
		this.recipes = {
			// THEMED TECH EMPIRE RECIPES
			// Code Compiler: code commits + cloud servers -> deployed apps
			deployedApp: { input: { stone: 2, coal: 2 }, output: { deployedApp: 1 }, building: 'smelters' },
			
			// Data Center: cloud servers + user accounts -> cloud instances
			cloudInstance: { input: { coal: 2, iron: 2 }, output: { cloudInstance: 1 }, building: 'forges' },
			
			// Marketing Engine: premium subs + user accounts -> premium conversions
			premiumConversion: { input: { silver: 3, iron: 2 }, output: { premiumConversion: 1 }, building: 'refineries' },
			
			// IPO Machine: premium subs + venture capital -> IPO shares
			ipoShares: { input: { silver: 3, gold: 2 }, output: { ipoShares: 1 }, building: 'mints' },
			
			// OLD RECIPES (for other buildings not yet themed)
			polishedStone: { input: { stone: 2 }, output: { polishedStone: 1 }, building: 'polishers' },
			coke: { input: { coal: 3 }, output: { coke: 1 }, building: 'cokers' },
			fuel: { input: { oil: 2 }, output: { fuel: 1 }, building: 'refineries' },
			plastic: { input: { oil: 2 }, output: { plastic: 1 }, building: 'chemPlants' },
			microconductors: { input: { plastic: 1, iron: 1, silver: 1 }, output: { microconductors: 1 }, building: 'chipFabs' },
			jewelry: { input: { silver: 1, gold: 2 }, output: { jewelry: 1 }, building: 'jewelers' },

			// finished
			motherboard: { input: { polishedStone: 1, microconductors: 1, plastic: 1 }, output: { motherboard: 1 }, building: 'assemblies' },
			gpu: { input: { motherboard: 1, microconductors: 2, plastic: 1 }, output: { gpu: 1 }, building: 'assemblies' },
			computer: { input: { motherboard: 1, gpu: 1, plastic: 2 }, output: { computer: 1 }, building: 'assemblies' },
			car: { input: { deployedApp: 10, plastic: 5, fuel: 2, rubber: 4 }, output: { car: 1 }, building: 'autoPlants' }
		};
	}

	// Utility: ensure nested inventory objects exist
	ensureInventories() {
		this.state.factory = this.state.factory || { raw: {}, processed: {}, finished: {} };
		this.state.cityInventory = this.state.cityInventory || { finished: {} };
	}

	// Called each tick by GameEngine
	update(deltaTime) {
		this.ensureInventories();
		const eff = (this.state?.efficiency?.processing || 1) * (this.state?.efficiency?.global || 1);
		const speed = eff * deltaTime;

		// Iterate through owned buildings and try to process
		const buildings = this.state.processors || {};
		Object.keys(buildings).forEach(bKey => {
			const count = buildings[bKey] || 0;
			if (!count) return;
			
			// Map building to recipes handled
			const handled = Object.entries(this.recipes).filter(([name, r]) => r.building === bKey);
			
			handled.forEach(([name, r]) => {
				// Each building can process multiple times per tick based on count and deltaTime
				// At 60fps, deltaTime ≈ 0.016, so 7 smelters * 0.016 ≈ 0.11 runs per tick
				// This accumulates to about 7 runs per second
				const canRunFloat = count * speed;
				const canRun = Math.max(1, Math.floor(canRunFloat)); // At least try 1 if we have buildings
				
				const runs = this.maxRuns(r.input, canRun);
				if (runs > 0) {
					this.applyRecipe(r.input, r.output, runs);
				}
			});
		});
	}

	maxRuns(inputs, cap) {
		// Determine how many times a recipe can run based on available input inventory
		let max = cap;
		for (const [res, qty] of Object.entries(inputs)) {
			const have = this.getAmount(res);
			if (have < qty) return 0; // Not enough of this resource
			max = Math.min(max, Math.floor(have / qty));
		}
		return max;
	}

	applyRecipe(inputs, outputs, times) {
		// Consume inputs
		for (const [res, qty] of Object.entries(inputs)) this.addAmount(res, -qty * times);
		// Produce outputs
		for (const [res, qty] of Object.entries(outputs)) this.addAmount(res, qty * times);
	}

	// Inventory helpers for unified resource naming across tiers
	resolveTier(res) {
		if (this.catalog.raw[res]) return 'raw';
		if (this.catalog.processed[res]) return 'processed';
		if (this.catalog.finished[res]) return 'finished';
		// Fallback: treat as processed
		return 'processed';
	}

	getAmount(res) {
		const tier = this.resolveTier(res);
		this.ensureInventories();
		// Backward-compat: if raw resource is tracked in legacy state.resources, read from there
		if (tier === 'raw' && this.state.resources && res in this.state.resources) {
			return this.state.resources[res];
		}
		return (this.state.factory[tier][res] || 0);
	}

	addAmount(res, amount) {
		const tier = this.resolveTier(res);
		this.ensureInventories();
		if (tier === 'raw' && this.state.resources && res in this.state.resources) {
			this.state.resources[res] = Math.max(0, (this.state.resources[res] || 0) + amount);
			return;
		}
		this.state.factory[tier][res] = (this.state.factory[tier][res] || 0) + amount;
		if (this.state.factory[tier][res] < 0) this.state.factory[tier][res] = 0;
	}

	// Transport: pick the next item (processed or finished) to transport based on value/weight ratio
	pickNextForTransport() {
		this.ensureInventories();
		let bestItem = null;
		let bestScore = -Infinity;
		let bestTier = null;
		
		// Check both processed AND finished goods
		['processed', 'finished'].forEach(tier => {
			Object.entries(this.state.factory[tier]).forEach(([res, qty]) => {
				if (qty <= 0) return;
				const meta = this.catalog[tier][res];
				if (!meta) return;
				const score = meta.value / Math.max(1, meta.weight);
				if (score > bestScore) {
					bestScore = score;
					bestItem = res;
					bestTier = tier;
				}
			});
		});
		
		return bestItem ? { item: bestItem, tier: bestTier } : null;
	}

	// Move 1 unit (or as much as capacity allows) from factory to city
	transportOne(capacity = 1) {
		const result = this.pickNextForTransport();
		if (!result) return { moved: 0 };
		
		const { item, tier } = result;
		const meta = this.catalog[tier][item];
		const weight = meta.weight || 1;
		
		if (weight > capacity) return { moved: 0 };
		
		// Move 1 unit from factory to city
		this.state.factory[tier][item] = (this.state.factory[tier][item] || 0) - 1;
		if (this.state.factory[tier][item] < 0) this.state.factory[tier][item] = 0;
		
		// City inventory stores everything in 'finished' for simplicity
		this.state.cityInventory.finished[item] = (this.state.cityInventory.finished[item] || 0) + 1;
		
		return { item, moved: 1, weight };
	}

	// Sell one unit in city
	sellOne(item) {
		const meta = this.catalog.finished[item] || this.catalog.processed[item] || this.catalog.raw[item];
		if (!meta) return { sold: 0, gold: 0 };
		const inv = this.state.cityInventory.finished;
		if (!inv[item] || inv[item] <= 0) return { sold: 0, gold: 0 };
		inv[item] -= 1;
		const gold = meta.value * (1 + (this.state.city?.banks || 0) * 0.2);
		this.state.resources.gold += gold;
		this.state.stats.totalGoldEarned += gold;
		return { sold: 1, gold };
	}
}

window.NewResourceManager = NewResourceManager;
