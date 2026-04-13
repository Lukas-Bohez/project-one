// Global variable to store current user
let currentUser = null;
let itemUpdateInterval = null;
let availableSVGs = [];
let isLoadingItems = false; // Prevent concurrent loads

// Scan folder for SVG files
const scanFolderForSVGs = async () => {
    try {
        console.log('🔍 Scanning folder for SVG files:', '/svg/');
        const response = await fetch('/svg/');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Cannot access SVG folder`);
        }
        const html = await response.text();
        
        // Parse the directory listing HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Look for SVG file links
        let svgLinks = [];
        const linkSelectors = [
            'a[href$=".svg"]', // Direct SVG links
            'a[href*=".svg"]', // Contains SVG extension
            'a[href$=".SVG"]', // Uppercase
            'a[href*=".SVG"]'  // Uppercase contains
        ];
        
        for (const selector of linkSelectors) {
            const links = doc.querySelectorAll(selector);
            if (links.length > 0) {
                svgLinks = Array.from(links);
                break;
            }
        }
        
        // Extract filenames
        const files = svgLinks.map((link) => {
            let href = link.getAttribute('href');
            // Clean up the href
            if (href.startsWith('/')) {
                href = href.substring(1);
            }
            // Get just the filename
            const filename = href.split('/').pop().split('?')[0];
            return filename;
        }).filter(filename => {
            const lower = filename.toLowerCase();
            return lower.endsWith('.svg') &&
                filename !== '' &&
                !filename.includes('..'); // Security: no parent directory access
        });
        
        console.log('🖼️ Found SVG files:', files);
        return files;
    } catch (error) {
        console.warn('SVG folder scanning failed:', error.message);
        // Try alternative method: attempt to load common index files
        try {
            const indexResponse = await fetch('/svg/index.json');
            if (indexResponse.ok) {
                const indexData = await indexResponse.json();
                if (Array.isArray(indexData)) {
                    console.log('📋 Using SVG index.json file list');
                    return indexData.filter(f => {
                        const lower = f.toLowerCase();
                        return lower.endsWith('.svg');
                    });
                }
            }
        } catch (e) {
            // Index.json doesn't exist, that's fine
        }
        
        throw error;
    }
};

// Listen for user authentication
document.addEventListener('userAuthenticated', (event) => {
    console.log("🔐 User authenticated event received");
    const user = event.detail?.user;
    console.log("User data:", user);
    
    if (!user || !user.id) {
        console.error("❌ Invalid user data received:", user);
        return;
    }
    
    currentUser = user;
    
    // Load player items when user is authenticated
    console.log("🔄 Loading items for authenticated user");
    loadPlayerItems();
    
    // Start auto-refresh interval (every 2 seconds to reduce flashing)
    startItemAutoRefresh();
});

// Function to start auto-refresh of items
const startItemAutoRefresh = () => {
    // Clear any existing interval
    if (itemUpdateInterval) {
        clearInterval(itemUpdateInterval);
    }
    
    console.log("⏰ Starting item auto-refresh (2 second interval)");
    
    // Set up new interval to refresh every 2 seconds
    itemUpdateInterval = setInterval(() => {
        if (currentUser && currentUser.id && !isLoadingItems) {
            loadPlayerItems();
        }
    }, 2000);
};

// Function to stop auto-refresh
const stopItemAutoRefresh = () => {
    if (itemUpdateInterval) {
        clearInterval(itemUpdateInterval);
        itemUpdateInterval = null;
        console.log("⏹️ Stopped item auto-refresh");
    }
};

// Function to load and display player items
const loadPlayerItems = async () => {
    if (!currentUser || !currentUser.id) {
        console.log("❌ No user authenticated - clearing slots");
        clearAllItemSlots();
        return;
    }

    if (isLoadingItems) {
        console.log("⏳ Items already loading, skipping");
        return;
    }

    try {
        isLoadingItems = true;
        console.log("📦 Loading items for user:", currentUser.id);
        
        const response = await fetch(`/api/player/${currentUser.id}/items`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("📊 Items API response:", data);
        
        if (data.success) {
            console.log("✅ Items loaded successfully:", data.items);
            
            // Validate items array
            if (!Array.isArray(data.items)) {
                console.error("❌ Items is not an array:", typeof data.items, data.items);
                clearAllItemSlots();
                return;
            }
            
            displayPlayerItems(data.items);
        } else {
            console.error("❌ Failed to load items:", data.error);
            clearAllItemSlots();
        }
    } catch (error) {
        console.error("💥 Error loading player items:", error);
        clearAllItemSlots();
    } finally {
        isLoadingItems = false;
    }
};

// Function to display items in the 3 slots (supports stacks and total cap = 3)
const displayPlayerItems = (items) => {
    console.log("🎮 Displaying items:", items);

    // Validate input
    if (!Array.isArray(items)) {
        console.error("❌ displayPlayerItems called with invalid items:", items);
        clearAllItemSlots();
        return;
    }

    // Build display slots that respect the max total items (3). Each slot may
    // represent a stack of the same item (quantity > 1). We show as many items
    // as possible up to the 3-item capacity.
    const maxSlots = 3;
    let remainingCapacity = 3; // total items we can show
    const slots = [];

    for (const item of items) {
        if (remainingCapacity <= 0) break;
        const totalQty = item.quantity || 1;
        const takeQty = Math.min(totalQty, remainingCapacity);
        if (takeQty <= 0) continue;
        slots.push({ item: item, displayQuantity: takeQty });
        remainingCapacity -= takeQty;
    }

    // If there are fewer than 3 physical slots filled, we'll leave the remainder empty
    console.log(`📋 Slots to show: ${slots.length}, remainingCapacity: ${remainingCapacity}`, slots);

    // Process each visual slot (3 fixed slots in the UI)
    for (let slotIndex = 0; slotIndex < maxSlots; slotIndex++) {
        const slotNumber = slotIndex + 1;
        const slotElement = document.getElementById(`item${slotNumber}`);
        const slotData = slots[slotIndex];

        if (!slotElement) {
            console.error(`❌ Slot element #item${slotNumber} not found in DOM`);
            continue;
        }

        // Determine new slot data
        const newItem = slotData ? slotData.item : null;
        const newItemId = newItem ? (newItem.itemId || newItem.id) : null;

        // Get current slot data
        const currentItemId = slotElement.getAttribute('data-item-id');

        const needsUpdate = currentItemId !== (newItemId || '');

        if (needsUpdate) {
            if (newItem && newItemId) {
                // Attach displayQuantity to the item for rendering
                const itemWithDisplay = { ...newItem, displayQuantity: slotData.displayQuantity };
                try {
                    populateItemSlot(slotElement, itemWithDisplay, slotNumber);
                    console.log(`✅ Updated slot ${slotNumber} with item`, itemWithDisplay);
                } catch (error) {
                    console.error(`💥 Error updating slot ${slotNumber}:`, error);
                }
            } else {
                // Clear empty slot
                clearItemSlot(slotElement);
                console.log(`🧹 Cleared empty slot ${slotNumber}`);
            }
        } else {
            console.log(`⏭️ Slot ${slotNumber} unchanged, skipping update`);
        }
    }

    console.log("🏁 Finished displaying all items");
};

