/**
 * UIThemeManager.js - Dynamically updates all UI text based on rebirth theme
 * Changes resource names, worker titles, building descriptions, etc.
 */

class UIThemeManager {
    constructor(gameEngine, rebirthThemes) {
        this.gameEngine = gameEngine;
        this.rebirthThemes = rebirthThemes;
        this.currentTheme = null;
    }

    updateTheme() {
        const theme = this.rebirthThemes.getCurrentTheme(this.gameEngine.state);
        
        // Only update if theme changed
        if (this.currentTheme && this.currentTheme.id === theme.id) {
            return;
        }
        
        this.currentTheme = theme;
        console.log(`Applying theme: ${theme.name}`);
        
        // Update all UI elements
        this.updatePageTitle(theme);
        this.updateColorScheme(theme);
        this.updateTabNames(theme);
        this.updateResourceNames(theme);
        this.updateWorkerNames(theme);
        this.updateProcessorNames(theme);
        this.updateTraderNames(theme);
        this.updateTransportNames(theme);
        this.updateCityNames(theme);
        this.updateCraftingNames(theme); // NEW: Update crafting button text
        this.updateResearchNames(theme);
        this.updateUnlockNames(theme); // NEW: Update unlock button text
        this.updateCostCurrency(theme); // NEW: Update all "gold" references to themed currency
        this.updateRebirthButton(theme);
        this.updateAtmosphere(theme);
        
        // Show theme change notification
        if (this.gameEngine.showNotification) {
            this.gameEngine.showNotification(`🔄 ${theme.description}`);
        }
    }

    updatePageTitle(theme) {
        document.title = `${theme.name}`;
        
        // Update main header
        const header = document.getElementById('game-title');
        if (header) {
            header.textContent = theme.name;
            // Keep click handler working
            header.style.cursor = 'pointer';
        }
    }

    updateColorScheme(theme) {
        const root = document.documentElement;
        root.style.setProperty('--theme-primary', theme.colorScheme.primary);
        root.style.setProperty('--theme-secondary', theme.colorScheme.secondary);
        root.style.setProperty('--theme-background', theme.colorScheme.background);
        
        // Apply background
        const body = document.body;
        if (body) {
            body.style.background = theme.colorScheme.background;
        }
    }

    updateTabNames(theme) {
        // Update tab navigation buttons with theme-specific names
        if (theme.tabs) {
            this.updateButtonText('tab-btn-mining', `${theme.tabs.mining.emoji} ${theme.tabs.mining.name}`);
            this.updateButtonText('tab-btn-processing', `${theme.tabs.processing.emoji} ${theme.tabs.processing.name}`);
            this.updateButtonText('tab-btn-market', `${theme.tabs.market.emoji} ${theme.tabs.market.name}`);
            this.updateButtonText('tab-btn-transport', `${theme.tabs.transport.emoji} ${theme.tabs.transport.name}`);
            this.updateButtonText('tab-btn-city', `${theme.tabs.city.emoji} ${theme.tabs.city.name}`);
            this.updateButtonText('tab-btn-research', `${theme.tabs.research.emoji} ${theme.tabs.research.name}`);
        }
    }

    updateResourceNames(theme) {
        const resources = theme.resources;
        
        // Update resource icons (emojis)
        this.updateTextContent('stone-icon', resources.stone.emoji);
        this.updateTextContent('coal-icon', resources.coal.emoji);
        this.updateTextContent('iron-icon', resources.iron.emoji);
        this.updateTextContent('silver-icon', resources.silver.emoji);
        this.updateTextContent('gold-icon', resources.gold.emoji);
        
        // Update resource display labels (just name, no emoji)
        this.updateTextContent('stone-label', resources.stone.name + ':');
        this.updateTextContent('coal-label', resources.coal.name + ':');
        this.updateTextContent('iron-label', resources.iron.name + ':');
        this.updateTextContent('silver-label', resources.silver.name + ':');
        this.updateTextContent('gold-label', resources.gold.name + ':');
        
        // Update tooltips
        this.updateTooltip('stone-label', resources.stone.description);
        this.updateTooltip('coal-label', resources.coal.description);
        this.updateTooltip('iron-label', resources.iron.description);
        this.updateTooltip('silver-label', resources.silver.description);
        this.updateTooltip('gold-label', resources.gold.description);
        
        // Update mining buttons
        this.updateButtonText('mine-stone-btn', `Gather ${resources.stone.name}`);
        
        // Update sell buttons
        this.updateButtonText('sell-stone-btn', `Sell ${resources.stone.name}`);
        this.updateButtonText('sell-coal-btn', `Sell ${resources.coal.name}`);
        this.updateButtonText('sell-iron-btn', `Sell ${resources.iron.name}`);
        this.updateButtonText('sell-silver-btn', `Sell ${resources.silver.name}`);
    }

