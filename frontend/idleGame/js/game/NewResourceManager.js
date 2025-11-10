/**
 * NewResourceManager.js - Advanced resource and production system
 * Supports raw -> processed -> finished goods, recipes, weights, and transport priority
 */

class NewResourceManager {
	constructor(state) {
		this.state = state;
		this.rebirthThemes = null; // Will be set by GameEngine
		this.currentThemeRecipes = null;

		// Catalog definitions: value (gold), weight (unit weight), unlocked via research flags
		this.catalog = {
			// Raw resources
			raw: {
				stone: { value: 0.1, weight: 1, research: 'unlock_stone' },
				coal: { value: 0.5, weight: 1, research: 'unlock_coal' },
				iron: { value: 1.2, weight: 2, research: 'unlock_iron' },
				silver: { value: 6, weight: 2, research: 'unlock_silver' },
				gold: { value: 15, weight: 2, research: 'unlock_gold' },
				oil: { value: 3, weight: 1, research: 'unlock_oil' },
				rubber: { value: 1, weight: 1, research: 'unlock_rubber' }
			},
			// Processed and finished are now theme-dependent and created dynamically
			processed: {},
			finished: {
				// Crafted items (always available) - 3x manual sell value
				'Deployable App': { value: 3, weight: 1 },
				'SaaS Platform': { value: 9, weight: 2 },
				'Enterprise Product': { value: 30, weight: 3 },
				'Unicorn Startup': { value: 120, weight: 5 }
			}
		};
	}

	// Set the theme system reference
	setRebirthThemes(rebirthThemes) {
		this.rebirthThemes = rebirthThemes;
		this.updateThemeRecipes();
	}

	// Generate theme-specific recipes and catalog based on current rebirth
	updateThemeRecipes() {
		if (!this.rebirthThemes || !this.state) return;

		const rebirths = this.state.city?.rebirths || 0;
		const theme = this.rebirthThemes.getTheme(rebirths);

		// Define theme-specific output items and their properties
		const themeOutputs = {
			// Rebirth 0: Tech Empire
			0: {
				smelters: { name: 'deployedApp', value: 4, weight: 2 },
				forges: { name: 'cloudInstance', value: 18, weight: 2 },
				refineries: { name: 'premiumConversion', value: 45, weight: 2 },
				mints: { name: 'ipoShares', value: 120, weight: 2 }
			},
			// Rebirth 1: Retail Chain
			1: {
				smelters: { name: 'preparedProduce', value: 4, weight: 2 },
				forges: { name: 'bakedGoods', value: 18, weight: 2 },
				refineries: { name: 'deliMeats', value: 45, weight: 2 },
				mints: { name: 'franchiseDeals', value: 120, weight: 2 }
			},
			// Rebirth 2: Mining Corp
			2: {
				smelters: { name: 'crushedOre', value: 4, weight: 2 },
				forges: { name: 'metalBars', value: 18, weight: 2 },
				refineries: { name: 'purifiedMetal', value: 45, weight: 2 },
				mints: { name: 'bulkContracts', value: 120, weight: 2 }
			},
			// Rebirth 3: Small Factory
			3: {
				smelters: { name: 'scrapParts', value: 4, weight: 2 },
				forges: { name: 'assembledUnits', value: 18, weight: 2 },
				refineries: { name: 'finishedGoods', value: 45, weight: 2 },
				mints: { name: 'exportOrders', value: 120, weight: 2 }
			},
			// Rebirth 4: Artisan Workshop
			4: {
				smelters: { name: 'roughGoods', value: 4, weight: 2 },
				forges: { name: 'craftedItems', value: 18, weight: 2 },
				refineries: { name: 'refinedCrafts', value: 45, weight: 2 },
				mints: { name: 'masterworks', value: 120, weight: 2 }
			},
			// Rebirth 5: Street Vendor
			5: {
				smelters: { name: 'streetFood', value: 4, weight: 2 },
				forges: { name: 'repairedGoods', value: 18, weight: 2 },
				refineries: { name: 'premiumItems', value: 45, weight: 2 },
				mints: { name: 'rarefind', value: 120, weight: 2 }
			},
			// Rebirth 6: Scavenger
			6: {
				smelters: { name: 'scavengedFood', value: 4, weight: 2 },
				forges: { name: 'purifiedWater', value: 18, weight: 2 },
				refineries: { name: 'usableSupplies', value: 45, weight: 2 },
				mints: { name: 'tradableGoods', value: 120, weight: 2 }
			},
			// Rebirth 7: Alone
			7: {
				smelters: { name: 'foragedFood', value: 4, weight: 2 },
				forges: { name: 'warmth', value: 18, weight: 2 },
				refineries: { name: 'shelter', value: 45, weight: 2 },
				mints: { name: 'hope', value: 120, weight: 2 }
			},
			// Rebirth 8: Hospital
			8: {
				smelters: { name: 'breathingTreatment', value: 4, weight: 2 },
				forges: { name: 'medication', value: 18, weight: 2 },
				refineries: { name: 'comfort', value: 45, weight: 2 },
				mints: { name: 'visitingHours', value: 120, weight: 2 }
			},
			// Rebirth 9: The End
			9: {
				smelters: { name: 'memories', value: 4, weight: 2 },
				forges: { name: 'forgiveness', value: 18, weight: 2 },
				refineries: { name: 'gratitude', value: 45, weight: 2 },
				mints: { name: 'peace', value: 120, weight: 2 }
			}
		};

		const outputs = themeOutputs[rebirths] || themeOutputs[0];

		// Update catalog with theme-specific processed goods
		this.catalog.processed = {};
		Object.values(outputs).forEach(item => {
			this.catalog.processed[item.name] = {
				value: item.value,
				weight: item.weight,
				research: 'unlock_processing'
			};
		});

		// Generate recipes
		this.recipes = {
			// First processor (smelter): stone + coal
			[outputs.smelters.name]: {
				input: { stone: 2, coal: 2 },
				output: { [outputs.smelters.name]: 1 },
				building: 'smelters'
			},
			// Second processor (forge): coal + iron
			[outputs.forges.name]: {
				input: { coal: 2, iron: 2 },
				output: { [outputs.forges.name]: 1 },
				building: 'forges'
			},
			// Third processor (refinery): silver + iron
			[outputs.refineries.name]: {
				input: { silver: 3, iron: 2 },
				output: { [outputs.refineries.name]: 1 },
				building: 'refineries'
			},
			// Fourth processor (mint): silver + gold
			[outputs.mints.name]: {
				input: { silver: 3, gold: 2 },
				output: { [outputs.mints.name]: 1 },
				building: 'mints'
			}
		};

		console.log(`📦 Updated recipes for theme ${rebirths}:`, Object.keys(this.recipes));
		
		// Clean up old non-theme-appropriate items from inventory
		this.cleanupInventory();
	}

