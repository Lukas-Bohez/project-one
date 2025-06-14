// Fixed PlayersListManager with proper socket handling and data processing

class PlayersListManager {
    constructor(socket, currentUser) {
        this.socket = socket;
        this.currentUser = currentUser;
        this.updateInterval = null;
        this.playersContainer = document.getElementById('playersList');
        this.isActive = false;
        
        // Validate socket connection
        if (!this.socket) {
            console.error("PlayersListManager: Socket is not provided or undefined");
            return;
        }
        
        // Bind the socket listener
        this.setupSocketListener();
        
        console.log("PlayersListManager initialized with user:", this.currentUser);
    }

    // Set up the socket listener for player data updates
    setupSocketListener() {
        if (!this.socket) {
            console.error("Cannot setup socket listener: socket is undefined");
            return;
        }

        console.log("Setting up socket listener for 'all_users_data_updated'");
        
        this.socket.on('all_users_data_updated', (data) => {
            console.log("Received all_users_data_updated:", data);
            this.updatePlayersDisplay(data);
        });

        // Also listen for errors
        this.socket.on('error', (error) => {
            console.error("Socket error in PlayersListManager:", error);
        });
    }

    // Start the auto-update interval
    startAutoUpdate() {
        if (!this.socket) {
            console.error("Cannot start auto-update: socket is undefined");
            return;
        }

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.isActive = true;
        
        // Request initial data
        this.requestPlayerData();
        
        // Set up interval to request data every 5 seconds
        this.updateInterval = setInterval(() => {
            if (this.isActive && this.getCurrentUserId()) {
                this.requestPlayerData();
            }
        }, 5000);

        console.log("Players list auto-update started");
    }

