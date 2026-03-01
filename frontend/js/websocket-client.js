/**
 * WebSocket Client for Manage the Spire
 * Handles real-time updates from the server
 */

class ManageWebSocketClient {
    constructor() {
        this.ws = null;
        this.businessId = null;
        this.userId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000; // 3 seconds
        this.messageHandlers = {};
    }

    /**
     * Initialize WebSocket connection
     */
    connect(businessId, userId) {
        this.businessId = businessId;
        this.userId = userId;

        if (!businessId || !userId) {
            console.error('WebSocket: businessId and userId are required');
            return;
        }

        // Determine WebSocket protocol based on current page protocol
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/v1/manage/ws/${businessId}/${userId}`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected to business:', businessId);
                this.reconnectAttempts = 0;
                
                // Send initial ping/subscription
                this.send({
                    type: 'subscribe',
                    business_id: businessId,
                    user_id: userId
                });
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.attemptReconnect();
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.attemptReconnect();
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            const { type, data: payload } = message;

            console.log(`WebSocket received: ${type}`, payload);

            // Call registered handler for this message type
            if (this.messageHandlers[type]) {
                this.messageHandlers[type](payload);
            }

            // Also call the general onMessage handler if defined
            if (window.onWebSocketMessage) {
                window.onWebSocketMessage(type, payload);
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    }

    /**
     * Send message to server
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket is not connected');
        }
    }

    /**
     * Register handler for specific message type
     */
    on(type, handler) {
        this.messageHandlers[type] = handler;
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`Attempting to reconnect in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                if (!this.isConnected()) {
                    this.connect(this.businessId, this.userId);
                }
            }, delay);
        } else {
            console.error('Failed to reconnect after maximum attempts');
        }
    }

    /**
     * Disconnect WebSocket
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}

// Global WebSocket client instance
const wsClient = new ManageWebSocketClient();

/**
 * Setup default WebSocket handlers for UI updates
 */
function setupWebSocketHandlers() {
    // When a new shift is created
    wsClient.on('shift_created', (shift) => {
        console.log('New shift created:', shift);
        
        // Refresh shifts list if in schedule view
        if (typeof loadShifts === 'function') {
            loadShifts();
        }
        
        // Show notification
        showNotification(`New shift created for ${shift.employee_name} on ${shift.shift_date}`, 'success');
    });

    // When a shift is updated
    wsClient.on('shift_updated', (shift) => {
        console.log('Shift updated:', shift);
        
        // Refresh shifts list
        if (typeof loadShifts === 'function') {
            loadShifts();
        }
        
        showNotification(`Shift updated for ${shift.employee_name}`, 'info');
    });

    // When a shift is deleted
    wsClient.on('shift_deleted', (data) => {
        console.log('Shift deleted:', data);
        
        // Refresh shifts list
        if (typeof loadShifts === 'function') {
            loadShifts();
        }
        
        showNotification(`Shift deleted for ${data.employee_name}`, 'warning');
    });

    // When time-off is requested
    wsClient.on('time_off_requested', (request) => {
        console.log('Time-off requested:', request);
        
        // Refresh time-off list
        if (typeof loadTimeOffRequests === 'function') {
            loadTimeOffRequests();
        }
        
        showNotification(`${request.employee_name} requested time off`, 'info');
    });

    // When time-off is reviewed
    wsClient.on('time_off_reviewed', (data) => {
        console.log('Time-off reviewed:', data);
        
        // Refresh time-off list
        if (typeof loadTimeOffRequests === 'function') {
            loadTimeOffRequests();
        }
        
        const action = data.approved ? 'approved' : 'denied';
        showNotification(`Time-off request ${action}`, 'success');
    });

    // When an employee joins
    wsClient.on('employee_joined', (employee) => {
        console.log('New employee joined:', employee);
        
        // Refresh employee list
        if (typeof loadEmployees === 'function') {
            loadEmployees();
        }
        
        showNotification(`${employee.first_name} ${employee.last_name} joined the business`, 'success');
    });
}

/**
 * Initialize WebSocket connection on page load
 * Should be called after the token is available
 */
function initializeWebSocket() {
    const token = localStorage.getItem('manage_token');
    const businessData = localStorage.getItem('manage_business');
    
    if (!token || !businessData) {
        console.warn('WebSocket: Missing token or business data');
        return;
    }

    try {
        const business = JSON.parse(businessData);
        const businessId = business.id;
        
        // Extract user ID from token (JWT payload)
        const parts = token.split('.');
        if (parts.length !== 3) {
            console.error('Invalid JWT token format');
            return;
        }
        
        try {
            const payload = JSON.parse(atob(parts[1]));
            const userId = payload.user_id || payload.sub;
            
            if (!userId) {
                console.error('No user ID in token');
                return;
            }
            
            // Connect WebSocket
            wsClient.connect(businessId, userId);
            
            // Setup UI handlers
            setupWebSocketHandlers();
        } catch (e) {
            console.error('Failed to decode JWT:', e);
        }
    } catch (e) {
        console.error('Failed to initialize WebSocket:', e);
    }
}

/**
 * Show notification helper
 */
function showNotification(message, type = 'info') {
    // Create a simple toast notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'warning' ? '#ff9800' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Add CSS animations
const wsStyle = document.createElement('style');
wsStyle.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
if (!document.head.querySelector('style[data-ws-animations]')) {
    wsStyle.setAttribute('data-ws-animations', 'true');
    document.head.appendChild(wsStyle);
}

// Initialize WebSocket when manage page loads (call this in manage.js after login)
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on a manage page with token
    if (localStorage.getItem('manage_token')) {
        setTimeout(initializeWebSocket, 100);
    }
});
