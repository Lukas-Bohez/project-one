// quiz-socket-handler.js
class QuizSocketHandler {
    constructor(socket, quizLogic) {
        this.socket = socket;
        this.quizLogic = quizLogic;
        this.initializeListeners();
    }

    initializeListeners() {
        if (!this.socket || this.socket._quizLogicListenersInitialized) {
            return;
        }
        console.log("Initializing all socket listeners...");

        // Player/User data updates
        this.socket.on('all_users_data_updated', (data) => this.handleAllUsersDataUpdate(data));

        // General submission responses
        this.socket.on('answer_response', (data) => this.handleAnswerResponse(data));

        // Vote count updates
        this.socket.on('theme_votes_update', (data) => {
            console.log("✅ Received 'theme_votes_update':", data);
            // Dispatch event for vote count updates
            document.dispatchEvent(new CustomEvent('votesUpdated', { detail: data.votes }));
        });

        // ---- PHASE AND STATE LISTENERS ----
        
        // Listen for the start of any major phase
        this.socket.on('phase_started', (data) => {
            console.log(`✅ Phase Started: ${data.phase}`, data);
            this.quizLogic.handlePhaseChange(data);
        });

        // In quiz-socket-handler.js - explanation listener
        this.socket.on('explanation_started', (data) => {
            console.log("✅ Explanation Started:", data);
            if (typeof this.quizLogic.showExplanation === 'function') {
                this.quizLogic.showExplanation(data);
            } else {
                console.error("Explanation handler broken, data:", data);
            }
        });


        // Listen for the end of the entire quiz
        this.socket.on('quiz_finished', (data) => {
            console.log("✅ Quiz Finished:", data);
            this.quizLogic.showQuizEnd(data);
        });

        // Listen for quiz results
        this.socket.on('quiz_results', (data) => {
            console.log("✅ Quiz Results:", data);
            this.handleQuizResults(data);
        });

        // Listen for individual question results
        this.socket.on('question_result', (data) => {
            console.log("✅ Question Result:", data);
            this.handleQuestionResult(data);
        });

        // ---- TIMER LISTENERS ----
        
        // Timer events
        this.socket.on('quiz_timer', (data) => {
            this.quizLogic.updateTimer(data.time_remaining);
        });

        this.socket.on('quiz_timer_finished', () => {
            this.quizLogic.handleTimerFinished();
        });

        // ---- QUESTION DATA LISTENERS ----
        
        // Question data
        this.socket.on('questionData', (data) => {
            console.log("✅ Received 'questionData':", data);
            this.quizLogic.loadQuestion(data);
        });

        // New question event
        this.socket.on('new_question', (data) => {
            console.log("✅ Received 'new_question':", data);
            this.quizLogic.loadQuestion(data);
        });

        // ---- THEME SELECTION LISTENERS ----

        // Theme selection confirmation
        this.socket.on('theme_selected_confirmation', (data) => {
            console.log("✅ Theme Selected Confirmation:", data);
            this.handleThemeSelectedConfirmation(data);
        });

        // Theme display phase
        this.socket.on('theme_display', (data) => {
            console.log("✅ Theme Display:", data);
            this.handleThemeDisplay(data);
        });

        // ---- ERROR HANDLING ----

        // Connection errors
        this.socket.on('connect_error', (error) => {
            console.error("❌ Connection error:", error);
            this.quizLogic.showFeedback("Connection error. Retrying...", true);
        });

        // Disconnect handling
        this.socket.on('disconnect', (reason) => {
            console.warn("⚠️ Disconnected:", reason);
            this.quizLogic.showFeedback("Disconnected from server", true);
        });

        // Reconnection
        this.socket.on('reconnect', (attemptNumber) => {
            console.log("✅ Reconnected after", attemptNumber, "attempts");
            this.quizLogic.showFeedback("Reconnected successfully!");
        });

        // Server errors
        this.socket.on('error', (error) => {
            console.error("❌ Server error:", error);
            this.quizLogic.showFeedback(error.message || "Server error occurred", true);
        });

        // ---- PLAYER UPDATES ----

        // Individual player updates
        this.socket.on('player_updated', (data) => {
            console.log("✅ Player Updated:", data);
            this.handlePlayerUpdate(data);
        });

        // Player joined
        this.socket.on('player_joined', (data) => {
            console.log("✅ Player Joined:", data);
            this.quizLogic.showFeedback(`${data.name || data.username} joined the game!`);
        });

        // Player left
        this.socket.on('player_left', (data) => {
            console.log("✅ Player Left:", data);
            this.quizLogic.showFeedback(`${data.name || data.username} left the game`);
        });

        // ---- GAME STATE LISTENERS ----

        // Game state updates
        this.socket.on('game_state_update', (data) => {
            console.log("✅ Game State Update:", data);
            this.handleGameStateUpdate(data);
        });

        // Quiz started
        this.socket.on('quiz_started', (data) => {
            console.log("✅ Quiz Started:", data);
            this.quizLogic.showFeedback("Quiz is starting!");
        });

        // Quiz paused
        this.socket.on('quiz_paused', (data) => {
            console.log("✅ Quiz Paused:", data);
            this.quizLogic.showFeedback("Quiz paused");
        });

        // Quiz resumed
        this.socket.on('quiz_resumed', (data) => {
            console.log("✅ Quiz Resumed:", data);
            this.quizLogic.showFeedback("Quiz resumed");
        });

        this.socket._quizLogicListenersInitialized = true;
        console.log("Socket listeners initialized successfully.");
    }