    updateWorkerNames(theme) {
        const workers = theme.workers;
        const resources = theme.resources;
        
        console.log('updateWorkerNames called with:', workers);
        
        // Update section headers
        this.updateTextContent('mining-operations-header', `${theme.tabs.mining.emoji} ${theme.tabs.mining.name} Operations`);
        this.updateTextContent('workforce-header', `👥 Workforce Status`);
        
        // Update manual mine button
        this.updateButtonText('mine-stone-btn', `Gather ${resources.stone.name}`);
        this.updateButtonDescription('mine-stone-btn', `+1 ${resources.stone.name.toLowerCase()} per click`);
        
        // Update hire buttons (titles and descriptions)
        console.log('Updating hire-stone-miner-btn to:', `Hire ${workers.stoneMiners.name}`);
        this.updateButtonText('hire-stone-miner-btn', `Hire ${workers.stoneMiners.name}`);
        this.updateButtonText('hire-coal-miner-btn', `Hire ${workers.coalMiners.name}`);
        this.updateButtonText('hire-iron-miner-btn', `Hire ${workers.ironMiners.name}`);
        this.updateButtonText('hire-silver-miner-btn', `Hire ${workers.silverMiners.name}`);
        
        // Update worker button descriptions with themed resource names
        this.updateButtonDescription('hire-stone-miner-btn', `+1 ${resources.stone.name.toLowerCase()}/sec`);
        this.updateButtonDescription('hire-coal-miner-btn', `+1 ${resources.coal.name.toLowerCase()}/sec`);
        this.updateButtonDescription('hire-iron-miner-btn', `+1 ${resources.iron.name.toLowerCase()}/sec`);
        this.updateButtonDescription('hire-silver-miner-btn', `+1 ${resources.silver.name.toLowerCase()}/sec`);
        
        // Update workforce status labels
        this.updateTextContent('stone-miners-label', `${workers.stoneMiners.name}:`);
        this.updateTextContent('coal-miners-label', `${workers.coalMiners.name}:`);
        this.updateTextContent('iron-miners-label', `${workers.ironMiners.name}:`);
        this.updateTextContent('silver-miners-label', `${workers.silverMiners.name}:`);
    }

    updateProcessorNames(theme) {
        const processors = theme.processors;
        
        // Update section header
        this.updateTextContent('processing-header', `${theme.tabs.processing.emoji} ${theme.tabs.processing.name} Systems`);
        
        // Update build buttons
        this.updateButtonTextAndDesc('build-smelter-btn', `Build ${processors.smelters.name}`, processors.smelters.description);
        this.updateButtonTextAndDesc('build-forge-btn', `Build ${processors.forges.name}`, processors.forges.description);
        this.updateButtonTextAndDesc('build-refinery-btn', `Build ${processors.refineries.name}`, processors.refineries.description);
        this.updateButtonTextAndDesc('build-mint-btn', `Build ${processors.mints.name}`, processors.mints.description);
        
        // Update status labels
        this.updateTextContent('smelters-label', `${processors.smelters.name}:`);
        this.updateTextContent('forges-label', `${processors.forges.name}:`);
        this.updateTextContent('refineries-label', `${processors.refineries.name}:`);
        this.updateTextContent('mints-label', `${processors.mints.name}:`);
    }

