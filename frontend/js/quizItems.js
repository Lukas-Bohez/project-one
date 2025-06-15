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
    
    // Start auto-refresh interval (every second)
    startItemAutoRefresh();
});

// Function to start auto-refresh of items
function startItemAutoRefresh() {
    // Clear any existing interval
    if (itemUpdateInterval) {
        clearInterval(itemUpdateInterval);
    }
    
    console.log("⏰ Starting item auto-refresh (1 second interval)");
    
    // Set up new interval to refresh every second
    itemUpdateInterval = setInterval(() => {
        if (currentUser && currentUser.id && !isLoadingItems) {
            loadPlayerItems();
        }
    }, 1000);
}

// Function to stop auto-refresh
function stopItemAutoRefresh() {
    if (itemUpdateInterval) {
        clearInterval(itemUpdateInterval);
        itemUpdateInterval = null;
        console.log("⏹️ Stopped item auto-refresh");
    }
}

// Function to load and display player items
async function loadPlayerItems() {
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
}

// Function to display items in the 3 slots
function displayPlayerItems(items) {
    console.log("🎮 Displaying items:", items);
    
    // Validate input
    if (!Array.isArray(items)) {
        console.error("❌ displayPlayerItems called with invalid items:", items);
        clearAllItemSlots();
        return;
    }
    
    // Display up to 3 items, checking for changes to prevent flashing
    const maxSlots = 3;
    const itemsToShow = items.slice(0, maxSlots);
    
    console.log(`📋 Items to show (${itemsToShow.length}/${items.length}):`, itemsToShow);
    
    // Process each slot
    for (let slotIndex = 0; slotIndex < maxSlots; slotIndex++) {
        const slotNumber = slotIndex + 1;
        const slotElement = document.getElementById(`item${slotNumber}`);
        const newItem = itemsToShow[slotIndex];
        
        if (!slotElement) {
            console.error(`❌ Slot element #item${slotNumber} not found in DOM`);
            continue;
        }
        
        // Get current slot data
        const currentItemId = slotElement.getAttribute('data-item-id');
        const currentQuantity = slotElement.getAttribute('data-quantity');
        
        // Determine new slot data
        const newItemId = newItem ? (newItem.itemId || newItem.id) : null;
        const newQuantity = newItem ? (newItem.quantity || 1).toString() : null;
        
        // Check if slot needs updating
        const needsUpdate = currentItemId !== (newItemId || '') || 
                           currentQuantity !== (newQuantity || '');
        
        if (needsUpdate) {
            console.log(`🔄 Slot ${slotNumber} needs update:`, {
                from: { id: currentItemId, qty: currentQuantity },
                to: { id: newItemId, qty: newQuantity }
            });
            
            if (newItem && newItemId) {
                // Populate with new item
                try {
                    populateItemSlot(slotElement, newItem, slotNumber);
                    console.log(`✅ Updated slot ${slotNumber} with item`);
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
}

// Function to populate an individual item slot
function populateItemSlot(slotElement, item, slotNumber) {
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
    const itemQuantity = item.quantity || 1;
    
    console.log(`📝 Setting up slot ${slotNumber} with:`, {
        id: itemId,
        name: itemName,
        quantity: itemQuantity,
        rarity: item.rarity
    });
    
    try {
        // Clear all existing content first
        slotElement.innerHTML = '';
        
        // Add item data attributes
        slotElement.setAttribute('data-item-id', itemId);
        slotElement.setAttribute('data-item-name', itemName);
        slotElement.setAttribute('data-quantity', itemQuantity);
        
        // Add visual indicator that slot has an item
        slotElement.classList.add('has-item');
        
        // Set rarity class for styling
        if (item.rarity) {
            slotElement.setAttribute('data-rarity', item.rarity);
            slotElement.classList.add(`rarity-${item.rarity}`);
        }
        
        // Only add the icon - no text elements
        setupItemIcon(slotElement, item, slotNumber);
        
        // Setup button event listeners (hidden buttons for functionality)
        setupItemButtons(slotElement, item);
        
        console.log(`✅ Successfully populated slot ${slotNumber} with icon only`);
        
    } catch (error) {
        console.error(`💥 Error in populateItemSlot for slot ${slotNumber}:`, error);
        throw error; // Re-throw to be caught by caller
    }
}

// Separate function to handle icon setup
function setupItemIcon(slotElement, item, slotNumber) {
    const itemName = item.name || 'Unknown Item';
    
    // Create icon element (since we cleared innerHTML)
    const iconElement = document.createElement('img');
    iconElement.className = 'c-item-icon';
    iconElement.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        margin: 0;
        padding: 0;
    `;
    
    // Set default state
    iconElement.alt = itemName;
    iconElement.title = itemName; // Tooltip for item name
    
    // Use logoUrl if available
    if (item.logoUrl) {
        console.log(`🖼️ Using logoUrl for slot ${slotNumber}:`, item.logoUrl);
        iconElement.src = item.logoUrl;
        
        iconElement.onerror = () => {
            console.warn(`❌ logoUrl failed to load for ${itemName}:`, item.logoUrl);
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
    
    // Add icon to slot
    slotElement.appendChild(iconElement);
}

// Helper function to try setting SVG icon
function trySetSVGIcon(iconElement, itemName, slotNumber) {
    if (itemName && availableSVGs.length > 0) {
        console.log(`🔍 Looking for SVG for item: "${itemName}"`);
        
        const matchingSVG = findMatchingSVG(itemName, availableSVGs);
        
        if (matchingSVG) {
            console.log(`✅ Found matching SVG for "${itemName}": ${matchingSVG}`);
            iconElement.src = `/svg/${matchingSVG}`;
            
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
}

// Separate function to find matching SVG with improved logic
function findMatchingSVG(itemName, availableSVGs) {
    const itemNameLower = itemName.toLowerCase().trim();
    let matchingSVG = null;
    
    // Strategy 1: Exact match (remove .svg extension from available files)
    matchingSVG = availableSVGs.find(svg => {
        const svgNameWithoutExt = svg.toLowerCase().replace('.svg', '');
        return svgNameWithoutExt === itemNameLower;
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
            'fire': ['fireball', 'flame'],
            'ice': ['iceball', 'freeze', 'frost'],
            'water': ['waterball', 'splash'],
            'earth': ['earthball', 'rock'],
            'lightning': ['lightningball', 'thunder'],
            'heal': ['healpotion', 'health'],
            'mana': ['manapotion', 'magic'],
            'sword': ['sword', 'blade'],
            'shield': ['shield', 'defense'],
            'bow': ['bow', 'arrow'],
            'staff': ['staff', 'wand']
        };
        
        for (const [type, variations] of Object.entries(itemTypeMappings)) {
            if (itemNameLower.includes(type)) {
                matchingSVG = availableSVGs.find(svg => {
                    const svgNameLower = svg.toLowerCase();
                    return variations.some(variation => svgNameLower.includes(variation));
                });
                if (matchingSVG) break;
            }
        }
    }
    
    return matchingSVG;
}

// Function to setup button event listeners for an item slot
function setupItemButtons(slotElement, item) {
    console.log("🔘 Setting up buttons for item:", item.name);
    
    // Look for existing buttons in the slot
    const useBtn = slotElement.querySelector('.c-item-use-btn');
    const deleteBtn = slotElement.querySelector('.c-item-delete-btn');
    
    // If buttons don't exist, create invisible click handlers on the slot itself
    if (!useBtn && !deleteBtn) {
        // Make the entire slot clickable for use (left click)
        slotElement.style.cursor = 'pointer';
        
        const clickHandler = (e) => {
            e.stopPropagation();
            const itemId = item.itemId || item.id;
            const itemName = item.name || 'Unknown Item';
            
            if (e.button === 0) { // Left click - use item
                console.log(`🎯 Left click to use item: ${itemName} (${itemId})`);
                useItem(itemId, itemName);
            } else if (e.button === 2) { // Right click - delete item
                console.log(`🗑️ Right click to delete item: ${itemName} (${itemId})`);
                deleteItem(itemId, itemName);
            }
        };
        
        // Add both click and contextmenu handlers
        slotElement.addEventListener('click', clickHandler);
        slotElement.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent context menu
            e.button = 2; // Set as right click
            clickHandler(e);
        });
        
        return;
    }
    
    // Handle existing buttons
    if (useBtn) {
        const newUseBtn = useBtn.cloneNode(true);
        useBtn.parentNode.replaceChild(newUseBtn, useBtn);
        
        newUseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = item.itemId || item.id;
            const itemName = item.name || 'Unknown Item';
            console.log(`🎯 Use button clicked for item: ${itemName} (${itemId})`);
            useItem(itemId, itemName);
        });
    }
    
    if (deleteBtn) {
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        
        newDeleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = item.itemId || item.id;
            const itemName = item.name || 'Unknown Item';
            console.log(`🗑️ Delete button clicked for item: ${itemName} (${itemId})`);
            deleteItem(itemId, itemName);
        });
    }
}

// Function to use an item
async function useItem(itemId, itemName) {
    if (!currentUser || !currentUser.id) {
        console.log("❌ No user authenticated for item use");
        return;
    }
    
    console.log(`🎮 Using item: ${itemName} (${itemId})`);
    
    try {
        const response = await fetch(`/api/player/${currentUser.id}/items/${itemId}/use`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`✅ Successfully used item: ${itemName}`);
            showItemFeedback(`Used ${itemName}!`, 'success');
            
            // Reload items to update display
            setTimeout(() => loadPlayerItems(), 100);
        } else {
            console.error("❌ Failed to use item:", data.error);
            showItemFeedback(`Failed to use ${itemName}: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error("💥 Error using item:", error);
        showItemFeedback(`Error using ${itemName}: ${error.message}`, 'error');
    }
}

// Function to delete an item
async function deleteItem(itemId, itemName) {
    if (!currentUser || !currentUser.id) {
        console.log("❌ No user authenticated for item deletion");
        return;
    }
    
    // Ask for confirmation
    if (!confirm(`Are you sure you want to delete ${itemName}?`)) {
        console.log("🚫 Item deletion cancelled by user");
        return;
    }
    
    console.log(`🗑️ Deleting item: ${itemName} (${itemId})`);
    
    try {
        const response = await fetch(`/api/player/${currentUser.id}/items/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`✅ Successfully deleted item: ${itemName}`);
            showItemFeedback(`Deleted ${itemName}`, 'success');
            
            // Reload items to update display
            setTimeout(() => loadPlayerItems(), 100);
        } else {
            console.error("❌ Failed to delete item:", data.error);
            showItemFeedback(`Failed to delete ${itemName}: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error("💥 Error deleting item:", error);
        showItemFeedback(`Error deleting ${itemName}: ${error.message}`, 'error');
    }
}

// Function to clear all item slots
function clearAllItemSlots() {
    console.log("🧹 Clearing all item slots");
    for (let i = 1; i <= 3; i++) {
        const slotElement = document.getElementById(`item${i}`);
        if (slotElement) {
            clearItemSlot(slotElement);
        } else {
            console.warn(`⚠️ Slot element #item${i} not found when clearing`);
        }
    }
}

// Function to clear an individual item slot
function clearItemSlot(slotElement) {
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
    
    // Clear all content
    slotElement.innerHTML = '';
    
    // Reset cursor
    slotElement.style.cursor = 'default';
    
    // Remove all event listeners by cloning the element
    const newSlotElement = slotElement.cloneNode(false);
    slotElement.parentNode.replaceChild(newSlotElement, slotElement);
}

// Function to show feedback messages
function showItemFeedback(message, type = 'info') {
    console.log(`💬 Showing feedback: ${message} (${type})`);
    
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = `item-feedback-toast ${type}`;
    toast.textContent = message;
    
    // Style the toast
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        transition: opacity 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Set background color based on type
    if (type === 'success') {
        toast.style.backgroundColor = '#4CAF50';
    } else if (type === 'error') {
        toast.style.backgroundColor = '#f44336';
    } else {
        toast.style.backgroundColor = '#2196F3';
    }
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Function to manually refresh items (you can call this from anywhere)
function refreshPlayerItems() {
    console.log("🔄 Manual refresh requested");
    loadPlayerItems();
}

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