// Function to populate an individual item slot
const populateItemSlot = (slotElement, item, slotNumber) => {
    console.log(`🔧 populateItemSlot called for slot ${slotNumber}:`, item);
    
    // Validate inputs
    if (!slotElement) {
        console.error("❌ populateItemSlot: slotElement is null");
        return;
    }
    
    if (!item) {
        console.error("❌ populateItemSlot: item is null");
        return;
    }
    
    const itemId = item.itemId || item.id;
    const itemName = item.name || 'Unknown Item';
    
    console.log(`📝 Setting up slot ${slotNumber} with:`, {
        id: itemId,
        name: itemName,
        rarity: item.rarity
    });
    
    try {
        // Add item data attributes
        slotElement.setAttribute('data-item-id', itemId);
        slotElement.setAttribute('data-item-name', itemName);
        slotElement.setAttribute('data-quantity', '1'); // Always 1 now
        
        // Add visual indicator that slot has an item
        slotElement.classList.add('has-item');
        
        // Make the slot clickable with better mobile support
        slotElement.style.cursor = 'pointer';
        slotElement.style.userSelect = 'none';
        slotElement.style.webkitTapHighlightColor = 'transparent';
        
        // Set rarity class for styling
        if (item.rarity) {
            slotElement.setAttribute('data-rarity', item.rarity);
            // Remove existing rarity classes
            slotElement.className = slotElement.className.replace(/rarity-\w+/g, '');
            slotElement.classList.add(`rarity-${item.rarity}`);
        }
        
        // Setup the icon
        setupItemIcon(slotElement, item, slotNumber);
        
        // Setup click event listener
        setupItemClickHandler(slotElement, item);
        
        console.log(`✅ Successfully populated slot ${slotNumber} with click handler`);
        
    } catch (error) {
        console.error(`💥 Error in populateItemSlot for slot ${slotNumber}:`, error);
        throw error; // Re-throw to be caught by caller
    }
};

