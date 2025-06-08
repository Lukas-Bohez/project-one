const lanIP = `http://${window.location.hostname}:8000`;
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

const getClientIP = async () => {
    try {
        const response = await fetch('/api/get-client-ip');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.ip_address;
    } catch (error) {
        return null;
    }
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

        if (response.ok) {
            alert(data.message);
        } else {
            if (response.status === 409) {
                let alertMessage = `${data.message}\n\n`;
                if (data.active_session) {
                    alertMessage += `Active Quiz: ${data.active_session.name}\n`;
                    alertMessage += `Description: ${data.active_session.description || 'N/A'}\n`;
                    if (data.active_session.start_time) {
                        const startTime = new Date(data.active_session.start_time).toLocaleString();
                        alertMessage += `Started: ${startTime}`;
                    }
                }
                alert(alertMessage);
            } else if (response.status === 429) {
                alert(`Failed to trigger servo: ${data.detail}`);
            } else {
                alert(`Failed to trigger servo: ${data.detail || `HTTP error! Status: ${response.status}`}`);
            }
        }
    } catch (error) {
        alert(`Network error during servo trigger: ${error.message}`);
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















STORAGE_IP = {
  IP: {
    IP:'IP'
  }
};







// admin.js (or a new script file loaded on your admin page)

// Function to fetch the client's IP address from your backend
const getClientIpAddress = async () => {
    try {
        // Assuming your FastAPI app is running on lanIP:8000
        const url = `${lanIP}/api/v1/client-ip`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        sessionStorage.setItem(STORAGE_IP.IP.IP, data.ip_address);
        return data.ip_address;
    } catch (error) {
        console.error("Error fetching client IP:", error);
        // Fallback or error handling if IP cannot be fetched
        return null;
    }
};

// Function to check IP ban status and create/track IP
const handleIpStatus = async (ipAddress) => {
    if (!ipAddress) {
        console.warn("No IP address available to check status.");
        return;
    }

    try {
        const url = `${lanIP}/api/v1/ip-status`; // New endpoint
        const response = await fetch(url, {
            method: 'POST', // Use POST to send IP address securely in body
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ ip_address: ipAddress })
        });

        if (!response.ok) {
            // Even if the IP is banned, the backend might return 200 with is_banned: true
            // So, check for actual HTTP errors here
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        console.log("IP Status Check Result:", result);

        if (result.is_banned) {
            console.warn(`IP Address ${ipAddress} is banned! Kicking user...`);
            // Redirect to a banned page or show a prominent message
            window.location.href = `${lanIP}/banned`; // Redirect to a dedicated banned page
            // Or, if you want to display on the current page:
            // document.body.innerHTML = '<div style="text-align: center; margin-top: 100px; font-size: 2em; color: red;">Your IP address is banned. Access Denied.</div>';
            return true; // Indicate that the user is banned
        } else {
            console.log(`IP Address ${ipAddress} is not banned. Welcome!`);
            const storedIP = sessionStorage.getItem(STORAGE_IP.IP.IP);
            console.log('Stored IP:', storedIP);
            // IP is not banned, continue normal site operations
            return false; // Indicate that the user is not banned
        }

    } catch (error) {
        console.error("Error handling IP status:", error);
        // Decide how to handle this error. For security, you might want to default to denying access
        // or logging this attempt on the backend.
        // For now, we'll let them through but log the issue.
        return false; // Assume not banned if error occurs
    }
};

// Main execution block when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Content Loaded. Initiating IP check...");

    // Get the client's IP address
    const clientIp = await getClientIpAddress();

    if (clientIp) {
        // Handle IP status (check ban, create/track if new)
        const isBanned = await handleIpStatus(clientIp);
        if (isBanned) {
            // The handleIpStatus function already redirected, so just return
            return;
        }
    } else {
        console.error("Could not determine client IP address. Proceeding with caution.");
        // Decide on a policy here: allow access but log, or restrict access.
        // For simplicity, we proceed without a ban check if IP is unknown.
    }
});






















// Socket.IO client connection
const socket = io(lanIP, {
    transports: ["websocket", "polling"],
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// Get DOM elements for updating
const connectionStatusElement = document.getElementById('connection-status'); // You might want to add this div in HTML for status messages
const errorMessageElement = document.getElementById('error-message'); // You might want to add this div in HTML for error messages
const tempValueElement = document.getElementById('tempValue');
const lightValueElement = document.getElementById('lightValue');
const soundValueElement = document.getElementById('soundValue'); // Assuming 'soundValue' is for servo angle
const playerCountElement = document.getElementById('playerCount');
const servoVisualElement = document.getElementById('servoVisual');
const welcomeMessageElement = document.querySelector('.c-welcome-message p'); // Selecting the paragraph within the welcome message div

// --- Connection Event Listeners ---

socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
    if (connectionStatusElement) {
        connectionStatusElement.textContent = 'Connected';
        // CORRECTED LINE: Use connectionStatusElement instead of dom.connectionStatus
        connectionStatusElement.className = 'status-connected';
    }
    if (errorMessageElement) {
        errorMessageElement.textContent = '';
        errorMessageElement.style.display = 'none';
    }
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
    if (connectionStatusElement) {
        connectionStatusElement.textContent = 'Disconnected';
        connectionStatusElement.className = 'status-disconnected';
    }
});