    // Stop the auto-update interval
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.isActive = false;
        console.log("Players list auto-update stopped");
    }

    // Get current user ID with multiple fallback options
    getCurrentUserId() {
        if (!this.currentUser) {
            console.warn("No current user set");
            return null;
        }

        // Try different possible property names for user ID
        const userId = this.currentUser.id || 
                      this.currentUser.user_id || 
                      this.currentUser.userId ||
                      this.currentUser.ID;
        
        if (!userId) {
            console.warn("Could not determine user ID from:", this.currentUser);
        }
        
        return userId;
    }

    // Request player data from server
    requestPlayerData() {
        if (!this.socket) {
            console.error("Cannot request player data: socket is undefined");
            return;
        }

        const userId = this.getCurrentUserId();
        if (!userId) {
            console.warn("No valid user ID available, cannot request player data");
            return;
        }

        const requestData = {
            user_id: userId
        };

        console.log("Requesting player data:", requestData);
        this.socket.emit('request_user_data', requestData);
    }

    // Update the players display with received data
    updatePlayersDisplay(data) {
        console.log("Updating players display with data:", data);
        
        // Handle different possible response structures
        if (!data) {
            console.warn("No data received");
            this.showNoDataMessage();
            return;
        }

        // Handle case where data might be wrapped differently
        let players = data.players || data || [];
        
        if (!Array.isArray(players)) {
            console.warn("Players data is not an array:", players);
            this.showNoDataMessage();
            return;
        }

        if (players.length === 0) {
            console.log("No players in session");
            this.showNoPlayersMessage(data.session_name);
            return;
        }

        // Sort players by session score (highest first)
        const sortedPlayers = players.sort((a, b) => {
            const scoreA = this.getPlayerScore(a);
            const scoreB = this.getPlayerScore(b);
            return scoreB - scoreA;
        });

        // Generate HTML for players list
        const playersHTML = sortedPlayers.map((player, index) => {
            return this.generatePlayerHTML(player, index);
        }).join('');

        // Update the container
        if (this.playersContainer) {
            this.playersContainer.innerHTML = playersHTML;
            console.log(`Updated players list with ${players.length} players`);
        } else {
            console.warn("Players container element not found");
            // Try to find container with alternative selectors
            const alternativeContainer = document.querySelector('#players-list') || 
                                       document.querySelector('.players-list') ||
                                       document.querySelector('[data-players-list]');
            if (alternativeContainer) {
                alternativeContainer.innerHTML = playersHTML;
                this.playersContainer = alternativeContainer;
                console.log("Found alternative players container");
            }
        }

        // Update session info if available
        this.updateSessionInfo(data);
    }

    // Get player score with fallback options
    getPlayerScore(player) {
        return player.session_score || 
               player.score || 
               player.points || 
               player.total_score || 
               0;
    }

    // Get player name with fallback options
    getPlayerName(player) {
        if (player.username && player.username.trim()) {
            return player.username.trim();
        }
        
        const firstName = player.first_name || player.firstName || '';
        const lastName = player.last_name || player.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        
        return fullName || player.name || `Player ${player.user_id || player.id}`;
    }

    // Check if player is current user
    isCurrentUser(player) {
        const currentUserId = this.getCurrentUserId();
        const playerUserId = player.user_id || player.id || player.userId;
        
        return currentUserId && playerUserId && 
               String(currentUserId) === String(playerUserId);
    }

    // Generate HTML for a single player
    generatePlayerHTML(player, index) {
        const isCurrentUser = this.isCurrentUser(player);
        const playerName = this.getPlayerName(player);
        const sessionScore = this.getPlayerScore(player);
        const questionsAnswered = player.total_questions_answered || 
                                 player.questions_answered || 
                                 player.answered_count || 
                                 0;
        
        return `
            <div class="c-player-item ${isCurrentUser ? 'current-user' : ''}" data-user-id="${player.user_id || player.id}">
                <div class="player-rank">#${index + 1}</div>
                <div class="player-info">
                    <div class="player-name">${playerName}</div>
                    <div class="player-stats">
                        <span class="session-score">${sessionScore} pts</span>
                        <span class="questions-answered">${questionsAnswered} answered</span>
                    </div>
                </div>
                ${isCurrentUser ? '<div class="you-indicator">YOU</div>' : ''}
            </div>
        `;
    }

    // Show message when no data is available
    showNoDataMessage() {
        if (this.playersContainer) {
            this.playersContainer.innerHTML = `
                <div class="no-data-message">
                    <p>Unable to load player data</p>
                    <button onclick="window.playersListManager?.requestPlayerData()" class="retry-btn">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    // Show message when no players in session
    showNoPlayersMessage(sessionName = 'Current Session') {
        if (this.playersContainer) {
            this.playersContainer.innerHTML = `
                <div class="no-players-message">
                    <p>No players in ${sessionName}</p>
                    <p class="sub-text">Waiting for players to join...</p>
                </div>
            `;
        }
    }

    // Update session information
    updateSessionInfo(data) {
        const sessionInfoElement = document.querySelector('.session-info') || 
                                 document.querySelector('#session-info') ||
                                 document.querySelector('[data-session-info]');
        
        if (sessionInfoElement && data.session_name) {
            sessionInfoElement.textContent = data.session_name;
        }

        // Update player count if element exists
        const playerCountElement = document.querySelector('.player-count') ||
                                 document.querySelector('#player-count');
        
        if (playerCountElement && data.total_players !== undefined) {
            playerCountElement.textContent = `${data.total_players} player${data.total_players !== 1 ? 's' : ''}`;
        }
    }

    // Update current user reference
    setCurrentUser(user) {
        this.currentUser = user;
        console.log("Current user updated:", user);
        
        // If we're currently running, restart to use new user data
        if (this.isActive) {
            this.requestPlayerData();
        }
    }

    // Check if auto-update is running
    isRunning() {
        return this.isActive && this.updateInterval !== null;
    }

    // Manually refresh data
    refresh() {
        console.log("Manually refreshing player data");
        this.requestPlayerData();
    }

    // Clean up method
    destroy() {
        this.stopAutoUpdate();
        if (this.socket) {
            this.socket.off('all_users_data_updated');
            this.socket.off('error');
        }
        console.log("PlayersListManager destroyed");
    }
}

// Enhanced CSS styles for the players list
const playersListStyles = `
.c-player-item {
    display: flex;
    align-items: center;
    padding: 12px;
    margin-bottom: 8px;
    border-radius: 8px;
    background: #f8f9fa;
    border-left: 4px solid #e9ecef;
    transition: all 0.3s ease;
    position: relative;
}

.c-player-item.current-user {
    background: #e3f2fd;
    border-left-color: #2196f3;
    box-shadow: 0 2px 8px rgba(33, 150, 243, 0.15);
}

.c-player-item:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.player-rank {
    font-weight: bold;
    font-size: 18px;
    color: #6c757d;
    margin-right: 12px;
    min-width: 35px;
    text-align: center;
}

.c-player-item.current-user .player-rank {
    color: #2196f3;
}

.player-info {
    flex: 1;
}

.player-name {
    font-weight: 600;
    color: #495057;
    margin-bottom: 4px;
    font-size: 16px;
}

.c-player-item.current-user .player-name {
    color: #1976d2;
}

.player-stats {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: #6c757d;
}

.session-score {
    font-weight: 600;
    color: #28a745;
    padding: 2px 6px;
    background: rgba(40, 167, 69, 0.1);
    border-radius: 4px;
}

.questions-answered {
    color: #6c757d;
}

.you-indicator {
    background: #2196f3;
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.c-players-container {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    margin-bottom: 20px;
}

.c-players-container h3 {
    margin: 0 0 16px 0;
    color: #495057;
    font-size: 18px;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.no-data-message, .no-players-message {
    text-align: center;
    padding: 40px 20px;
    color: #6c757d;
}

.no-data-message p, .no-players-message p {
    margin: 0 0 10px 0;
    font-size: 16px;
}

.sub-text {
    font-size: 14px !important;
    color: #adb5bd !important;
}

.retry-btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    margin-top: 10px;
}

.retry-btn:hover {
    background: #0056b3;
}

@media (max-width: 768px) {
    .player-stats {
        flex-direction: column;
        gap: 4px;
    }
    
    .c-player-item {
        padding: 10px;
    }
    
    .player-rank {
        font-size: 16px;
        min-width: 30px;
    }
    
    .player-name {
        font-size: 15px;
    }
}

/* Loading animation */
.players-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px;
    color: #6c757d;
}

.loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e9ecef;
    border-top: 2px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 10px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;

// Add styles to document head (only once)
if (!document.querySelector('#players-list-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'players-list-styles';
    styleElement.innerHTML = playersListStyles;
    document.head.appendChild(styleElement);
}

// Initialize function with better error handling
function initializePlayersListManager(socket, currentUser) {
    console.log("Initializing PlayersListManager with:", { 
        socketConnected: socket?.connected, 
        currentUser: currentUser 
    });
    
    if (!socket) {
        console.error("Cannot initialize PlayersListManager: socket is undefined");
        return null;
    }
    
    if (!currentUser) {
        console.error("Cannot initialize PlayersListManager: currentUser is undefined");
        return null;
    }
    
    try {
        const playersManager = new PlayersListManager(socket, currentUser);
        
        // Start auto-updating when initialized
        playersManager.startAutoUpdate();
        
        // Store reference globally so you can control it
        window.playersListManager = playersManager;
        
        console.log("PlayersListManager successfully initialized");
        return playersManager;
    } catch (error) {
        console.error("Error initializing PlayersListManager:", error);
        return null;
    }
}

// Improved event listener with better socket handling
document.addEventListener('userAuthenticated', (event) => {
    console.log("User authenticated event received");
    const user = event.detail.user;
    console.log("User data:", user);
    
    // Function to initialize when socket is ready
    const initializeWhenReady = () => {
        // Try multiple ways to access the socket
        const socket = window.socket || 
                      window.quizSocket || 
                      window.io ||
                      (window.socketInstance && window.socketInstance.socket);
        
        if (socket && (socket.connected || socket.readyState === 'open')) {
            console.log("Socket found and connected:", socket);
            const playersManager = initializePlayersListManager(socket, user);
            if (playersManager) {
                console.log("PlayersListManager successfully initialized");
            }
        } else if (socket) {
            console.log("Socket found but not connected, waiting...");
            // Wait for socket to connect
            socket.on('connect', () => {
                console.log("Socket connected, initializing PlayersListManager");
                const playersManager = initializePlayersListManager(socket, user);
                if (playersManager) {
                    console.log("PlayersListManager successfully initialized after connection");
                }
            });
        } else {
            console.log("Socket not found, retrying in 500ms...");
            setTimeout(initializeWhenReady, 500);
        }
    };
    
    // Start the initialization process
    initializeWhenReady();
});

// Global function to refresh players list (useful for debugging)
window.refreshPlayersList = function() {
    if (window.playersListManager) {
        window.playersListManager.refresh();
    } else {
        console.warn("PlayersListManager not initialized");
    }
};

// Global function to get current players data (useful for debugging)
window.getPlayersListManager = function() {
    return window.playersListManager;
};