// Remove the setupItemQuantityDisplay function entirely since we don't need it anymore

// Function to clear an individual item slot
const clearItemSlot = (slotElement) => {
    if (!slotElement) {
        console.warn("⚠️ clearItemSlot called with null element");
        return;
    }
    
    // Remove data attributes
    slotElement.removeAttribute('data-item-id');
    slotElement.removeAttribute('data-item-name');
    slotElement.removeAttribute('data-quantity');
    slotElement.removeAttribute('data-rarity');
    
    // Remove classes
    slotElement.classList.remove('has-item');
    slotElement.className = slotElement.className.replace(/rarity-\w+/g, '');
    
    // Reset styles
    slotElement.style.cursor = 'default';
    slotElement.style.transform = 'scale(1)';
    
    // Remove the icon
    const existingIcon = slotElement.querySelector('.c-item-icon');
    if (existingIcon) {
        existingIcon.remove();
    }
    
    // Remove event listeners by cloning the element
    const newSlotElement = slotElement.cloneNode(true);
    slotElement.parentNode.replaceChild(newSlotElement, slotElement);
};

// Separate function to handle icon setup with improved scaling
const setupItemIcon = (slotElement, item, slotNumber) => {
    const itemName = item.name || 'Unknown Item';
    
    // Look for existing icon or create one
    let iconElement = slotElement.querySelector('.c-item-icon');
    if (!iconElement) {
        iconElement = document.createElement('img');
        iconElement.className = 'c-item-icon';
        iconElement.style.cssText = `
            width: 100%;
            height: 100%;
            max-width: 48px;
            max-height: 48px;
            object-fit: contain;
            object-position: center;
            display: block;
            margin: 0 auto;
            position: relative;
            z-index: 1;
            border-radius: 4px;
            pointer-events: none;
        `;
        slotElement.appendChild(iconElement);
    }
    
    // Set default state
    iconElement.alt = itemName;
    iconElement.title = itemName; // Tooltip for item name
    
    // Use logoUrl if available
    const resolvedLogoUrl = resolveItemLogoUrl(item.logoUrl);
    if (resolvedLogoUrl) {
        console.log(`🖼️ Using logoUrl for slot ${slotNumber}:`, resolvedLogoUrl);
        iconElement.src = resolvedLogoUrl;
        
        iconElement.onerror = () => {
            console.warn(`❌ logoUrl failed to load for ${itemName}:`, resolvedLogoUrl);
            // Try SVG fallback if logoUrl fails
            trySetSVGIcon(iconElement, itemName, slotNumber);
        };
        
        iconElement.onload = () => {
            console.log(`✅ logoUrl loaded for ${itemName}`);
        };
    } else {
        // Try to find matching SVG
        trySetSVGIcon(iconElement, itemName, slotNumber);
    }
};

const resolveItemLogoUrl = (logoUrl) => {
    if (!logoUrl || typeof logoUrl !== 'string') {
        return null;
    }

    const cleanUrl = logoUrl.split('?')[0].split('#')[0];
    const fileName = cleanUrl.split('/').pop()?.trim();

    if (!fileName || !fileName.toLowerCase().endsWith('.svg')) {
        return null;
    }

    if (availableSVGs.length > 0) {
        const matchingSVG = availableSVGs.find(svg => svg.toLowerCase() === fileName.toLowerCase());
        if (matchingSVG) {
            return `/svg/${matchingSVG}`;
        }
        return null;
    }

    return `/svg/${fileName}`;
};