    updateTraderNames(theme) {
        const traders = theme.traders;
        const resources = theme.resources;
        
        // Update section header
        this.updateTextContent('market-header', `${theme.tabs.market.emoji} ${theme.tabs.market.name}`);
        
        // Update sell button descriptions with themed currency
        const currencyName = resources.gold.name.toLowerCase();
        
        this.updateTextContent('stone-sell-currency', `${currencyName}/${resources.stone.name.toLowerCase()}`);
        this.updateTextContent('sell-stone-desc', `Convert ${resources.stone.name.toLowerCase()} to ${currencyName}`);
        
        this.updateTextContent('coal-sell-currency', `${currencyName}/${resources.coal.name.toLowerCase()}`);
        this.updateTextContent('sell-coal-desc', `Convert ${resources.coal.name.toLowerCase()} to ${currencyName}`);
        
        this.updateTextContent('iron-sell-currency', `${currencyName}/${resources.iron.name.toLowerCase()}`);
        this.updateTextContent('sell-iron-desc', `Convert ${resources.iron.name.toLowerCase()} to ${currencyName}`);
        
        this.updateTextContent('silver-sell-currency', `${currencyName}/${resources.silver.name.toLowerCase()}`);
        this.updateTextContent('sell-silver-desc', `Convert ${resources.silver.name.toLowerCase()} to ${currencyName}`);
        
        // Update hire buttons
        this.updateButtonText('hire-stone-trader-btn', `Hire ${traders.stoneTraders.name}`);
        this.updateButtonText('hire-coal-trader-btn', `Hire ${traders.coalTraders.name}`);
        this.updateButtonText('hire-metal-trader-btn', `Hire ${traders.metalTraders.name}`);
        
        // Update trader button descriptions
        this.updateTextContent('hire-stone-trader-desc', `Auto-sell ${resources.stone.name.toLowerCase()}`);
        this.updateTextContent('hire-coal-trader-desc', `Auto-sell ${resources.coal.name.toLowerCase()}`);
        this.updateTextContent('hire-metal-trader-desc', `Auto-sell ${resources.iron.name.toLowerCase()} & ${resources.silver.name.toLowerCase()}`);
        
        // Update status labels
        this.updateTextContent('stone-traders-label', `${traders.stoneTraders.name}:`);
        this.updateTextContent('coal-traders-label', `${traders.coalTraders.name}:`);
        this.updateTextContent('metal-traders-label', `${traders.metalTraders.name}:`);
    }

    updateTransportNames(theme) {
        const transport = theme.transport;
        
        // Update section headers
        this.updateTextContent('transport-header', `${theme.tabs.transport.emoji} ${theme.tabs.transport.name} Fleet`);
        this.updateTextContent('fleet-status-header', `🚚 ${theme.tabs.transport.name} Status`);
        
        // Update buy buttons
        this.updateButtonText('buy-cart-btn', `Buy ${transport.carts.name}`);
        this.updateButtonText('buy-wagon-btn', `Buy ${transport.wagons.name}`);
        this.updateButtonText('buy-train-btn', `Buy ${transport.trains.name}`);
        
        // Update status labels
        this.updateTextContent('carts-label', `${transport.carts.name}:`);
        this.updateTextContent('wagons-label', `${transport.wagons.name}:`);
        this.updateTextContent('trains-label', `${transport.trains.name}:`);
    }

