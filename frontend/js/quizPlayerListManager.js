// Add this to your main quiz initialization code or where you set up the socket connection

class PlayersListManager {
    constructor(socket, currentUser) {
        this.socket = socket;
        this.currentUser = currentUser;
        this.updateInterval = null;
        this.playersContainer = document.getElementById('playersList');
        this.isActive = false;
        
        // Bind the socket listener
        this.setupSocketListener();
    }

    // Set up the socket listener for player data updates
    setupSocketListener() {
        this.socket.on('all_users_data_updated', (data) => {
            this.updatePlayersDisplay(data);
        });
    }

    // Start the auto-update interval
    startAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.isActive = true;
        
        // Request initial data
        this.requestPlayerData();
        
        // Set up interval to request data every second
        this.updateInterval = setInterval(() => {
            if (this.isActive && this.currentUser?.user_id) {
                this.requestPlayerData();
            }
        }, 1000);

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
        if (!this.currentUser?.user_id) {
            console.warn("No current user set, cannot request player data");
            return;
        }

        const requestData = {
            user_id: this.currentUser.user_id
        };

        console.log("Requesting player data:", requestData);
        this.socket.emit('request_user_data', requestData);
    }

    // Update the players display with received data
    updatePlayersDisplay(data) {
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
            const isCurrentUser = player.user_id === this.currentUser?.user_id;
            const username = player.username || `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown Player';
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
        }

        // Update session info if available
        this.updateSessionInfo(data);

        console.log(`Updated players list with ${players.length} players`);
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
    }

    // Check if auto-update is running
    isRunning() {
        return this.isActive && this.updateInterval !== null;
    }
}

// CSS styles for the players list (add this to your CSS file)
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

// Add styles to document head
document.head.insertAdjacentHTML('beforeend', playersListStyles);

// Usage example - Initialize the players list manager
// Add this where you initialize your quiz components

function initializePlayersListManager(socket, currentUser) {
    const playersManager = new PlayersListManager(socket, currentUser);
    
    // Start auto-updating when quiz starts
    playersManager.startAutoUpdate();
    
    // Store reference globally so you can control it
    window.playersListManager = playersManager;
    
    return playersManager;
}

// Example of how to integrate with your existing code:
// In your quiz initialization:
/*
After you have socket and currentUser set up:
const playersManager = initializePlayersListManager(socket, currentUser);

When quiz ends or user leaves, stop the updates:
playersManager.stopAutoUpdate();

If user data changes, update the reference:
playersManager.setCurrentUser(newUserData);
*/