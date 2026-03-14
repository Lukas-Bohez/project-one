// Admin shutdown functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeShutdownButton();
});

function initializeShutdownButton() {
    const userId = sessionStorage.getItem('admin_user_id');

    // Only require a valid admin user id client-side; do not rely on client-side RFID.
    if (userId) {
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
    // Use the custom confirm dialog from admin.js
    if (typeof showConfirmDialog === 'function') {
        showConfirmDialog('Are you sure you want to shutdown the Raspberry Pi?', async () => {
            await performShutdown();
        });
    } else {
        // Fallback: create a simple inline confirm modal
        const overlay = document.createElement('div');
        overlay.className = 'c-modal-overlay c-modal-overlay--active';
        overlay.innerHTML = `
          <div class="c-modal c-modal--sm">
            <div class="c-modal__header"><h2 class="c-modal__title">Confirm Shutdown</h2></div>
            <div class="c-modal__body"><p>Are you sure you want to shutdown the Raspberry Pi?</p></div>
            <div class="c-modal__footer">
              <button class="c-btn c-btn--sm c-btn--secondary js-cancel">Cancel</button>
              <button class="c-btn c-btn--sm c-btn--danger js-confirm">Shutdown</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.js-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });
        overlay.querySelector('.js-confirm').addEventListener('click', async () => {
            overlay.remove();
            await performShutdown();
        });
    }
}

async function performShutdown() {
    const userId = sessionStorage.getItem('admin_user_id');
    
    if (!userId) {
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
                'X-User-ID': userId
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