    updateCityNames(theme) {
        const city = theme.city;
        const resources = theme.resources;
        
        // Update section headers
        this.updateTextContent('city-header', `${theme.tabs.city.emoji} ${theme.tabs.city.name} HQ`);
        this.updateTextContent('city-status-header', `🏛️ ${theme.tabs.city.name} Status`);
        this.updateTextContent('city-dynamics-header', `📈 ${theme.tabs.city.name} Dynamics`);
        this.updateTextContent('city-inventory-header', `📦 ${theme.tabs.city.name} Finished Inventory`);
        
        // Update hire/build buttons
        this.updateButtonText('hire-police-btn', `Hire ${city.police.name}`);
        this.updateButtonText('hire-politician-btn', `Hire ${city.politicians.name}`);
        this.updateButtonText('build-bank-btn', `Build ${city.banks.name}`);
        this.updateButtonText('build-market-btn', `Build ${city.markets.name}`);
        this.updateButtonText('build-university-btn', `Build ${city.universities.name}`);
        
        // Update new upgrade buttons
        this.updateButtonText('build-sales-department-btn', `Build ${city.salesDepartment.name}`);
        // Mining Academy and Automation Lab buttons handled in GameEngine.js with dynamic titles
        
        // Update button descriptions with theme-specific names
        this.updateButtonDescription('build-university-btn', `+10% global efficiency per ${city.universities.name.toLowerCase()}`);
        this.updateButtonDescription('hire-politician-btn', `+5% trading efficiency per ${city.politicians.name.toLowerCase()}`);
        this.updateButtonDescription('build-market-btn', `+15% trading efficiency per ${city.markets.name.toLowerCase()}`);
        this.updateButtonDescription('build-bank-btn', `+20% to ALL city sales (stacks!)`);
        
        // Update status labels
        this.updateLabel('police-label', `${city.police.name}:`);
        this.updateLabel('politicians-label', `${city.politicians.name}:`);
        this.updateLabel('banks-label', `${city.banks.name}:`);
        this.updateLabel('markets-label', `${city.markets.name}:`);
        this.updateLabel('universities-label', `${city.universities.name}:`);
        this.updateLabel('sales-department-label', `${city.salesDepartment.name}:`);
        this.updateLabel('mining-academy-label', `${city.miningAcademy.name}:`);
        this.updateLabel('automation-lab-label', `${city.automationLab.name}:`);
        
        // Update sell button costs with themed bank name
        const sellButtons = [
            { id: 'sell-city-basic-btn', value: 3, tier: 'basic' },
            { id: 'sell-city-intermediate-btn', value: 9, tier: 'intermediate' },
            { id: 'sell-city-advanced-btn', value: 30, tier: 'advanced' },
            { id: 'sell-city-premium-btn', value: 120, tier: 'premium' }
        ];
        
        sellButtons.forEach(btn => {
            const button = document.getElementById(btn.id);
            if (button && theme.crafting && theme.crafting[btn.tier]) {
                const craftData = theme.crafting[btn.tier];
                
                // Update title
                const titleDiv = button.querySelector('.btn-title');
                if (titleDiv) {
                    titleDiv.textContent = `💰 Sell ${craftData.result} from ${theme.tabs.city.name}`;
                }
                
                // Update cost
                const costDiv = button.querySelector('.btn-cost');
                if (costDiv) {
                    costDiv.innerHTML = `${btn.value} <span class="themed-currency">${resources.gold.name.toLowerCase()}</span> (+20% per ${city.banks.name})`;
                }
                
                // Update description
                const descDiv = button.querySelector('.btn-description');
                if (descDiv) {
                    descDiv.textContent = `Sell all ${craftData.result} in ${theme.tabs.city.name.toLowerCase()}`;
                }
            }
        });
    }

    updateCraftingNames(theme) {
        if (!theme.crafting) return;
        
        const crafting = theme.crafting;
        const resources = theme.resources;
        
        // Update crafting button titles and descriptions
        if (crafting.basic) {
            this.updateTextContent('craft-basic-btn', crafting.basic.title);
            const basicBtn = document.getElementById('craft-basic-btn');
            if (basicBtn) {
                const titleDiv = basicBtn.querySelector('.btn-title');
                const descDiv = basicBtn.querySelector('.btn-description');
                if (titleDiv) titleDiv.textContent = `${crafting.basic.emoji} ${crafting.basic.title}`;
                if (descDiv) descDiv.textContent = `→ ${crafting.basic.result} (Sells for 3 ${resources.gold.name.toLowerCase()})`;
            }
        }
        
        if (crafting.intermediate) {
            const intBtn = document.getElementById('craft-intermediate-btn');
            if (intBtn) {
                const titleDiv = intBtn.querySelector('.btn-title');
                const descDiv = intBtn.querySelector('.btn-description');
                if (titleDiv) titleDiv.textContent = `${crafting.intermediate.emoji} ${crafting.intermediate.title}`;
                if (descDiv) descDiv.textContent = `→ ${crafting.intermediate.result} (Sells for 9 ${resources.gold.name.toLowerCase()})`;
            }
        }
        
        if (crafting.advanced) {
            const advBtn = document.getElementById('craft-advanced-btn');
            if (advBtn) {
                const titleDiv = advBtn.querySelector('.btn-title');
                const descDiv = advBtn.querySelector('.btn-description');
                if (titleDiv) titleDiv.textContent = `${crafting.advanced.emoji} ${crafting.advanced.title}`;
                if (descDiv) descDiv.textContent = `→ ${crafting.advanced.result} (Sells for 30 ${resources.gold.name.toLowerCase()})`;
            }
        }
        
        if (crafting.premium) {
            const premBtn = document.getElementById('craft-premium-btn');
            if (premBtn) {
                const titleDiv = premBtn.querySelector('.btn-title');
                const descDiv = premBtn.querySelector('.btn-description');
                if (titleDiv) titleDiv.textContent = `${crafting.premium.emoji} ${crafting.premium.title}`;
                if (descDiv) descDiv.textContent = `→ ${crafting.premium.result} (Sells for 120 ${resources.gold.name.toLowerCase()})`;
            }
        }
    }

