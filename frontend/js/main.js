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
    soundValue: document.getElementById('soundValue'),
    lightValue: document.getElementById('lightValue'),
    playerCount: document.getElementById('playerCount'),
    servoTestBtn: document.getElementById('servoTestBtn'),
    servoVisual: document.getElementById('servoVisual')
};

const socket = io(lanIP, {
  transports: ["websocket", "polling"]
});

// Event listeners
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
  document.getElementById('connection-status').textContent = 'Connected';
});

socket.on('disconnect', () => {
  console.log('Disconnected');
  document.getElementById('connection-status').textContent = 'Disconnected';
});

// Handle sensor data updates
socket.on('sensor_data', (data) => {
  console.log('Sensor update:', data);
  
  // Update your UI elements
  if (data.temperature !== undefined) {
    document.getElementById('temperature').textContent = `${data.temperature.toFixed(1)}°C`;
  }
  if (data.illuminance !== undefined) {
    document.getElementById('light').textContent = `${data.illuminance.toFixed(0)} lux`;
  }
  if (data.servo_angle !== undefined) {
    document.getElementById('servo-angle').textContent = `${data.servo_angle}°`;
    // Optional: Update a visual servo position indicator
    document.getElementById('servo-indicator').style.transform = `rotate(${data.servo_angle}deg)`;
  }
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err);
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.textContent = `Connection error: ${err.message}`;
  }
});

// Add this to debug connection issues
socket.onAny((event, ...args) => {
  console.log('Socket event:', event, args);
});











const showSensorData = (temp, light, degrees, players) => {
    if (dom.tempValue) dom.tempValue.textContent = temp;
    if (dom.lightValue) dom.lightValue.textContent = light;
    if (dom.soundValue) dom.soundValue.textContent = degrees;
    if (dom.playerCount) dom.playerCount.textContent = players;
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

    const initialData = getInitialPlaceholderData();
    showSensorData(
        initialData.temp,
        initialData.light,
        initialData.degrees,
        initialData.players
    );
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

    // If IP is not banned or not determined, proceed with loading other page content
    // e.g., loadUsers() or other admin panel initialization
    // console.log("Proceeding with normal page load functions.");
    // loadUsers(); // Example: if loadUsers is part of your initial page setup
});

// IMPORTANT: Ensure `lanIP` is defined and accessible in this scope.
// For example, it might be defined globally in an `app.js` or `config.js` file:
// const lanIP = "http://your_raspberry_pi_ip:8000";