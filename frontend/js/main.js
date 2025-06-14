const lanIP = `http://${window.location.hostname}`;

const dom = {
    startQuizBtn: document.getElementById('startQuizBtn'),
    joinQuizBtn: document.getElementById('joinQuizBtn'),
    viewGraphsBtn: document.getElementById('viewGraphsBtn'),
    manageQuizBtn: document.getElementById('manageQuizBtn'),
    infoBtn: document.getElementById('infoBtn'),
    infoModal: document.getElementById('infoModal'),
    closeModal: document.querySelector('.c-modal__close'),
    tempValue: document.getElementById('tempValue'),
    lightValue: document.getElementById('lightValue'),
    servoTestBtn: document.getElementById('servoTestBtn'),
    servoVisual: document.getElementById('servoVisual')
};

let initialData

const showSensorData = (temp, light, degrees, players) => {
    if (dom.tempValue) dom.tempValue.textContent = temp;
    if (dom.lightValue) dom.lightValue.textContent = light;
};

const showServoMovement = (angle) => {
    if (dom.servoVisual) dom.servoVisual.style.transform = `rotate(${angle}deg)`;
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

const listenToButtons = () => {
    if (dom.infoBtn && dom.infoModal) {
        dom.infoBtn.addEventListener('click', () => {
            dom.infoModal.style.display = 'block';
        });
    }

    if (dom.closeModal) {
        dom.closeModal.addEventListener('click', () => {
            if (dom.infoModal) dom.infoModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (dom.infoModal && event.target === dom.infoModal) {
            dom.infoModal.style.display = 'none';
        }
    });

    if (dom.startQuizBtn) {
        dom.startQuizBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/html/quiz.html';
        });
    }

    if (dom.viewGraphsBtn) {
        dom.viewGraphsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/html/graphs.html';
        });
    }

    if (dom.manageQuizBtn) {
        dom.manageQuizBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/html/login.html';
        });
    }

    if (dom.joinQuizBtn) {
        dom.joinQuizBtn.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Join Quiz functionality not implemented yet');
        });
    }

    if (dom.servoTestBtn && dom.servoVisual) {
        dom.servoTestBtn.addEventListener('click', (e) => {
            e.preventDefault();
            testServoMovement();
        });
    }
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
    } else if (path.includes('quiz.html')) {
        initQuizPage();
    } else if (path.includes('login.html')) {
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

document.addEventListener('DOMContentLoaded', initApp);

if (document.readyState !== 'loading') {
    initApp();
} else {
    document.addEventListener('DOMContentLoaded', initApp);
}

// Socket.IO client connection
const socket = io(lanIP, {
    transports: ["polling", "websocket"],
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    forceNew: true,
    upgrade: true,
    rememberUpgrade: false
});

// Get DOM elements for updating
const connectionStatusElement = document.getElementById('connection-status');
const errorMessageElement = document.getElementById('error-message');
const tempValueElement = document.getElementById('tempValue');
const lightValueElement = document.getElementById('lightValue');
const soundValueElement = document.getElementById('soundValue');
const playerCountElement = document.getElementById('playerCount');
const servoVisualElement = document.getElementById('servoVisual');
const welcomeMessageElement = document.querySelector('.c-welcome-message p');

// Connection status helper function
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

// --- Connection Event Listeners ---

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

// --- Helper Functions ---
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

// --- Export functions for global use ---
window.socketFunctions = {
    sendMessage,
    joinRoom,
    leaveRoom,
    isConnected: () => socket.connected,
    getSocketId: () => socket.id,
    getConnectionStatus: () => connectionStatusElement?.textContent || 'Unknown'
};

// --- Modal and Button Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    const infoBtn = document.getElementById('infoBtn');
    const infoModal = document.getElementById('infoModal');
    const closeModal = document.querySelector('.c-modal__close');
    const servoTestBtn = document.getElementById('servoTestBtn');

    if (infoBtn) {
        infoBtn.addEventListener('click', () => {
            if (infoModal) infoModal.style.display = 'block';
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            if (infoModal) infoModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target === infoModal) {
            infoModal.style.display = 'none';
        }
    });

    if (servoTestBtn) {
        servoTestBtn.addEventListener('click', () => {
            console.log('Test Servo button clicked');
            socket.emit('test_servo', {});
        });
    }
});