// New function to setup quantity display
const setupItemQuantityDisplay = (slotElement, quantity) => {
    // Remove existing quantity display
    const existingQuantity = slotElement.querySelector('.c-item-quantity');
    if (existingQuantity) {
        existingQuantity.remove();
    }
    
    // Only show quantity if it's greater than 1
    if (quantity > 1) {
        const quantityElement = document.createElement('div');
        quantityElement.className = 'c-item-quantity';
        quantityElement.textContent = quantity.toString();
        quantityElement.style.cssText = `
            position: absolute;
            bottom: 2px;
            right: 2px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            font-size: 10px;
            font-weight: bold;
            padding: 1px 4px;
            border-radius: 8px;
            min-width: 14px;
            text-align: center;
            z-index: 10;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            pointer-events: none;
        `;
        
        slotElement.appendChild(quantityElement);
        console.log(`📊 Added quantity display: ${quantity}`);
    }
};

// Helper function to try setting SVG icon
const trySetSVGIcon = (iconElement, itemName, slotNumber) => {
    if (itemName && availableSVGs.length > 0) {
        console.log(`🔍 Looking for SVG for item: "${itemName}"`);
        
        const matchingSVG = findMatchingSVG(itemName, availableSVGs);
        
        if (matchingSVG) {
            console.log(`✅ Found matching SVG for "${itemName}": ${matchingSVG}`);
            iconElement.src = `/svg/${matchingSVG}`;
            iconElement.style.display = 'block';
            
            iconElement.onerror = () => {
                console.warn(`❌ SVG failed to load for ${itemName}:`, matchingSVG);
                // Set a placeholder or hide
                iconElement.style.display = 'none';
            };
            
            iconElement.onload = () => {
                console.log(`✅ SVG loaded successfully for "${itemName}": ${matchingSVG}`);
            };
        } else {
            console.warn(`❌ No matching SVG found for item: "${itemName}"`);
            // Set a placeholder or hide
            iconElement.style.display = 'none';
        }
    } else {
        console.log(`ℹ️ No SVG search possible for slot ${slotNumber} (no name or no SVGs available)`);
        iconElement.style.display = 'none';
    }
};