    updateResearchNames(theme) {
        if (!theme.research) return;
        
        const research = theme.research;
        
        // Update research button titles and descriptions
        if (research.mining) {
            this.updateTextContent('research-mining-title', research.mining.name);
            this.updateTextContent('research-mining-desc', research.mining.description);
        }
        if (research.processing) {
            this.updateTextContent('research-processing-title', research.processing.name);
            this.updateTextContent('research-processing-desc', research.processing.description);
        }
        if (research.automation) {
            this.updateTextContent('research-automation-title', research.automation.name);
            this.updateTextContent('research-automation-desc', research.automation.description);
        }
        if (research.logistics) {
            this.updateTextContent('research-logistics-title', research.logistics.name);
            this.updateTextContent('research-logistics-desc', research.logistics.description);
        }
    }

    updateUnlockNames(theme) {
        if (!theme.unlocks) return;
        
        const unlocks = theme.unlocks;
        
        // Update each unlock button with themed text
        const unlockButtons = document.querySelectorAll('.unlock-btn[data-unlock]');
        unlockButtons.forEach(btn => {
            const unlockType = btn.getAttribute('data-unlock');
            if (unlocks[unlockType]) {
                const titleDiv = btn.querySelector('.btn-title');
                const descDiv = btn.querySelector('.btn-description');
                
                if (titleDiv) titleDiv.textContent = unlocks[unlockType].title;
                if (descDiv) descDiv.textContent = unlocks[unlockType].description;
            }
        });
    }

