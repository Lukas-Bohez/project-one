// Test script to debug UI issues
console.log('=== UI DEBUG SCRIPT LOADED ===');

// Check if classes are available
setTimeout(() => {
    console.log('Available classes:');
    console.log('- GameEngine:', typeof window.GameEngine !== 'undefined');
    console.log('- SaveManager:', typeof window.SaveManager !== 'undefined');
    console.log('- UIManager:', typeof window.UIManager !== 'undefined');
    console.log('- ResourceManager:', typeof window.ResourceManager !== 'undefined');
    
    // Check if key DOM elements exist
    console.log('\nDOM Elements:');
    console.log('- login-toggle-btn:', !!document.getElementById('login-toggle-btn'));
    console.log('- auth-modal:', !!document.getElementById('auth-modal'));
    console.log('- save-btn:', !!document.getElementById('save-btn'));
    console.log('- load-btn:', !!document.getElementById('load-btn'));
    
    // Check if app is initialized
    console.log('\nApp State:');
    console.log('- window.app:', typeof window.app !== 'undefined');
    
    if (window.app && window.app.gameEngine) {
        console.log('- GameEngine:', !!window.app.gameEngine);
        console.log('- SaveManager:', !!window.app.gameEngine.saveManager);
        console.log('- UIManager:', !!window.app.gameEngine.uiManager);
    }
}, 2000);

// Add click listener directly to test
setTimeout(() => {
    const loginBtn = document.getElementById('login-toggle-btn');
    if (loginBtn) {
        console.log('Adding direct click listener to login button...');
        loginBtn.addEventListener('click', function(e) {
            console.log('DIRECT LOGIN BUTTON CLICKED!', e);
        });
    } else {
        console.error('Login button not found for direct listener!');
    }
}, 1000);