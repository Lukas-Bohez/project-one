// Global variable to store current user
let currentUser = null;

// Listen for user authentication
document.addEventListener('userAuthenticated', (event) => {
    console.log("User authenticated event received");
    const user = event.detail.user;
    console.log("User data:", user);
    currentUser = user;
    
    // Load player items when user is authenticated
    loadPlayerItems();
});

// Function to load and display player items
async function loadPlayerItems() {
    if (!currentUser || !currentUser.id) {
        console.log("No user authenticated");
        clearAllItemSlots();
        return;
    }

    try {
        const response = await fetch(`/api/player/${currentUser.id}/items`);
        const data = await response.json();
        
        if (data.success) {
            displayPlayerItems(data.items);
        } else {
            console.error("Failed to load items:", data.error);
            clearAllItemSlots();
        }
    } catch (error) {
        console.error("Error loading player items:", error);
        clearAllItemSlots();
    }
}

// Function to display items in the 3 slots
function displayPlayerItems(items) {
    // Clear all slots first
    clearAllItemSlots();
    
    // Display up to 3 items
    const maxSlots = 3;
    const itemsToShow = items.slice(0, maxSlots);
    
    itemsToShow.forEach((item, index) => {
        const slotNumber = index + 1;
        const slotElement = document.getElementById(`item${slotNumber}`);
        
        if (slotElement) {
            populateItemSlot(slotElement, item, slotNumber);
        }
    });
}

// Function to populate an individual item slot
function populateItemSlot(slotElement, item, slotNumber) {
    // Add item data attributes
    slotElement.setAttribute('data-item-id', item.itemId || item.id);
    slotElement.setAttribute('data-item-name', item.name);
    slotElement.setAttribute('data-quantity', item.quantity);
    
    // Add visual indicator that slot has an item
    slotElement.classList.add('has-item');
    
    // Set rarity class for styling
    if (item.rarity) {
        slotElement.setAttribute('data-rarity', item.rarity);
        slotElement.classList.add(`rarity-${item.rarity}`);
    }
    
    // Update the description
    const descriptionElement = slotElement.querySelector('.c-item-description');
    if (descriptionElement) {
        let description = item.description || 'No description available';
        
        // Add quantity info if more than 1
        if (item.quantity > 1) {
            description += ` (x${item.quantity})`;
        }
        
        descriptionElement.textContent = description;
    }
    
    // Add item name/title if there's space (you might want to add this to your HTML)
    const itemTitle = slotElement.querySelector('.c-item-title');
    if (itemTitle) {
        itemTitle.textContent = item.name;
    } else {
        // Create title element if it doesn't exist
        const titleElement = document.createElement('div');
        titleElement.className = 'c-item-title';
        titleElement.textContent = item.name;
        slotElement.insertBefore(titleElement, slotElement.firstChild);
    }
    
    // Add logo/image if available
    if (item.logoUrl) {
        let imgElement = slotElement.querySelector('.c-item-image');
        if (!imgElement) {
            imgElement = document.createElement('img');
            imgElement.className = 'c-item-image';
            slotElement.insertBefore(imgElement, slotElement.firstChild);
        }
        imgElement.src = item.logoUrl;
        imgElement.alt = item.name;
    }
    
    // Setup button event listeners
    setupItemButtons(slotElement, item);
}

// Function to setup button event listeners for an item slot
function setupItemButtons(slotElement, item) {
    const useBtn = slotElement.querySelector('.c-item-use-btn');
    const deleteBtn = slotElement.querySelector('.c-item-delete-btn');
    
    // Remove existing listeners
    const newUseBtn = useBtn.cloneNode(true);
    const newDeleteBtn = deleteBtn.cloneNode(true);
    useBtn.parentNode.replaceChild(newUseBtn, useBtn);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    
    // Add new listeners
    newUseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        useItem(item.itemId || item.id, item.name);
    });
    
    newDeleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteItem(item.itemId || item.id, item.name);
    });
}

// Function to use an item
async function useItem(itemId, itemName) {
    if (!currentUser || !currentUser.id) {
        console.log("No user authenticated");
        return;
    }
    
    try {
        const response = await fetch(`/api/player/${currentUser.id}/items/${itemId}/use`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`Successfully used item: ${itemName}`);
            
            // Show success feedback (you can customize this)
            showItemFeedback(`Used ${itemName}!`, 'success');
            
            // Reload items to update display
            loadPlayerItems();
        } else {
            console.error("Failed to use item:", data.error);
            showItemFeedback(`Failed to use ${itemName}`, 'error');
        }
    } catch (error) {
        console.error("Error using item:", error);
        showItemFeedback(`Error using ${itemName}`, 'error');
    }
}

// Function to delete an item
async function deleteItem(itemId, itemName) {
    if (!currentUser || !currentUser.id) {
        console.log("No user authenticated");
        return;
    }
    
    // Ask for confirmation
    if (!confirm(`Are you sure you want to delete ${itemName}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/player/${currentUser.id}/items/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`Successfully deleted item: ${itemName}`);
            
            // Show success feedback
            showItemFeedback(`Deleted ${itemName}`, 'success');
            
            // Reload items to update display
            loadPlayerItems();
        } else {
            console.error("Failed to delete item:", data.error);
            showItemFeedback(`Failed to delete ${itemName}`, 'error');
        }
    } catch (error) {
        console.error("Error deleting item:", error);
        showItemFeedback(`Error deleting ${itemName}`, 'error');
    }
}

// Function to clear all item slots
function clearAllItemSlots() {
    for (let i = 1; i <= 3; i++) {
        const slotElement = document.getElementById(`item${i}`);
        if (slotElement) {
            clearItemSlot(slotElement);
        }
    }
}

// Function to clear an individual item slot
function clearItemSlot(slotElement) {
    // Remove data attributes
    slotElement.removeAttribute('data-item-id');
    slotElement.removeAttribute('data-item-name');
    slotElement.removeAttribute('data-quantity');
    slotElement.removeAttribute('data-rarity');
    
    // Remove classes
    slotElement.classList.remove('has-item');
    slotElement.className = slotElement.className.replace(/rarity-\w+/g, '');
    
    // Clear description
    const descriptionElement = slotElement.querySelector('.c-item-description');
    if (descriptionElement) {
        descriptionElement.textContent = 'Empty slot';
    }
    
    // Remove title if it exists
    const titleElement = slotElement.querySelector('.c-item-title');
    if (titleElement) {
        titleElement.remove();
    }
    
    // Remove image if it exists
    const imgElement = slotElement.querySelector('.c-item-image');
    if (imgElement) {
        imgElement.remove();
    }
    
    // Reset button listeners to do nothing
    const useBtn = slotElement.querySelector('.c-item-use-btn');
    const deleteBtn = slotElement.querySelector('.c-item-delete-btn');
    
    if (useBtn) {
        const newUseBtn = useBtn.cloneNode(true);
        useBtn.parentNode.replaceChild(newUseBtn, useBtn);
    }
    
    if (deleteBtn) {
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    }
}

// Function to show feedback messages (you can customize this)
function showItemFeedback(message, type = 'info') {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = `item-feedback-toast ${type}`;
    toast.textContent = message;
    
    // Style the toast (you can move this to CSS)
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
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Function to manually refresh items (you can call this from anywhere)
function refreshPlayerItems() {
    loadPlayerItems();
}

// Initialize items when page loads (in case user is already authenticated)
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure other scripts have loaded
    setTimeout(() => {
        if (currentUser) {
            loadPlayerItems();
        }
    }, 500);
});