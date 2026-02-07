/**
 * WebSocket Compatibility Layer for Cross-Browser Socket.IO Support
 * Handles Firefox, Safari, Edge, and other browser-specific WebSocket issues
 */

// Enhanced Socket.IO configuration with browser-specific fallbacks
window.createCompatibleSocket = function(serverURL, options = {}) {
    // Detect browser type for specific configurations
    const browser = window.browserCompat ? window.browserCompat.getBrowserInfo() : { name: 'unknown' };
    
    // Ensure we're using the correct server URL format
    let normalizedURL = serverURL;
    if (!serverURL.startsWith('http://') && !serverURL.startsWith('https://')) {
        // If it's just an IP or domain, use the current protocol
        normalizedURL = window.location.protocol + '//' + serverURL;
    }
    
    console.log(`🔌 Creating socket connection to: ${normalizedURL}`);
    
    // Default configuration optimized for Apache compatibility
    const defaultConfig = {
        transports: ['polling', 'websocket'], // Always try polling first for compatibility
        timeout: 30000, // Longer timeout for slower Apache responses
        reconnection: true,
        reconnectionAttempts: 6, // Fewer attempts to avoid overwhelming server
        reconnectionDelay: 3000, // Longer delay between attempts
        reconnectionDelayMax: 15000, // Max 15 second delay
        maxReconnectionAttempts: 6,
        forceNew: false, // Allow connection reuse
        upgrade: true,
        rememberUpgrade: false, // Don't remember upgrades across sessions
        autoConnect: true,
        
        // WebSocket specific options
        websocket: true,
        polling: true,
        flashsocket: false, // Disable Flash fallback
        
        // CORS and security - minimal for Apache compatibility
        withCredentials: false,
        timestampRequests: false, // Disable to avoid CORS issues
        timestampParam: 't',
        
        // Additional options for Apache environments
        jsonp: false, // Disable JSONP to avoid Apache issues
        enablesXDR: false, // Disable XDR for IE
        
        // Browser-specific configurations - simplified and more conservative
        ...(browser.isFirefox && {
            // Firefox-specific: prefer polling, longer timeouts
            transports: ['polling', 'websocket'],
            timeout: 30000,
            reconnectionDelay: 3000,
            forceNew: false // Allow reuse to avoid connection issues
        }),
        
        ...(browser.isSafari && {
            // Safari-specific: standard config with longer timeout
            timeout: 30000,
            reconnectionDelay: 2500
        }),
        
        ...(browser.isEdge && {
            // Edge-specific: similar to Chrome but more conservative
            timeout: 28000,
            reconnectionDelay: 2500
        }),
        
        ...(browser.isIE && {
            // IE-specific: polling only for maximum compatibility
            transports: ['polling'],
            upgrade: false,
            timeout: 35000,
            reconnectionAttempts: 5,
            reconnectionDelay: 5000
        })
    };
    
    // Merge user options with defaults
    const config = Object.assign({}, defaultConfig, options);
    
    console.log(`🔌 Creating Socket.IO connection for ${browser.name} browser`, config);
    
    // Create socket with enhanced error handling
    let socket;
    
    try {
        // Check if io is available
        if (typeof io === 'undefined') {
            throw new Error('Socket.IO library not loaded');
        }
        
        socket = io(serverURL, config);
        
        // Enhanced connection handling with retries
        setupEnhancedConnectionHandling(socket, serverURL, config, browser);
        
        // Add enhanced WebSocket event handlers
        setupEnhancedEventHandlers(socket);
        
    } catch (error) {
        console.error('❌ Failed to create Socket.IO connection:', error);
        
        // Fallback: Create a mock socket for offline functionality
        socket = createMockSocket();
    }
    
    return socket;
};