// Separate function to find matching SVG with improved logic
const findMatchingSVG = (itemName, availableSVGs) => {
    const itemNameLower = itemName.toLowerCase().trim();
    const normalizedItemName = itemNameLower
        .replace(/[()]/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    let matchingSVG = null;

    // Strategy 0: explicit item-to-icon mapping for known item names.
    const explicitMappings = {
        'freeze': 'iceball.svg',
        'ice': 'iceball.svg',
        'fireball': 'fireball.svg',
        'fire': 'fireball.svg',
        'shield': 'shield.svg',
        'double points': 'double-points.svg',
        'time warp': 'time-warp.svg',
        'lightning bolt': 'lightning.svg',
        'lightning': 'lightning.svg',
        'mystery box': 'mystery-box.svg',
        'spotlight': 'spotlight.svg',
        'earthquake': 'earthquake.svg',
        'flood': 'flood.svg'
    };

    for (const [pattern, svgName] of Object.entries(explicitMappings)) {
        if (normalizedItemName === pattern || normalizedItemName.includes(pattern)) {
            matchingSVG = availableSVGs.find(svg => svg.toLowerCase() === svgName.toLowerCase());
            if (matchingSVG) {
                return matchingSVG;
            }
        }
    }
    
    // Strategy 1: Exact match (remove .svg extension from available files)
    matchingSVG = availableSVGs.find(svg => {
        const svgNameWithoutExt = svg.toLowerCase().replace('.svg', '');
        return svgNameWithoutExt === itemNameLower || svgNameWithoutExt === normalizedItemName.replace(/\s+/g, '-');
    });
    
    // Strategy 2: Item name contains SVG name
    if (!matchingSVG) {
        matchingSVG = availableSVGs.find(svg => {
            const svgNameWithoutExt = svg.toLowerCase().replace('.svg', '');
            return svgNameWithoutExt.length > 2 && itemNameLower.includes(svgNameWithoutExt);
        });
    }
    
    // Strategy 3: SVG name contains item name
    if (!matchingSVG) {
        matchingSVG = availableSVGs.find(svg => {
            const svgNameWithoutExt = svg.toLowerCase().replace('.svg', '');
            return itemNameLower.length > 2 && svgNameWithoutExt.includes(itemNameLower);
        });
    }
    
    // Strategy 4: Partial word matching (split by common separators)
    if (!matchingSVG) {
        const itemWords = itemNameLower.split(/[\s_-]+/).filter(word => word.length > 2);
        matchingSVG = availableSVGs.find(svg => {
            const svgNameWithoutExt = svg.toLowerCase().replace('.svg', '');
            const svgWords = svgNameWithoutExt.split(/[\s_-]+/);
            
            // Check if any item word matches any SVG word
            return itemWords.some(itemWord => 
                svgWords.some(svgWord => 
                    itemWord.includes(svgWord) || svgWord.includes(itemWord)
                )
            );
        });
    }
    
    // Strategy 5: Common item type mappings
    if (!matchingSVG) {
        const itemTypeMappings = {
            'fireball': ['fireball', 'flame', 'fire'],
            'freeze': ['iceball', 'freeze', 'frost', 'ice'],
            'water': ['waterball', 'splash'],
            'earth': ['earthball', 'rock'],
            'lightning': ['lightning', 'lightningball', 'thunder'],
            'double points': ['double-points', 'double points'],
            'time warp': ['time-warp', 'time warp'],
            'mystery box': ['mystery-box', 'mystery box'],
            'spotlight': ['spotlight'],
            'shield': ['shield', 'defense'],
            'flood': ['flood'],
            'heal': ['healpotion', 'health'],
            'mana': ['manapotion', 'magic'],
            'sword': ['sword', 'blade'],
            'bow': ['bow', 'arrow'],
            'staff': ['staff', 'wand']
        };
        
        for (const [type, variations] of Object.entries(itemTypeMappings)) {
            if (normalizedItemName.includes(type)) {
                matchingSVG = availableSVGs.find(svg => {
                    const svgNameLower = svg.toLowerCase();
                    return variations.some(variation => svgNameLower.includes(variation));
                });
                if (matchingSVG) break;
            }
        }
    }
    
    return matchingSVG;
};

// Function to setup click event listener for an item slot
// Single-click: use/activate the item
// Double-click (two taps/clicks within SHORT_CLICK_MS): discard without activating
const setupItemClickHandler = (slotElement, item) => {
    console.log("🖱️ Setting up click handler for item:", item.name);

    // Remove any existing event listeners by cloning the element
    const newSlotElement = slotElement.cloneNode(true);
    slotElement.parentNode.replaceChild(newSlotElement, slotElement);

    const SHORT_CLICK_MS = 350; // threshold to detect double-click / double-tap
    let clickTimer = null;
    let clickCount = 0;

    const itemId = item.itemId || item.id;
    const itemName = item.name || 'Unknown Item';

    const doUse = () => {
        console.log(`🎯 Single-click detected for ${itemName} (${itemId}) - using item`);
        // small press animation
        newSlotElement.style.transform = 'scale(0.95)';
        setTimeout(() => { newSlotElement.style.transform = 'scale(1)'; }, 100);
        useItem(itemId, itemName, false);
    };

    const doDiscard = () => {
        console.log(`🗑️ Double-click detected for ${itemName} (${itemId}) - discarding item without activating`);
        // discard animation
        newSlotElement.style.transform = 'scale(0.9)';
        setTimeout(() => { newSlotElement.style.transform = 'scale(1)'; }, 120);
        useItem(itemId, itemName, true);
    };

    // Click handler implementing single vs double click semantics
    newSlotElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        clickCount++;
        if (clickCount === 1) {
            // Start timer - if no second click arrives, treat as single click
            clickTimer = setTimeout(() => {
                clickCount = 0;
                clickTimer = null;
                doUse();
            }, SHORT_CLICK_MS);
        } else if (clickCount === 2) {
            // Double click detected within threshold
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            clickCount = 0;
            doDiscard();
        }
    });

    // Touch support - interpret taps similarly to clicks
    let lastTouchTime = 0;
    newSlotElement.addEventListener('touchend', (e) => {
        e.preventDefault();
        const now = Date.now();
        if (now - lastTouchTime < SHORT_CLICK_MS) {
            // double-tap
            if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
            clickCount = 0;
            doDiscard();
        } else {
            // start timer for potential double-tap
            clickCount = 1;
            if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
            clickTimer = setTimeout(() => { clickCount = 0; clickTimer = null; doUse(); }, SHORT_CLICK_MS);
        }
        lastTouchTime = now;
    });
};