// --- Handle Welcome Message ---

socket.on('welcome', (data) => {
    console.log('Welcome message:', data);
    if (welcomeMessageElement && data.message) {
        // Assuming the welcome message should be added to the existing paragraph
        welcomeMessageElement.textContent = data.message;
    }
});







// --- Handle Sensor Data Updates ---
        // initialData.temp,
        // initialData.light,
        // initialData.degrees,

socket.on('sensor_data', (data) => {
    if (data.temperature !== undefined && tempValueElement) {
        tempValueElement.textContent = `${data.temperature.toFixed(1)}`;
        initialData.temp = data.temperature.toFixed(1); // This line will now work
    }

    if (data.illuminance !== undefined && lightValueElement) {
        lightValueElement.textContent = `${data.illuminance.toFixed(0)}`;
        initialData.light = data.illuminance.toFixed(0); // This line will now work
    }

    if (data.servo_angle !== undefined) {
;
        initialData.degrees = data.servo_angle; // This line will now work
    }
    if (data.connected !== undefined) {

        initialData.degrees = data.connected;
    }
});



















// Listener for when a new client connects
socket.on('client_connected', (data) => {
    console.log('Client connected event received. Total clients:', data.total_clients);
    if (dom.playerCount) {
        dom.playerCount.textContent = data.total_clients;
    }
    // Update your global initialData as well, for consistency
    initialData.players = data.total_clients;
    console.log(initialData.players)
});

// Listener for when a client disconnects
socket.on('client_disconnected', (data) => {
    console.log('Client disconnected event received. Total clients:', data.total_clients);
    if (dom.playerCount) {
        dom.playerCount.textContent = data.total_clients;
    }
    // Update your global initialData as well
    initialData.players = data.total_clients;
    console.log(initialData.players)
});


// --- Handle Server Notifications ---
// You'll need to add a div with id="notifications" in your HTML to display these.
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
// These values are currently not mapped to specific elements in your HTML.
// If you want to display 'Updates' or 'Connected clients' from periodic_update,
// you'll need to add elements like <span id="updateCounter"></span> or <span id="clientCountPeriodic"></span>.
socket.on('periodic_update', (data) => {
    console.log('Periodic update:', data);
    // You might want to update playerCountElement here as well if 'connected_clients' is the source
    if (data.connected_clients !== undefined && playerCountElement) {
        initialData.players = data.connected_clients;
    }
});











// --- Handle Client Connection/Disconnection Events ---

socket.on('client_connected', (data) => {
    console.log('New client connected:', data);
    updateClientCount(data.total_clients);
});

socket.on('client_disconnected', (data) => {
    console.log('Client disconnected:', data);
    updateClientCount(data.total_clients);
});

// --- Handle Broadcasted Messages ---
// You'll need a div with id="messages" in your HTML to display these.
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
// You'll need a div with id="current-room" in your HTML to display this.
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
    if (errorMessageElement) {
        errorMessageElement.textContent = `Connection error: ${err.message}`;
        errorMessageElement.style.display = 'block';
        errorMessageElement.className = 'error-message';
    }
    if (connectionStatusElement) {
        connectionStatusElement.textContent = 'Connection Error';
        connectionStatusElement.className = 'status-error';
    }
});

// --- Reconnection Events ---

socket.on('reconnect', (attemptNumber) => {
    console.log('Reconnected after', attemptNumber, 'attempts');
    if (connectionStatusElement) {
        connectionStatusElement.textContent = 'Reconnected';
        connectionStatusElement.className = 'status-connected';
    }
});

socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('Reconnection attempt:', attemptNumber);
    if (connectionStatusElement) {
        connectionStatusElement.textContent = `Reconnecting... (${attemptNumber})`;
        connectionStatusElement.className = 'status-reconnecting';
    }
});

socket.on('reconnect_failed', () => {
    console.error('Reconnection failed');
    if (connectionStatusElement) {
        connectionStatusElement.textContent = 'Connection Failed';
        connectionStatusElement.className = 'status-error';
    }
});

// --- Debug: Log all socket events --- in case of emergency
// socket.onAny((event, ...args) => {
//     console.log('Socket event:', event, args);
// });

// --- Helper Functions ---

function updateClientCount(count) {
    if (playerCountElement) {
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
    getSocketId: () => socket.id
};

// --- Modal and Button Event Listeners (from your original HTML context) ---
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
            // Emit an event to the server to test the servo
            // The server will then likely send back sensor_data with the updated servo angle
            socket.emit('test_servo', { /* any data needed for testing servo */ });
        });
    }

});