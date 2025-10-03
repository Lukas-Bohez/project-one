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
        this.updateResourceNames(theme);
        this.updateWorkerNames(theme);
        this.updateProcessorNames(theme);
        this.updateTraderNames(theme);
        this.updateTransportNames(theme);
        this.updateCityNames(theme);
        this.updateRebirthButton(theme);
        this.updateAtmosphere(theme);
        
        // Show theme change notification
        if (this.gameEngine.showNotification) {
            this.gameEngine.showNotification(`🔄 ${theme.description}`);
        }
    }

    updatePageTitle(theme) {
        document.title = `Industrial Empire - ${theme.name}`;
        
        // Update main header if exists
        const header = document.querySelector('.game-header h1');
        if (header) {
            header.textContent = `Industrial Empire: ${theme.name}`;
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

    updateResourceNames(theme) {
        const resources = theme.resources;
        
        // Update resource display labels
        this.updateTextContent('stone-label', resources.stone.emoji + ' ' + resources.stone.name);
        this.updateTextContent('coal-label', resources.coal.emoji + ' ' + resources.coal.name);
        this.updateTextContent('iron-label', resources.iron.emoji + ' ' + resources.iron.name);
        this.updateTextContent('silver-label', resources.silver.emoji + ' ' + resources.silver.name);
        this.updateTextContent('gold-label', resources.gold.emoji + ' ' + resources.gold.name);
        
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
        
        // Update hire buttons
        this.updateButtonText('hire-stone-miner-btn', `Hire ${workers.stoneMiners.name}`);
        this.updateButtonText('hire-coal-miner-btn', `Hire ${workers.coalMiners.name}`);
        this.updateButtonText('hire-iron-miner-btn', `Hire ${workers.ironMiners.name}`);
        this.updateButtonText('hire-silver-miner-btn', `Hire ${workers.silverMiners.name}`);
        
        // Update status display labels
        this.updateLabel('stone-miners-label', `${workers.stoneMiners.emoji} ${workers.stoneMiners.name}:`);
        this.updateLabel('coal-miners-label', `${workers.coalMiners.emoji} ${workers.coalMiners.name}:`);
        this.updateLabel('iron-miners-label', `${workers.ironMiners.emoji} ${workers.ironMiners.name}:`);
        this.updateLabel('silver-miners-label', `${workers.silverMiners.emoji} ${workers.silverMiners.name}:`);
    }

    updateProcessorNames(theme) {
        const processors = theme.processors;
        
        // Update build buttons
        this.updateButtonTextAndDesc('build-smelter-btn', `Build ${processors.smelters.name}`, processors.smelters.description);
        this.updateButtonTextAndDesc('build-forge-btn', `Build ${processors.forges.name}`, processors.forges.description);
        this.updateButtonTextAndDesc('build-refinery-btn', `Build ${processors.refineries.name}`, processors.refineries.description);
        this.updateButtonTextAndDesc('build-mint-btn', `Build ${processors.mints.name}`, processors.mints.description);
        
        // Update status labels
        this.updateLabel('smelters-label', `${processors.smelters.name}:`);
        this.updateLabel('forges-label', `${processors.forges.name}:`);
        this.updateLabel('refineries-label', `${processors.refineries.name}:`);
        this.updateLabel('mints-label', `${processors.mints.name}:`);
    }

    updateTraderNames(theme) {
        const traders = theme.traders;
        
        // Update hire buttons
        this.updateButtonText('hire-stone-trader-btn', `Hire ${traders.stoneTraders.name}`);
        this.updateButtonText('hire-coal-trader-btn', `Hire ${traders.coalTraders.name}`);
        this.updateButtonText('hire-metal-trader-btn', `Hire ${traders.metalTraders.name}`);
        
        // Update status labels
        this.updateLabel('stone-traders-label', `${traders.stoneTraders.name}:`);
        this.updateLabel('coal-traders-label', `${traders.coalTraders.name}:`);
        this.updateLabel('metal-traders-label', `${traders.metalTraders.name}:`);
    }

    updateTransportNames(theme) {
        const transport = theme.transport;
        
        // Update buy buttons
        this.updateButtonText('buy-cart-btn', `Buy ${transport.carts.name}`);
        this.updateButtonText('buy-wagon-btn', `Buy ${transport.wagons.name}`);
        this.updateButtonText('buy-train-btn', `Buy ${transport.trains.name}`);
        
        // Update status labels
        this.updateLabel('carts-label', `${transport.carts.name}:`);
        this.updateLabel('wagons-label', `${transport.wagons.name}:`);
        this.updateLabel('trains-label', `${transport.trains.name}:`);
    }

    updateCityNames(theme) {
        const city = theme.city;
        
        // Update hire/build buttons
        this.updateButtonText('hire-police-btn', `Hire ${city.police.name}`);
        this.updateButtonText('hire-politician-btn', `Hire ${city.politicians.name}`);
        this.updateButtonText('build-bank-btn', `Build ${city.banks.name}`);
        this.updateButtonText('build-market-btn', `Build ${city.markets.name}`);
        this.updateButtonText('build-university-btn', `Build ${city.universities.name}`);
        
        // Update status labels
        this.updateLabel('police-label', `${city.police.name}:`);
        this.updateLabel('politicians-label', `${city.politicians.name}:`);
        this.updateLabel('banks-label', `${city.banks.name}:`);
        this.updateLabel('markets-label', `${city.markets.name}:`);
        this.updateLabel('universities-label', `${city.universities.name}:`);
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