function setupEnhancedConnectionHandling(socket, serverURL, config, browser) {
    let reconnectAttempts = 0;
    let maxReconnectAttempts = config.reconnectionAttempts || 10;
    let reconnectDelay = config.reconnectionDelay || 1000;
    
    // Connection success
    socket.on('connect', () => {
        console.log('✅ Socket.IO connected successfully');
        reconnectAttempts = 0;
        
        // Update connection status in UI if element exists
        updateConnectionStatus('connected', 'Connected to server');
    });
    
    // Connection error with Apache-aware handling
    socket.on('connect_error', (error) => {
        console.error(`❌ Socket.IO connection error (${browser.name}):`, error);
        
        // Check for Apache-specific errors
        if (error.message.includes('CORS') || error.message.includes('403') || error.message.includes('500')) {
            console.log('� Apache configuration issue detected, using polling-only mode...');
            
            // Disconnect current socket
            socket.disconnect();
            
            // Retry with minimal configuration for Apache
            setTimeout(() => {
                const apacheConfig = {
                    transports: ['polling'], // Polling only for Apache compatibility
                    upgrade: false,
                    forceNew: true,
                    timeout: 45000, // Very long timeout for Apache
                    withCredentials: false,
                    timestampRequests: false,
                    jsonp: false
                };
                
                try {
                    const newSocket = io(serverURL, apacheConfig);
                    replaceSocketMethods(socket, newSocket);
                    console.log('🔄 Retrying with Apache-compatible configuration...');
                } catch (retryError) {
                    console.error('❌ Apache-compatible retry failed:', retryError);
                    handleConnectionFailure(socket, error);
                }
            }, 3000);
            
        } else if (browser.isFirefox && error.message.includes('websocket')) {
            console.log('🔄 Firefox WebSocket failed, retrying with polling only...');
            
            setTimeout(() => {
                const pollingConfig = Object.assign({}, config, {
                    transports: ['polling'],
                    upgrade: false,
                    forceNew: true
                });
                
                try {
                    const newSocket = io(serverURL, pollingConfig);
                    replaceSocketMethods(socket, newSocket);
                } catch (retryError) {
                    console.error('❌ Polling retry failed:', retryError);
                    handleConnectionFailure(socket, error);
                }
            }, 2000);
            
        } else if (browser.isSafari && error.type === 'TransportError') {
            console.log('🔄 Safari transport error, adjusting configuration...');
            
            setTimeout(() => {
                socket.io.opts.transports = ['polling'];
                socket.connect();
            }, 3000);
            
        } else {
            // Generic error handling
            handleConnectionFailure(socket, error);
        }
    });
    
    // Disconnect handling
    socket.on('disconnect', (reason) => {
        console.warn(`⚠️ Socket.IO disconnected (${browser.name}):`, reason);
        updateConnectionStatus('disconnected', `Disconnected: ${reason}`);
        
        // Auto-reconnect logic with exponential backoff
        if (reason !== 'io client disconnect' && reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts), 30000);
            
            console.log(`🔄 Attempting reconnect ${reconnectAttempts + 1}/${maxReconnectAttempts} in ${delay}ms...`);
            
            setTimeout(() => {
                reconnectAttempts++;
                socket.connect();
            }, delay);
        }
    });
    
    // Reconnection success
    socket.on('reconnect', (attemptNumber) => {
        console.log(`✅ Socket.IO reconnected after ${attemptNumber} attempts`);
        reconnectAttempts = 0;
        updateConnectionStatus('connected', 'Reconnected to server');
    });
    
    // Reconnection attempt
    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
        updateConnectionStatus('connecting', `Reconnecting... (${attemptNumber})`);
    });
    
    // Reconnection failed
    socket.on('reconnect_failed', () => {
        console.error('❌ Socket.IO reconnection failed');
        updateConnectionStatus('failed', 'Connection failed - check your internet connection');
        
        // Offer manual retry option
        showManualRetryOption(socket);
    });
}