	// Remove items that aren't part of current theme
	cleanupInventory() {
		if (!this.state || !this.recipes) return;

		const validOutputs = new Set();
		Object.values(this.recipes).forEach(recipe => {
			Object.keys(recipe.output).forEach(item => validOutputs.add(item));
		});

		// Clean factory processed inventory
		if (this.state.factory?.processed) {
			Object.keys(this.state.factory.processed).forEach(item => {
				if (!validOutputs.has(item) && !this.catalog.processed[item]) {
					delete this.state.factory.processed[item];
					console.log(`🧹 Removed old item from factory: ${item}`);
				}
			});
		}

		// Clean city finished inventory
		if (this.state.cityInventory?.finished) {
			Object.keys(this.state.cityInventory.finished).forEach(item => {
				if (!validOutputs.has(item) && !this.catalog.processed[item]) {
					delete this.state.cityInventory.finished[item];
					console.log(`🧹 Removed old item from city: ${item}`);
				}
			});
		}
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
	pickNextForTransport(autoTransportPrefs = null) {
		this.ensureInventories();
		let bestItem = null;
		let bestScore = -Infinity;
		let bestTier = null;
		
		// Crafted items mapping
		const craftedItems = {
			'Deployable App': 'basic',
			'SaaS Platform': 'intermediate',
			'Enterprise Product': 'advanced',
			'Unicorn Startup': 'premium'
		};
		
		// Check both processed AND finished goods
		['processed', 'finished'].forEach(tier => {
			Object.entries(this.state.factory[tier]).forEach(([res, qty]) => {
				if (qty <= 0) return;
				
				// Check if this is a crafted item and if auto-transport is disabled for it
				if (tier === 'finished' && craftedItems[res] && autoTransportPrefs) {
					const craftTier = craftedItems[res];
					if (!autoTransportPrefs[craftTier]) {
						return; // Skip this item if auto-transport is disabled
					}
				}
				
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
	transportOne(capacity = 1, autoTransportPrefs = null) {
		const result = this.pickNextForTransport(autoTransportPrefs);
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
		
		return { item, tier, moved: 1, weight };
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
