// Admin shutdown functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeShutdownButton();
});

function initializeShutdownButton() {
    const userId = sessionStorage.getItem('admin_user_id');
    const rfidCode = sessionStorage.getItem('admin_rfid_code');
    
    if (userId && rfidCode) {
        addShutdownButton();
    }
}

function addShutdownButton() {
    const headerActions = document.querySelector('.c-header__actions');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (headerActions && logoutBtn) {
        // Create shutdown button if it doesn't exist
        if (!document.getElementById('shutdownBtn')) {
            const shutdownBtn = document.createElement('button');
            shutdownBtn.id = 'shutdownBtn';
            shutdownBtn.className = 'c-btn c-btn--logout';
            shutdownBtn.innerHTML = '<i class="fas fa-power-off"></i> Shutdown';
            shutdownBtn.style.marginRight = '10px';
            shutdownBtn.addEventListener('click', handleShutdown);
            headerActions.insertBefore(shutdownBtn, logoutBtn);
        }
    }
}

async function handleShutdown() {
    // Use the custom confirm dialog from admin.js instead of browser confirm
    if (typeof showConfirmDialog === 'function') {
        showConfirmDialog('Are you sure you want to shutdown the Raspberry Pi?', async () => {
            await performShutdown();
        });
    } else {
        // Fallback if function not available
        if (confirm('Are you sure you want to shutdown the Raspberry Pi?')) {
            await performShutdown();
        }
    }
}

async function performShutdown() {
    const userId = sessionStorage.getItem('admin_user_id');
    const rfidCode = sessionStorage.getItem('admin_rfid_code');
    
    if (!userId || !rfidCode) {
        if (typeof showNotification === 'function') {
            showNotification('Authentication required', 'error');
        } else {
            alert('Authentication required');
        }
        return;
    }

    try {
        const shutdownBtn = document.getElementById('shutdownBtn');
        shutdownBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Shutting down...';
        shutdownBtn.disabled = true;
        
        const response = await fetch(`${lanIP}/api/shutdown`, {
            method: 'POST',
            headers: {
                'X-User-ID': userId,
                'X-RFID': rfidCode
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Shutdown failed');
        }

        const result = await response.json();
        if (typeof showNotification === 'function') {
            showNotification(result.message || 'Shutdown initiated', 'success');
        } else {
            alert(result.message || 'Shutdown initiated');
        }
    } catch (error) {
        console.error('Shutdown error:', error);
        if (typeof showNotification === 'function') {
            showNotification(error.message || 'Failed to send shutdown command', 'error');
        } else {
            alert(error.message || 'Failed to send shutdown command');
        }
    } finally {
        const shutdownBtn = document.getElementById('shutdownBtn');
        if (shutdownBtn) {
            shutdownBtn.innerHTML = '<i class="fas fa-power-off"></i> Shutdown';
            shutdownBtn.disabled = false;
        }
    }
}