function replaceSocketMethods(originalSocket, newSocket) {
    // Transfer event listeners and replace connection methods
    originalSocket.io = newSocket.io;
    originalSocket.id = newSocket.id;
    originalSocket.connected = newSocket.connected;
    
    // Override methods to use new socket
    ['emit', 'on', 'off', 'once', 'connect', 'disconnect'].forEach(method => {
        originalSocket[method] = newSocket[method].bind(newSocket);
    });
}

function handleConnectionFailure(socket, error) {
    updateConnectionStatus('error', 'Connection failed');
    
    // Show user-friendly error message
    const errorMsg = getErrorMessage(error);
    showConnectionError(errorMsg);
}

function getErrorMessage(error) {
    if (error.message.includes('websocket')) {
        return 'WebSocket connection failed. Your browser or network may be blocking WebSocket connections. The app will try using HTTP polling instead.';
    } else if (error.message.includes('timeout')) {
        return 'Connection timeout. Please check your internet connection and try again.';
    } else if (error.message.includes('CORS')) {
        return 'Cross-origin request blocked. Please ensure the server allows connections from this domain.';
    } else {
        return 'Unable to connect to the server. Please check your internet connection and try refreshing the page.';
    }
}

function updateConnectionStatus(status, message) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-${status}`;
    }
}

function showConnectionError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 10000);
    }
}

function showManualRetryOption(socket) {
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Retry Connection';
    retryButton.className = 'c-btn c-btn--primary';
    retryButton.onclick = () => {
        socket.connect();
        retryButton.remove();
    };
    
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.appendChild(retryButton);
    }
}

function createMockSocket() {
    // Create a mock socket for offline functionality
    const mockSocket = {
        connected: false,
        id: null,
        
        on: function(event, callback) {
            console.log(`Mock socket: registered listener for '${event}'`);
        },
        
        emit: function(event, data) {
            console.log(`Mock socket: would emit '${event}' with data:`, data);
        },
        
        off: function(event, callback) {
            console.log(`Mock socket: removed listener for '${event}'`);
        },
        
        connect: function() {
            console.log('Mock socket: connect called (no-op)');
        },
        
        disconnect: function() {
            console.log('Mock socket: disconnect called (no-op)');
        }
    };
    
    updateConnectionStatus('offline', 'Working in offline mode');
    return mockSocket;
}

function setupEnhancedEventHandlers(socket) {
    // Handle server pong responses
    socket.on('pong', (data) => {
        console.log('🏓 Pong received from server:', data);
        updateConnectionStatus('connected', 'Connection active');
    });
    
    // Handle connection test responses
    socket.on('connection_test_response', (data) => {
        console.log('✅ Connection test successful:', data);
        updateConnectionStatus('connected', 'Connection verified');
    });
    
    // Handle connection info
    socket.on('connection_info', (data) => {
        console.log('ℹ️ Connection info:', data);
        
        // Store connection info globally for diagnostic purposes
        window.connectionInfo = data;
    });
    
    // Enhanced welcome handler
    socket.on('welcome', (data) => {
        console.log('👋 Welcome message received:', data);
        
        // Update UI with connection details
        updateConnectionStatus('connected', `Connected via ${data.transport || 'unknown'}`);
        
        // Send a connection test to verify everything works
        setTimeout(() => {
            socket.emit('connection_test', { 
                test: 'initial_test',
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            });
        }, 1000);
    });
    
    // Periodic ping to keep connection alive
    let pingInterval;
    
    socket.on('connect', () => {
        // Start periodic ping
        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('ping');
                console.log('🏓 Ping sent to server');
            }
        }, 30000); // Ping every 30 seconds
    });
    
    socket.on('disconnect', () => {
        // Stop periodic ping
        clearInterval(pingInterval);
    });
    
    // Request connection info after connecting
    socket.on('connect', () => {
        setTimeout(() => {
            socket.emit('get_connection_info');
        }, 500);
    });
}

// Auto-replace global io function if available
if (typeof io !== 'undefined') {
    window._originalIo = io;
    window.io = function(url, options) {
        return window.createCompatibleSocket(url, options);
    };
}