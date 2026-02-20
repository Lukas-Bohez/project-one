// Use the current page's protocol and hostname for Socket.IO connection
const lanIP = `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}`;

const dom = {
    startQuizBtn: document.getElementById('startQuizBtn'),
    joinQuizBtn: document.getElementById('joinQuizBtn'),
    viewGraphsBtn: document.getElementById('viewGraphsBtn'),
    manageQuizBtn: document.getElementById('manageQuizBtn'),
    infoBtn: document.getElementById('infoBtn'),
    closeModal: document.querySelector('.c-modal__close'),
    servoTestBtn: document.getElementById('servoTestBtn')
};

let initialData

const showSensorData = (temp, light, degrees, players) => {
    // Sensor display elements removed - live data feature retired
};

const showServoMovement = (angle) => {
    // Servo visual element removed - live data feature retired
};

const callbackUpdateDifficulty = (temp, light, sound) => {
    console.log(`Updating difficulty based on temp: ${temp}°C, light: ${light} lux, sound: ${sound} dB`);
};

const getInitialPlaceholderData = () => {
    return {
        temp: 25,
        light: 500,
        degrees: 90,
        players: 1
    };
};

const showSection = (sectionName) => {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    // Remove active class from all nav buttons
    const navBtns = document.querySelectorAll('.c-nav-btn');
    navBtns.forEach(btn => {
        btn.classList.remove('active');
    });

    // Show the selected section
    const activeSection = document.getElementById(`${sectionName}-section`);
    if (activeSection) {
        activeSection.classList.add('active');
    }

    // Add active class to the clicked nav button
    const activeBtn = document.querySelector(`.c-nav-btn[data-section="${sectionName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
};

const listenToButtons = () => {

    if (dom.startQuizBtn) {
        dom.startQuizBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/pages/spire-ai/';
        });
    }

    if (dom.viewGraphsBtn) {
        dom.viewGraphsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/pages/graphs/';
        });
    }

    if (dom.manageQuizBtn) {
        dom.manageQuizBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/pages/login/';
        });
    }

    if (dom.joinQuizBtn) {
        dom.joinQuizBtn.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Join Quiz functionality not implemented yet');
        });
    }

    // Navigation functionality
    const navBtns = document.querySelectorAll('.c-nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            showSection(section);
        });
    });
};

const testServoMovement = async () => {
    try {
        const url = `${lanIP}/api/v1/trigger-servo`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ command: "SWEEP_SERVO" })
        });
        const data = await response.json();

        // DEBUG: Log what we actually receive
        console.log("Response status:", response.status);
        console.log("Response data:", data);
        console.log("data.detail:", data.detail);

        if (response.ok) {
            console.log(data.message);
        } else {
            console.log(data.detail || JSON.stringify(data) || "Unknown error");
        }
    } catch (error) {
        console.log(`Network error during servo trigger: ${error.message}`);
    }
};

const initIndexPage = () => {
    listenToButtons();
    markInitializationSuccess();

    initialData = getInitialPlaceholderData();
    showSensorData(
        initialData.temp,
        initialData.light,
        initialData.degrees,
        initialData.players
    );
    if (initialData.degrees == null){
      initialData.degrees = 90  
    } 
    showServoMovement(initialData.degrees);
};

const initQuizPage = () => {
    listenToButtons();
    markInitializationSuccess();
};

const initLoginPage = () => {
    listenToButtons();
    markInitializationSuccess();
};

const markInitializationSuccess = () => {
    const successDiv = document.createElement('div');
    successDiv.id = 'init-success';
    successDiv.style.display = 'none';
    document.body.appendChild(successDiv);
};

const initApp = () => {
    testAllFunctions();

    const path = window.location.pathname;
    if (path.includes('index.html') || path === '/') {
        initIndexPage();
    } else if (path.startsWith('/pages/quiz')) {
        initQuizPage();
    } else if (path.startsWith('/pages/login')) {
        initLoginPage();
    }

    setTimeout(() => {
        if (!document.querySelector('#init-success')) {
            manualInitialize();
        }
    }, 1000);
};

const testAllFunctions = () => {
    const testData = getInitialPlaceholderData();
    showSensorData(testData.temp, testData.light, testData.degrees, testData.players);
    showServoMovement(testData.degrees);
    callbackUpdateDifficulty(testData.temp, testData.light, 75);
};

const manualInitialize = () => {
    listenToButtons();
};

if (document.readyState !== 'loading') {
    initApp();
} else {
    document.addEventListener('DOMContentLoaded', initApp);
}

// Enhanced Socket.IO client connection with cross-browser compatibility
console.log(`🔌 Socket.IO connection removed - no longer needed for this page`);

// Socket.IO functionality has been removed as temperature/light readings are no longer relevant
// Previous Socket.IO code has been commented out below for reference:

/*
const socket = window.createCompatibleSocket ?
    window.createCompatibleSocket(lanIP, {
        // Enhanced configuration for better reliability
        timeout: 30000,             // 30 second timeout
        reconnectionAttempts: 10,   // More retry attempts
        reconnectionDelay: 2000,    // Start with 2 second delay
        reconnectionDelayMax: 10000, // Max 10 second delay
        autoConnect: true,          // Auto connect on creation
        forceNew: false            // Allow connection reuse
    }) :
    io(lanIP, {
        // Enhanced fallback configuration
        transports: ["polling", "websocket"],  // Try polling first for compatibility
        timeout: 30000,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        forceNew: false,
        upgrade: true,              // Allow upgrade to websocket
        rememberUpgrade: false      // Don't remember across sessions
    });

// Enhanced connection logging
socket.on('connect', () => {
    console.log('✅ Successfully connected to server');
    console.log('Transport:', socket.io.engine.transport.name);

    // Log any transport upgrades
    socket.io.engine.on('upgrade', () => {
        console.log('⬆️ Transport upgraded to:', socket.io.engine.transport.name);
    });
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
    console.error('Error details:', error);
});

socket.on('disconnect', (reason) => {
    console.warn('⚠️ Disconnected:', reason);
});

socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Reconnected after', attemptNumber, 'attempts');
    console.log('New transport:', socket.io.engine.transport.name);
});

socket.on('reconnect_error', (error) => {
    console.error('🔴 Reconnection failed:', error.message);
});

socket.on('reconnect_failed', () => {
    console.error('💀 All reconnection attempts failed');
});
*/

// Get DOM elements for updating
// Note: Connection status and sensor data elements have been removed from index.html
// as Socket.IO functionality is no longer needed

// Connection status helper function - no longer used
/*
const updateConnectionStatus = (status, message, className) => {
    if (connectionStatusElement) {
        connectionStatusElement.textContent = message || status;
        connectionStatusElement.className = className || `status-${status.toLowerCase()}`;
    }
    
    // Clear error messages when connected
    if (status === 'Connected' && errorMessageElement) {
        errorMessageElement.style.display = 'none';
        errorMessageElement.textContent = '';
    }
    
    console.log(`Connection status: ${status} - ${message || ''}`);
};
*/

// --- Connection Event Listeners --- Removed as Socket.IO is no longer used
/*
// When socket is connecting
socket.on('connecting', () => {
    updateConnectionStatus('Connecting', 'Connecting to server...', 'status-connecting');
});

// When socket successfully connects
socket.on('connect', () => {
    updateConnectionStatus('Connected', 'Connected to server', 'status-connected');
    console.log('Socket connected with ID:', socket.id);
});

// When socket disconnects
socket.on('disconnect', (reason) => {
    updateConnectionStatus('Disconnected', `Disconnected: ${reason}`, 'status-disconnected');
    console.log('Socket disconnected:', reason);
});

// Listener for when a new client connects
socket.on('client_connected', (data) => {
    console.log('Client connected event received. Total clients:', data.total_clients);
    if (dom.playerCount) {
        dom.playerCount.textContent = data.total_clients;
    }
    if (playerCountElement) {
        playerCountElement.textContent = data.total_clients;
    }
    if (initialData) {
        initialData.players = data.total_clients;
    }
    console.log('Updated player count:', data.total_clients);
});

// Listener for when a client disconnects
socket.on('client_disconnected', (data) => {
    console.log('Client disconnected event received. Total clients:', data.total_clients);
    if (dom.playerCount) {
        dom.playerCount.textContent = data.total_clients;
    }
    if (playerCountElement) {
        playerCountElement.textContent = data.total_clients;
    }
    if (initialData) {
        initialData.players = data.total_clients;
    }
    console.log('Updated player count:', data.total_clients);
});

// --- Handle Welcome Message ---
socket.on('welcome', (data) => {
    console.log('Welcome message:', data);
    if (welcomeMessageElement && data.message) {
        welcomeMessageElement.textContent = data.message;
    }
});

// --- Handle Sensor Data Updates ---
socket.on('sensor_data', (data) => {
    if (data.temperature !== undefined && tempValueElement) {
        tempValueElement.textContent = `${data.temperature.toFixed(1)}`;
        if (initialData) {
            initialData.temp = data.temperature.toFixed(1);
        }
    }

    if (data.illuminance !== undefined && lightValueElement) {
        lightValueElement.textContent = `${data.illuminance.toFixed(0)}`;
        if (initialData) {
            initialData.light = data.illuminance.toFixed(0);
        }
    }

    if (data.servo_angle !== undefined && initialData) {
        initialData.degrees = data.servo_angle;
        showServoMovement(data.servo_angle);
    }
    
    if (data.connected !== undefined && initialData) {
        initialData.degrees = data.connected;
    }
});

// --- Handle Server Notifications ---
socket.on('notification', (data) => {
    console.log('Server notification:', data);
    const notificationElement = document.getElementById('notifications');
    if (notificationElement) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${data.type || 'info'}`;
        notification.innerHTML = `
            <strong>${data.title || 'Notification'}</strong>
            <p>${data.message}</p>
            <small>${new Date(data.timestamp).toLocaleTimeString()}</small>
        `;
        notificationElement.appendChild(notification);
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
});