// Function to use an item. If `discard` is true, the item will be removed from
// inventory without executing its effect.
const useItem = async (itemId, itemName, discard = false) => {
    if (!currentUser || !currentUser.id) {
        console.log("❌ No user authenticated for item use");
        return;
    }
    
    console.log(`🎮 ${discard ? 'Discarding' : 'Using'} item: ${itemName} (${itemId})`);
    
    try {
        const url = `/api/player/${currentUser.id}/items/${itemId}/use` + (discard ? '?discard=true' : '');
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            if (discard) {
                console.log(`✅ Successfully discarded item: ${itemName}`);
                showItemFeedback(`Discarded ${itemName}`, 'info');
            } else {
                console.log(`✅ Successfully used item: ${itemName}`);
                showItemFeedback(`Used ${itemName}!`, 'success');
            }
            
            // Reload items to update display
            setTimeout(() => loadPlayerItems(), 100);
        } else {
            console.error("❌ Failed to use item:", data.error);
            showItemFeedback(`Failed: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error("💥 Error using item:", error);
        showItemFeedback(`Error: ${error.message}`, 'error');
    }
};

// Function to clear all item slots
const clearAllItemSlots = () => {
    console.log("🧹 Clearing all item slots");
    for (let i = 1; i <= 3; i++) {
        const slotElement = document.getElementById(`item${i}`);
        if (slotElement) {
            clearItemSlot(slotElement);
        } else {
            console.warn(`⚠️ Slot element #item${i} not found when clearing`);
        }
    }
};


// Function to show feedback messages
const showItemFeedback = (message, type = 'info') => {
    console.log(`💬 Showing feedback: ${message} (${type})`);
    
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = `item-feedback-toast ${type}`;
    toast.textContent = message;
    
    // Style the toast for mobile-friendly display
    toast.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 16px;
        border-radius: 4px;
        color: white;
        font-weight: bold;
        font-size: 14px;
        z-index: 10000;
        transition: opacity 0.3s ease;
        max-width: 280px;
        text-align: center;
        word-wrap: break-word;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    
    // Set background color based on type
    if (type === 'success') {
    toast.style.backgroundColor = '#2e7d32';
    } else if (type === 'error') {
        toast.style.backgroundColor = '#f44336';
    } else {
        toast.style.backgroundColor = '#2196F3';
    }
    
    document.body.appendChild(toast);
    
    // Remove after 2 seconds (shorter for better UX)
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 2000);
};

// Function to manually refresh items (you can call this from anywhere)
const refreshPlayerItems = () => {
    console.log("🔄 Manual refresh requested");
    loadPlayerItems();
};

// Initialize items when page loads (in case user is already authenticated)
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 DOM Content Loaded - Initializing items system");
    
    // Initialize SVG cache first
    scanFolderForSVGs().then(svgs => {
        availableSVGs = svgs;
        console.log('✅ SVG cache initialized with', svgs.length, 'files');
        
        // Small delay to ensure other scripts have loaded
        setTimeout(() => {
            console.log("⏰ Checking for existing authenticated user");
            if (currentUser && currentUser.id) {
                console.log("👤 Found existing user, loading items");
                loadPlayerItems();
                startItemAutoRefresh();
            } else {
                console.log("👤 No existing user found, waiting for authentication");
            }
        }, 500);
    }).catch(error => {
        console.warn('⚠️ Could not initialize SVG cache:', error);
        availableSVGs = [];
        
        // Still proceed with item loading even if SVG scanning fails
        setTimeout(() => {
            console.log("⏰ Checking for existing authenticated user (no SVG cache)");
            if (currentUser && currentUser.id) {
                console.log("👤 Found existing user, loading items");
                loadPlayerItems();
                startItemAutoRefresh();
            } else {
                console.log("👤 No existing user found, waiting for authentication");
            }
        }, 500);
    });
});

// Clean up interval when page is unloaded
window.addEventListener('beforeunload', () => {
    console.log("👋 Page unloading, cleaning up");
    stopItemAutoRefresh();
});

// Expose functions globally for debugging
window.itemsDebug = {
    currentUser,
    availableSVGs,
    loadPlayerItems,
    refreshPlayerItems,
    clearAllItemSlots,
    isLoadingItems: () => isLoadingItems
};