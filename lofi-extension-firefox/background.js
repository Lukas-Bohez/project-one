// Background script - Opens player window (Firefox compatible)

let playerWindowId = null;

// Use browser API (Firefox standard) with chrome fallback
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Handle extension icon click
browserAPI.browserAction.onClicked.addListener(async () => {
    // Check if player window already exists
    if (playerWindowId) {
        try {
            const window = await browserAPI.windows.get(playerWindowId);
            // Window exists, focus it
            browserAPI.windows.update(playerWindowId, { focused: true });
            return;
        } catch (e) {
            // Window was closed, create new one
            playerWindowId = null;
        }
    }
    
    // Load saved window size or use defaults
    const savedState = await browserAPI.storage.local.get(['windowWidth', 'windowHeight']);
    const width = savedState.windowWidth || 400;
    const height = savedState.windowHeight || 650;
    
    // Create new player window with size constraints
    const window = await browserAPI.windows.create({
        url: 'player.html',
        type: 'popup',
        width: Math.max(350, Math.min(width, 800)),
        height: Math.max(500, Math.min(height, 1000)),
        focused: true,
    });
    
    playerWindowId = window.id;
    
    // Save window size when it changes
    const boundsListener = (changedWindow) => {
        if (changedWindow.id === playerWindowId) {
            browserAPI.storage.local.set({
                windowWidth: changedWindow.width,
                windowHeight: changedWindow.height
            });
        }
    };
    
    browserAPI.windows.onBoundsChanged.addListener(boundsListener);
});

// Clean up when window is closed
browserAPI.windows.onRemoved.addListener((windowId) => {
    if (windowId === playerWindowId) {
        playerWindowId = null;
    }
});

console.log('Lofi Player background script initialized (Firefox)');