// --- Handle Periodic Updates ---
socket.on('periodic_update', (data) => {
    console.log('Periodic update:', data);
    if (data.connected_clients !== undefined) {
        if (playerCountElement) {
            playerCountElement.textContent = data.connected_clients;
        }
        if (initialData) {
            initialData.players = data.connected_clients;
        }
    }
});

// --- Handle Broadcasted Messages ---
socket.on('message_received', (data) => {
    console.log('Message received:', data);
    const messagesElement = document.getElementById('messages');
    if (messagesElement) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="sender">From: ${data.from}</span>
                <span class="timestamp">${new Date(data.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="message-body">${JSON.stringify(data.data, null, 2)}</div>
        `;
        messagesElement.appendChild(messageDiv);
        messagesElement.scrollTop = messagesElement.scrollHeight;
    }
});

// --- Handle Room Events ---
socket.on('room_joined', (data) => {
    console.log('Joined room:', data);
    const roomElement = document.getElementById('current-room');
    if (roomElement) {
        roomElement.textContent = `Current room: ${data.room}`;
    }
});

socket.on('room_left', (data) => {
    console.log('Left room:', data);
    const roomElement = document.getElementById('current-room');
    if (roomElement) {
        roomElement.textContent = 'No room';
    }
});

// --- Connection Error Handling ---
socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
    updateConnectionStatus('Error', `Connection error: ${err.message}`, 'status-error');
    
    if (errorMessageElement) {
        errorMessageElement.textContent = `Connection error: ${err.message}`;
        errorMessageElement.style.display = 'block';
        errorMessageElement.className = 'error-message';
    }
});

// --- Reconnection Events ---
socket.on('reconnect', (attemptNumber) => {
    console.log('Reconnected after', attemptNumber, 'attempts');
    updateConnectionStatus('Connected', 'Reconnected to server', 'status-connected');
});

socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('Reconnection attempt:', attemptNumber);
    updateConnectionStatus('Reconnecting', `Reconnecting... (attempt ${attemptNumber})`, 'status-reconnecting');
});

socket.on('reconnect_failed', () => {
    console.error('Reconnection failed');
    updateConnectionStatus('Failed', 'Connection failed - all reconnection attempts exhausted', 'status-error');
});
*/

// --- Helper Functions --- Removed as Socket.IO is no longer used
/*
function updateClientCount(count) {
    if (playerCountElement) {
        playerCountElement.textContent = count;
    }
    if (initialData) {
        initialData.players = count;
    }
}

// Function to send a message to the server
function sendMessage(data) {
    if (socket.connected) {
        socket.emit('message', data);
    } else {
        console.warn('Socket not connected, cannot send message');
    }
}

// Function to join a room
function joinRoom(roomName) {
    if (socket.connected) {
        socket.emit('join_room', { room: roomName });
    } else {
        console.warn('Socket not connected, cannot join room');
    }
}

// Function to leave a room
function leaveRoom(roomName) {
    if (socket.connected) {
        socket.emit('leave_room', { room: roomName });
    } else {
        console.warn('Socket not connected, cannot leave room');
    }
}
*/

// --- Export functions for global use --- Removed Socket.IO functions
/*
window.socketFunctions = {
    sendMessage,
    joinRoom,
    leaveRoom,
    isConnected: () => socket.connected,
    getSocketId: () => socket.id,
    getConnectionStatus: () => connectionStatusElement?.textContent || 'Unknown'
};
*/

// --- Modal and Button Event Listeners ---
// Removed Socket.IO servo test functionality
document.addEventListener('DOMContentLoaded', () => {
    const infoBtn = document.getElementById('infoBtn');
    const closeModal = document.querySelector('.c-modal__close');
    // Removed servoTestBtn as Socket.IO functionality is no longer needed

    // Info modal functionality remains if needed
    if (infoBtn && closeModal) {
        // Add modal functionality here if needed
    }
});