// quiz-player-handler.js
class QuizPlayerHandler {
    constructor(quizLogic) {
        this.quizLogic = quizLogic;
    }

    updatePlayersDisplay() {
        const playerListContainer = document.getElementById('playersList');
        
        if (!playerListContainer) {
            console.error("Player list container 'playersList' not found");
            return;
        }
        
        console.log("Updating players display with", this.quizLogic.players.length, "players");
        playerListContainer.innerHTML = '';

        this.quizLogic.players.forEach(player => {
            const playerElement = this.createPlayerElement(player);
            playerListContainer.appendChild(playerElement);
        });
    }

    createPlayerElement(player) {
        const playerElement = document.createElement('div');
        playerElement.className = 'c-player-item';

        // Highlight current user
        if (this.quizLogic.currentUser && player.user_id === this.quizLogic.currentUser.user_id) {
            playerElement.classList.add('is-current-user');
        }
        
        playerElement.innerHTML = `
            <span class="c-player-name">${player.username || 'Unknown Player'}</span>
            <span class="c-player-score">${player.session_score || 0} pts</span>
        `;
        
        return playerElement;
    }

    requestAllUsersData(socket) {
        if (!socket) {
            console.error("Socket not available for requesting user data");
            return;
        }
        
        const currentUserId = localStorage.getItem('user_user_id');
        if (!currentUserId) {
            console.error("No user ID available for data request");
            return;
        }
        
        console.log("Requesting all user data for user:", currentUserId);
        socket.emit('request_user_data', { 
            user_id: parseInt(currentUserId, 10) 
        });
    }

    updatePlayerListAndDisplay(playersData) {
        // Legacy method for compatibility
        this.quizLogic.players = playersData;
        console.log('Updated player list (legacy method):', this.quizLogic.players);
        this.updatePlayersDisplay();
    }

    addPlayerToList(player) {
        if (!player || !player.user_id) {
            console.warn("Invalid player data:", player);
            return;
        }

        const existingIndex = this.quizLogic.players.findIndex(p => p.user_id === player.user_id);
        
        if (existingIndex !== -1) {
            // Update existing player
            this.quizLogic.players[existingIndex] = { ...this.quizLogic.players[existingIndex], ...player };
        } else {
            // Add new player
            this.quizLogic.players.push(player);
        }

        // Sort by score
        this.quizLogic.players.sort((a, b) => (b.session_score || 0) - (a.session_score || 0));
        
        this.updatePlayersDisplay();
    }

    clearPlayersList() {
        this.quizLogic.players = [];
        this.updatePlayersDisplay();
    }

    getPlayerById(userId) {
        return this.quizLogic.players.find(p => p.user_id === userId);
    }

    getPlayerCount() {
        return this.quizLogic.players.length;
    }

    getCurrentUserRank() {
        if (!this.quizLogic.currentUser) return -1;
        
        const sortedPlayers = [...this.quizLogic.players].sort((a, b) => (b.session_score || 0) - (a.session_score || 0));
        return sortedPlayers.findIndex(p => p.user_id === this.quizLogic.currentUser.user_id) + 1;
    }
}

window.QuizPlayerHandler = QuizPlayerHandler;