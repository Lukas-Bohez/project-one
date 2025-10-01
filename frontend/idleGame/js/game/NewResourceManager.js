/**
 * NewResourceManager.js - Advanced resource and production system
 * Supports raw -> processed -> finished goods, recipes, weights, and transport priority
 */

class NewResourceManager {
	constructor(state) {
		this.state = state;

		// Catalog definitions: value (gold), weight (unit weight), unlocked via research flags
		this.catalog = {
			// Raw resources
			raw: {
				stone: { value: 0.1, weight: 1, research: 'unlock_stone' },
				coal: { value: 0.5, weight: 1, research: 'unlock_coal' },
				ironOre: { value: 1.2, weight: 2, research: 'unlock_iron' },
				silverOre: { value: 6, weight: 2, research: 'unlock_silver' },
				goldOre: { value: 15, weight: 2, research: 'unlock_gold' },
				oil: { value: 3, weight: 1, research: 'unlock_oil' },
				rubber: { value: 1, weight: 1, research: 'unlock_rubber' }
			},
			// Processed materials
			processed: {
				polishedStone: { value: 0.6, weight: 1, research: 'unlock_processing' },
				coke: { value: 1.5, weight: 1, research: 'unlock_processing' },
				ironIngot: { value: 4, weight: 2, research: 'unlock_processing' },
				silverIngot: { value: 18, weight: 2, research: 'unlock_processing' },
				goldIngot: { value: 45, weight: 2, research: 'unlock_processing' },
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
			// processing
			polishedStone: { input: { stone: 2 }, output: { polishedStone: 1 }, building: 'polisher' },
			coke: { input: { coal: 3 }, output: { coke: 1 }, building: 'coker' },
			ironIngot: { input: { coal: 2, iron: 2 }, output: { ironIngot: 1 }, building: 'smelter' },
			silverIngot: { input: { coke: 2, silver: 2 }, output: { silverIngot: 1 }, building: 'refinery' },
			goldIngot: { input: { coke: 3, gold: 2 }, output: { goldIngot: 1 }, building: 'mint' },
			fuel: { input: { oil: 2 }, output: { fuel: 1 }, building: 'refinery' },
			plastic: { input: { oil: 2 }, output: { plastic: 1 }, building: 'chemPlant' },
			microconductors: { input: { plastic: 1, silverIngot: 1, goldIngot: 1 }, output: { microconductors: 1 }, building: 'chipFab' },
			jewelry: { input: { goldIngot: 1, silverIngot: 2 }, output: { jewelry: 1 }, building: 'jeweler' },

			// finished
			motherboard: { input: { polishedStone: 1, microconductors: 1, plastic: 1 }, output: { motherboard: 1 }, building: 'assembly' },
			gpu: { input: { motherboard: 1, microconductors: 2, plastic: 1 }, output: { gpu: 1 }, building: 'assembly' },
			computer: { input: { motherboard: 1, gpu: 1, plastic: 2 }, output: { computer: 1 }, building: 'assembly' },
			car: { input: { ironIngot: 10, plastic: 5, fuel: 2, rubber: 4 }, output: { car: 1 }, building: 'autoPlant' }
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
				// Each building processes 1 recipe unit per second baseline
				const canRun = Math.floor(count * speed);
				if (canRun <= 0) return;
				const runs = this.maxRuns(r.input, canRun);
				if (runs > 0) this.applyRecipe(r.input, r.output, runs);
			});
		});
	}

	maxRuns(inputs, cap) {
		// Determine how many times a recipe can run based on available input inventory
		let max = cap;
		for (const [res, qty] of Object.entries(inputs)) {
			const have = this.getAmount(res);
			max = Math.min(max, Math.floor(have / qty));
			if (max <= 0) return 0;
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

	// Transport: pick the next finished item to transport based on value/weight ratio
	pickNextForTransport() {
		this.ensureInventories();
		let bestItem = null;
		let bestScore = -Infinity;
		Object.entries(this.state.factory.finished).forEach(([res, qty]) => {
			if (qty <= 0) return;
			const meta = this.catalog.finished[res];
			if (!meta) return;
			const score = meta.value / Math.max(1, meta.weight);
			if (score > bestScore) {
				bestScore = score;
				bestItem = res;
			}
		});
		return bestItem;
	}

	// Move 1 unit (or as much as capacity allows) from factory to city
	transportOne(capacity = 1) {
		const item = this.pickNextForTransport();
		if (!item) return { moved: 0 };
		const meta = this.catalog.finished[item];
		const weight = meta.weight || 1;
		if (weight > capacity) return { moved: 0 };
		// Move 1 unit
		this.state.factory.finished[item] = (this.state.factory.finished[item] || 0) - 1;
		if (this.state.factory.finished[item] < 0) this.state.factory.finished[item] = 0;
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