    updateRebirthButton(theme) {
        const btn = document.getElementById('rebirth-btn');
        if (btn) {
            const titleDiv = btn.querySelector('.btn-title');
            if (titleDiv) {
                titleDiv.textContent = `${theme.rebirthButton.emoji} ${theme.rebirthButton.text}`;
            }
            
            // Update button class for final ending
            if (theme.isEnding) {
                btn.classList.add('ending-btn');
                btn.style.background = 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)';
                btn.style.border = '2px solid #ffffff';
            } else {
                btn.classList.remove('ending-btn');
                btn.style.background = '';
                btn.style.border = '';
            }
        }
    }

    updateAtmosphere(theme) {
        const container = document.getElementById('game-container');
        if (!container) return;
        
        // Remove old atmosphere classes
        container.classList.remove('atmosphere-bright', 'atmosphere-neutral', 'atmosphere-dim', 
                                   'atmosphere-dark', 'atmosphere-darker', 'atmosphere-grim', 
                                   'atmosphere-bleak', 'atmosphere-desolate', 'atmosphere-sterile', 
                                   'atmosphere-void');
        
        // Add new atmosphere class
        container.classList.add(`atmosphere-${theme.atmosphere}`);
        
        // Special handling for ending
        if (theme.isEnding) {
            container.classList.add('game-ending');
        } else {
            container.classList.remove('game-ending');
        }
    }

    updateCostCurrency(theme) {
        const currencyName = theme.resources.gold.name.toLowerCase();
        
        // List of all possible currency names from all themes (lowercase)
        const allCurrencies = [
            'gold', 'venture capital', 'cash', 'company funds', 'savings', 
            'coins', 'canned food', 'will to live', 'time', 'goodbye'
        ];
        
        // Update all .btn-cost divs
        const costDivs = document.querySelectorAll('.btn-cost');
        costDivs.forEach(div => {
            let text = div.innerHTML;
            
            // Replace any currency name with the current theme's currency
            allCurrencies.forEach(oldCurrency => {
                // Pattern 1: "</span> gold" (for buttons with span tags)
                const spanPattern = new RegExp(`</span> ${oldCurrency}`, 'gi');
                text = text.replace(spanPattern, `</span> ${currencyName}`);
                
                // Pattern 2: "25 gold" or "Cost: 25 gold" (for unlock buttons without span tags)
                const directPattern = new RegExp(`(\\d+) ${oldCurrency}\\b`, 'gi');
                text = text.replace(directPattern, `$1 ${currencyName}`);
                
                // Also handle "currency/resource" patterns
                const slashPattern = new RegExp(`${oldCurrency}/`, 'gi');
                text = text.replace(slashPattern, `${currencyName}/`);
            });
            
            div.innerHTML = text;
        });
        
        // Update all .btn-description divs
        const descDivs = document.querySelectorAll('.btn-description');
        descDivs.forEach(div => {
            let text = div.textContent;
            
            // Replace "to [currency]" patterns
            allCurrencies.forEach(oldCurrency => {
                const toPattern = new RegExp(`to ${oldCurrency}`, 'gi');
                text = text.replace(toPattern, `to ${currencyName}`);
                
                const convertPattern = new RegExp(`Convert resources to ${oldCurrency}`, 'gi');
                text = text.replace(convertPattern, `Convert resources to ${currencyName}`);
            });
            
            div.textContent = text;
        });
    }

    // Helper methods
    updateTextContent(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }

    updateTooltip(elementId, tooltip) {
        const element = document.getElementById(elementId);
        if (element) {
            element.setAttribute('data-tooltip', tooltip);
            element.setAttribute('title', tooltip);
        }
    }

    updateButtonText(buttonId, text) {
        const button = document.getElementById(buttonId);
        if (button) {
            const titleDiv = button.querySelector('.btn-title');
            if (titleDiv) {
                titleDiv.textContent = text;
            } else {
                // Fallback if no btn-title div
                const firstChild = button.firstChild;
                if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
                    firstChild.textContent = text;
                }
            }
        }
    }

    updateButtonTextAndDesc(buttonId, text, description) {
        const button = document.getElementById(buttonId);
        if (button) {
            const titleDiv = button.querySelector('.btn-title');
            const descDiv = button.querySelector('.btn-description');
            
            if (titleDiv) titleDiv.textContent = text;
            if (descDiv) descDiv.textContent = description;
        }
    }

    updateButtonDescription(buttonId, description) {
        const button = document.getElementById(buttonId);
        if (button) {
            const descDiv = button.querySelector('.btn-description');
            if (descDiv) {
                descDiv.textContent = description;
            }
        }
    }

    updateLabel(labelClass, text) {
        // Try finding by exact ID first
        let element = document.getElementById(labelClass);
        
        // Try finding by class
        if (!element) {
            const elements = document.querySelectorAll(`.${labelClass}`);
            if (elements.length > 0) {
                element = elements[0];
            }
        }
        
        // Try finding parent row and updating the first span
        if (!element) {
            const parentId = labelClass.replace('-label', '');
            const parent = document.getElementById(parentId);
            if (parent) {
                const span = parent.querySelector('.resource-type');
                if (span) {
                    element = span;
                }
            }
        }
        
        if (element) {
            element.textContent = text;
        }
    }

    // Handle game ending
    handleGameEnding() {
        if (!this.currentTheme || !this.currentTheme.isEnding) return;
        
        // Show ending modal or message
        const message = `
            The journey ends here.
            
            You've witnessed the rise and fall of empires,
            from tech giants to mere survival,
            and finally... to peace.
            
            Thank you for playing Industrial Empire.
        `;
        
        if (this.gameEngine.showNotification) {
            this.gameEngine.showNotification(message);
        }
        
        // Optionally disable all actions except viewing stats
        const actionButtons = document.querySelectorAll('.action-btn:not(#rebirth-btn)');
        actionButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.3';
        });
    }
}

// Export for use in other modules
window.UIThemeManager = UIThemeManager;
