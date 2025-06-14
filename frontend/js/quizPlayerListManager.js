// Updated PlayersListManager with proper socket handling and data processing

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
        
        // Set up interval to request data every 3 seconds (reduced frequency)
        this.updateInterval = setInterval(() => {
            if (this.isActive && this.currentUser?.id) {
                this.requestPlayerData();
            }
        }, 3000);

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

    // Request player data from server
    requestPlayerData() {
        if (!this.socket) {
            console.error("Cannot request player data: socket is undefined");
            return;
        }

        if (!this.currentUser?.id) {
            console.warn("No current user set, cannot request player data");
            return;
        }

        const requestData = {
            user_id: this.currentUser.id  // Using 'id' instead of 'user_id' based on your user object
        };

        console.log("Requesting player data:", requestData);
        this.socket.emit('request_user_data', requestData);
    }

    // Update the players display with received data
    updatePlayersDisplay(data) {
        console.log("Updating players display with data:", data);
        
        if (!data || !Array.isArray(data.players)) {
            console.warn("Invalid player data received:", data);
            return;
        }

        const players = data.players;
        
        // Sort players by session score (highest first)
        const sortedPlayers = players.sort((a, b) => {
            const scoreA = a.session_score || 0;
            const scoreB = b.session_score || 0;
            return scoreB - scoreA;
        });

        // Generate HTML for players list
        const playersHTML = sortedPlayers.map((player, index) => {
            const isCurrentUser = player.user_id === this.currentUser?.id;
            const username = player.username || 
                           `${player.first_name || ''} ${player.last_name || ''}`.trim() || 
                           'Unknown Player';
            const sessionScore = player.session_score || 0;
            const questionsAnswered = player.total_questions_answered || 0;
            
            return `
                <div class="c-player-item ${isCurrentUser ? 'current-user' : ''}">
                    <div class="player-rank">#${index + 1}</div>
                    <div class="player-info">
                        <div class="player-name">${username}</div>
                        <div class="player-stats">
                            <span class="session-score">${sessionScore} pts</span>
                            <span class="questions-answered">${questionsAnswered} answered</span>
                        </div>
                    </div>
                    ${isCurrentUser ? '<div class="you-indicator">YOU</div>' : ''}
                </div>
            `;
        }).join('');

        // Update the container
        if (this.playersContainer) {
            this.playersContainer.innerHTML = playersHTML;
            console.log(`Updated players list with ${players.length} players`);
        } else {
            console.warn("Players container element not found");
        }

        // Update session info if available
        this.updateSessionInfo(data);
    }

    // Update session information
    updateSessionInfo(data) {
        const sessionInfoElement = document.querySelector('.session-info');
        if (sessionInfoElement && data.session_name) {
            sessionInfoElement.textContent = data.session_name;
        }
    }

    // Update current user reference
    setCurrentUser(user) {
        this.currentUser = user;
        console.log("Current user updated:", user);
    }

    // Check if auto-update is running
    isRunning() {
        return this.isActive && this.updateInterval !== null;
    }

    // Clean up method
    destroy() {
        this.stopAutoUpdate();
        if (this.socket) {
            this.socket.off('all_users_data_updated');
            this.socket.off('error');
        }
    }
}

// CSS styles for the players list
const playersListStyles = `
<style>
.c-player-item {
    display: flex;
    align-items: center;
    padding: 10px;
    margin-bottom: 8px;
    border-radius: 8px;
    background: #f8f9fa;
    border-left: 4px solid #e9ecef;
    transition: all 0.3s ease;
}

.c-player-item.current-user {
    background: #e3f2fd;
    border-left-color: #2196f3;
    box-shadow: 0 2px 4px rgba(33, 150, 243, 0.1);
}

.player-rank {
    font-weight: bold;
    font-size: 18px;
    color: #6c757d;
    margin-right: 12px;
    min-width: 30px;
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
}

.c-player-item.current-user .player-name {
    color: #1976d2;
}

.player-stats {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #6c757d;
}

.session-score {
    font-weight: 600;
    color: #28a745;
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
}

.c-players-container {
    background: white;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.c-players-container h3 {
    margin: 0 0 16px 0;
    color: #495057;
    font-size: 18px;
    font-weight: 600;
}

@media (max-width: 768px) {
    .player-stats {
        flex-direction: column;
        gap: 4px;
    }
    
    .c-player-item {
        padding: 8px;
    }
}
</style>
`;

// Add styles to document head (only once)
if (!document.querySelector('#players-list-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'players-list-styles';
    styleElement.innerHTML = playersListStyles.replace('<style>', '').replace('</style>', '');
    document.head.appendChild(styleElement);
}

// Initialize function (not a constructor)
function initializePlayersListManager(socket, currentUser) {
    console.log("Initializing PlayersListManager with:", { socket, currentUser });
    
    if (!socket) {
        console.error("Cannot initialize PlayersListManager: socket is undefined");
        return null;
    }
    
    if (!currentUser) {
        console.error("Cannot initialize PlayersListManager: currentUser is undefined");
        return null;
    }
    
    const playersManager = new PlayersListManager(socket, currentUser);
    
    // Start auto-updating when initialized
    playersManager.startAutoUpdate();
    
    // Store reference globally so you can control it
    window.playersListManager = playersManager;
    
    return playersManager;
}

// Fixed event listener code for your quiz.js
// Replace your current event listener with this:

// IMPORTANT: Make sure you have access to the socket in the scope where you call this
// You'll need to modify this based on how your socket is initialized

// Option 1: If socket is a global variable
document.addEventListener('userAuthenticated', (event) => {
    console.log("user logged in");
    const user = event.detail.user;
    console.log(user);
    
    // Make sure 'socket' is accessible here - you might need to pass it differently
    if (typeof socket !== 'undefined' && socket) {
        console.log("Socket available:", socket);
        const playersManager = initializePlayersListManager(socket, user);
        console.log("PlayersListManager initialized:", playersManager);
    } else {
        console.error("Socket not available in userAuthenticated event");
        // You might need to wait for socket to be ready or access it differently
    }
});

// Option 2: If you need to wait for socket initialization
// You might need something like this instead:
/*
document.addEventListener('userAuthenticated', (event) => {
    console.log("user logged in");
    const user = event.detail.user;
    console.log(user);
    
    // Wait for socket to be ready or get it from your app instance
    const waitForSocket = () => {
        if (window.quizSocket || window.socket) {
            const socket = window.quizSocket || window.socket;
            console.log("Socket found:", socket);
            const playersManager = initializePlayersListManager(socket, user);
            console.log("PlayersListManager initialized:", playersManager);
        } else {
            console.log("Waiting for socket...");
            setTimeout(waitForSocket, 100);
        }
    };
    
    waitForSocket();
});
*/