    handleAllUsersDataUpdate(data) {
        if (!data || !Array.isArray(data.players)) {
            console.warn("Invalid player data format:", data);
            return;
        }

        const allPlayers = data.players;
        const currentUserId = localStorage.getItem('user_user_id');

        this.quizLogic.players = allPlayers;

        if (currentUserId) {
            const currentUserData = allPlayers.find(p => String(p.user_id) === String(currentUserId));
            if (currentUserData) {
                this.quizLogic.currentUser = { ...this.quizLogic.currentUser, ...currentUserData };
                console.log("Updated current user:", this.quizLogic.currentUser);
                
                document.dispatchEvent(new CustomEvent('currentUserUpdated', {
                    detail: this.quizLogic.currentUser
                }));
            } else {
                console.warn(`Current user ${currentUserId} not found in player list`);
                this.quizLogic.currentUser = null;
            }
        }
        
        this.quizLogic.updatePlayersDisplay();
    }

    handleAnswerResponse(responseData) {
        console.log("Processing answer/theme response:", responseData);
        
        if (responseData.success) {
            console.log("Submission successful");
            
            if (responseData.feedback) {
                this.quizLogic.showFeedback(responseData.feedback);
            }
            
            // Check if this was a theme selection
            if (responseData.theme_name) {
                console.log("Theme selected:", responseData.theme_name);
                this.quizLogic.showFeedback(`Theme selected: ${responseData.theme_name}`);
            }
            
            // Check if this was a regular answer
            if (responseData.correct !== undefined) {
                const message = responseData.correct ? "Correct!" : "Incorrect";
                this.quizLogic.showFeedback(message, !responseData.correct);
            }
            
        } else {
            console.error("Submission failed:", responseData.error);
            this.quizLogic.showFeedback(responseData.error, true);
        }
    }

    handlePlayerUpdate(playerData) {
        if (!playerData || !playerData.user_id) return;
        
        const playerIndex = this.quizLogic.players.findIndex(p => p.user_id === playerData.user_id);

        if (playerIndex !== -1) {
            this.quizLogic.players[playerIndex] = { ...this.quizLogic.players[playerIndex], ...playerData };
        } else {
            this.quizLogic.players.push(playerData);
        }

        this.quizLogic.players.sort((a, b) => (b.session_score || 0) - (a.session_score || 0));
        this.quizLogic.updatePlayersDisplay();
    }

    handleQuizResults(data) {
        console.log("Handling quiz results:", data);
        
        if (data.final_scores) {
            this.quizLogic.displayFinalScores(data.final_scores);
        }
        
        if (data.summary) {
            this.quizLogic.showFeedback(data.summary);
        }
    }

    handleQuestionResult(data) {
        console.log("Handling question result:", data);
        
        if (data.correct_answer) {
            this.quizLogic.showFeedback(`Correct answer: ${data.correct_answer}`);
        }
        
        if (data.explanation) {
            this.showExplanation({
                explanation: data.explanation,
                question: data.question || this.quizLogic.currentQuestion
            });
        }
    }

    handleThemeSelectedConfirmation(data) {
        console.log("Theme selection confirmed:", data);
        this.quizLogic.showFeedback(`Theme "${data.theme_name}" selected successfully!`);
    }

    handleThemeDisplay(data) {
        console.log("Theme display phase:", data);
        
        if (data.theme_data) {
            // Send the theme data to quizLogic for display
            this.quizLogic.showThemeDisplay(data.theme_data);
        }
        
        if (data.selected_theme) {
            this.quizLogic.showFeedback(`Selected theme: ${data.selected_theme.name}`);
        }
        
        if (data.message) {
            this.quizLogic.showFeedback(data.message);
        }
    }

    handleGameStateUpdate(data) {
        console.log("Game state update:", data);
        
        if (data.phase) {
            this.quizLogic.handlePhaseChange(data);
        }
        
        if (data.current_question) {
            this.quizLogic.loadQuestion(data.current_question);
        }
        
        if (data.time_remaining !== undefined) {
            this.quizLogic.updateTimer(data.time_remaining);
        }
    }

    // Method to emit events to the server
    emitThemeSelection(themeData) {
        console.log("Emitting theme selection:", themeData);
        this.socket.emit('theme_selected', themeData);
    }

    emitAnswer(answerData) {
        console.log("Emitting answer:", answerData);
        this.socket.emit('submit_answer', answerData);
    }

    emitJoinQuiz(userData) {
        console.log("Emitting join quiz:", userData);
        this.socket.emit('join_quiz', userData);
    }

    emitLeaveQuiz(userData) {
        console.log("Emitting leave quiz:", userData);
        this.socket.emit('leave_quiz', userData);
    }

    // Method to clean up listeners
    cleanup() {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket._quizLogicListenersInitialized = false;
            console.log("Socket listeners cleaned up");
        }
    }

    // Method to check connection status
    isConnected() {
        return this.socket && this.socket.connected;
    }

    // Method to manually reconnect
    reconnect() {
        if (this.socket) {
            this.socket.connect();
        }
    }
}

window.QuizSocketHandler = QuizSocketHandler;