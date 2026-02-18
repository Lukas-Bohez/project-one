// quiz-socket-handler.js
class QuizSocketHandler {
    constructor(socket, questionHandler) {
        this.socket = socket;
        this.questionHandler = questionHandler;
        this.initializeListeners();
        this.QuizTimerHandler = new QuizTimerHandler(); // Initialize first!
    }

    initializeListeners() {

        const advertFlood = new CompliantAdSystem()
        // Listen for the B2F_addItem event and automatically activate the flood
        this.socket.on('B2F_addItem', () => {
            console.log('📢📢📢 Initiating the Anti-Adblocker Scream Flood! 📢📢📢');
            advertFlood.activate(15); // Fixed 18-second duration for the scream flood
        });

        // ---- ITEM EFFECT HANDLER ----
        this.socket.on('B2F_itemEffect', (data) => {
            console.log('🎯 Item effect received:', data);
            const effect = data.effect;
            this._showEffectOverlay(effect, data);

            switch (effect) {
                case 'shield':
                    this._applyShieldEffect(data.duration || 30);
                    break;
                case 'doublePoints':
                    this._applyDoublePointsEffect();
                    break;
                case 'timeWarp':
                    this._applyTimeWarpEffect(data.seconds || 10);
                    break;
                case 'lightningBolt':
                    this._applyLightningEffect(data.eliminate || 2);
                    break;
                case 'mysteryBox':
                    this._applyMysteryBoxEffect();
                    break;
                case 'spotlight':
                    this._applySpotlightEffect(data.duration || 2);
                    break;
                case 'earthquake':
                    this._applyEarthquakeEffect(data.duration || 5);
                    break;
            }
        });


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
            this.questionHandler.handlePhaseChange(data);
        });

        // In quiz-socket-handler.js - explanation listener
        this.socket.on('explanation_started', (data) => {
            console.log("✅ Explanation Started:", data);
            if (typeof this.questionHandler.showExplanation === 'function') {
                this.questionHandler.showExplanation(data);
            } else {
                console.error("Explanation handler broken, data:", data);
            }
        });


        // Listen for the end of the entire quiz
        this.socket.on('quiz_finished', (data) => {
            console.log("✅ Quiz Finished:", data);
            this.questionHandler.showQuizEnd(data);
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
            
// In your socket listener (where you receive the data)
// 1. Create a global fallback object
window.globalTimerData = {
  timeRemaining: '0',
  speedMultiplier: null,
  temperature: null,
  illuminance: null,
  totalTime: 0
};

// 2. Socket listener with arrow function
this.socket.on('quiz_timer', (data) => {
  // Update global storage
  Object.assign(window.globalTimerData, data);
  
  // Directly call the display function
    this.QuizTimerHandler.updateTimerDisplay (); // Now safe
});

    this.socket.on('quiz_timer_finished', () => {
        this.questionHandler.handleTimerFinished();
    });

        // ---- QUESTION DATA LISTENERS ----
        
        // Question data
        this.socket.on('questionData', (data) => {
            console.log("✅ Received 'questionData':", data);
            this.questionHandler.loadQuestion(data);
        });

        // New question event
        this.socket.on('new_question', (data) => {
            console.log("✅ Received 'new_question':", data);
            this.questionHandler.loadQuestion(data);
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
            this.questionHandler.showFeedback("Connection error. Retrying...", true);
        });

        // Disconnect handling
        this.socket.on('disconnect', (reason) => {
            console.warn("⚠️ Disconnected:", reason);
            this.questionHandler.showFeedback("Disconnected from server", true);
        });

        // Reconnection
        this.socket.on('reconnect', (attemptNumber) => {
            console.log("✅ Reconnected after", attemptNumber, "attempts");
            this.questionHandler.showFeedback("Reconnected successfully!");
        });

        // Server errors
        this.socket.on('error', (error) => {
            console.error("❌ Server error:", error);
            this.questionHandler.showFeedback(error.message || "Server error occurred", true);
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
            this.questionHandler.showFeedback(`${data.name || data.username} joined the game!`);
        });

        // Player left
        this.socket.on('player_left', (data) => {
            console.log("✅ Player Left:", data);
            this.questionHandler.showFeedback(`${data.name || data.username} left the game`);
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
            this.questionHandler.showFeedback("Quiz is starting!");
        });

        // Quiz paused
        this.socket.on('quiz_paused', (data) => {
            console.log("✅ Quiz Paused:", data);
            this.questionHandler.showFeedback("Quiz paused");
        });

        // Quiz resumed
        this.socket.on('quiz_resumed', (data) => {
            console.log("✅ Quiz Resumed:", data);
            this.questionHandler.showFeedback("Quiz resumed");
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

        this.questionHandler.players = allPlayers;

        if (currentUserId) {
            const currentUserData = allPlayers.find(p => String(p.user_id) === String(currentUserId));
            if (currentUserData) {
                this.questionHandler.currentUser = { ...this.questionHandler.currentUser, ...currentUserData };
                console.log("Updated current user:", this.questionHandler.currentUser);
                
                document.dispatchEvent(new CustomEvent('currentUserUpdated', {
                    detail: this.questionHandler.currentUser
                }));
            } else {
                console.warn(`Current user ${currentUserId} not found in player list`);
                this.questionHandler.currentUser = null;
            }
        }
        
        this.questionHandler.updatePlayersDisplay();
    }

    handleAnswerResponse(responseData) {
        console.log("Processing answer/theme response:", responseData);
        
        if (responseData.success) {
            console.log("Submission successful");
            
            if (responseData.feedback) {
                this.questionHandler.showFeedback(responseData.feedback);
            }
            
            // Check if this was a theme selection
            if (responseData.theme_name) {
                console.log("Theme selected:", responseData.theme_name);
                this.questionHandler.showFeedback(`Theme selected: ${responseData.theme_name}`);
            }
            
            // Check if this was a regular answer
            if (responseData.correct !== undefined) {
                const message = responseData.correct ? "Correct!" : "Incorrect";
                this.questionHandler.showFeedback(message, !responseData.correct);
            }
            
        } else {
            console.error("Submission failed:", responseData.error);
            this.questionHandler.showFeedback(responseData.error, true);
        }
    }

    handlePlayerUpdate(playerData) {
        if (!playerData || !playerData.user_id) return;
        
        const playerIndex = this.questionHandler.players.findIndex(p => p.user_id === playerData.user_id);

        if (playerIndex !== -1) {
            this.questionHandler.players[playerIndex] = { ...this.questionHandler.players[playerIndex], ...playerData };
        } else {
            this.questionHandler.players.push(playerData);
        }

        this.questionHandler.players.sort((a, b) => (b.session_score || 0) - (a.session_score || 0));
        this.questionHandler.updatePlayersDisplay();
    }

    handleQuizResults(data) {
        console.log("Handling quiz results:", data);
        
        if (data.final_scores) {
            this.questionHandler.displayFinalScores(data.final_scores);
        }
        
        if (data.summary) {
            this.questionHandler.showFeedback(data.summary);
        }
    }

    handleQuestionResult(data) {
        console.log("Handling question result:", data);
        
        if (data.correct_answer) {
            this.questionHandler.showFeedback(`Correct answer: ${data.correct_answer}`);
        }
        
        if (data.explanation) {
            this.showExplanation({
                explanation: data.explanation,
                question: data.question || this.questionHandler.currentQuestion
            });
        }
    }

    handleThemeSelectedConfirmation(data) {
        console.log("Theme selection confirmed:", data);
        this.questionHandler.showFeedback(`Theme "${data.theme_name}" selected successfully!`);
    }

    handleThemeDisplay(data) {
        console.log("Theme display phase:", data);
        
        if (data.theme_data) {
            // Send the theme data to questionHandler for display
            this.questionHandler.showThemeDisplay(data.theme_data);
        }
        
        if (data.selected_theme) {
            this.questionHandler.showFeedback(`Selected theme: ${data.selected_theme.name}`);
        }
        
        if (data.message) {
            this.questionHandler.showFeedback(data.message);
        }
    }

    handleGameStateUpdate(data) {
        console.log("Game state update:", data);
        
        if (data.phase) {
            this.questionHandler.handlePhaseChange(data);
        }
        
        if (data.current_question) {
            this.questionHandler.loadQuestion(data.current_question);
        }
        
        if (data.time_remaining !== undefined) {
            this.questionHandler.updateTimer(data.time_remaining);
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

    // ── ITEM EFFECT VISUALS ──

    _showEffectOverlay(effect, data) {
        const EFFECT_META = {
            shield: { icon: '🛡️', label: 'Shield Activated!', color: '#3498db' },
            doublePoints: { icon: '✨', label: 'Double Points!', color: '#f39c12' },
            timeWarp: { icon: '⏰', label: `+${data.seconds || 10}s Time Warp!`, color: '#9b59b6' },
            lightningBolt: { icon: '⚡', label: 'Lightning Bolt!', color: '#f1c40f' },
            mysteryBox: { icon: '🎁', label: 'Mystery Box...', color: '#8e44ad' },
            spotlight: { icon: '💡', label: 'Spotlight!', color: '#e67e22' },
            earthquake: { icon: '🌍', label: 'Earthquake!', color: '#e74c3c' }
        };
        const meta = EFFECT_META[effect] || { icon: '🎯', label: effect, color: '#6c5ce7' };

        const overlay = document.createElement('div');
        overlay.className = 'item-effect-overlay';
        overlay.innerHTML = `
            <div class="item-effect-overlay__icon" style="color:${meta.color}">${meta.icon}</div>
            <div class="item-effect-overlay__label">${meta.label}</div>
        `;
        document.body.appendChild(overlay);

        requestAnimationFrame(() => overlay.classList.add('item-effect-overlay--show'));
        setTimeout(() => {
            overlay.classList.remove('item-effect-overlay--show');
            setTimeout(() => overlay.remove(), 500);
        }, 2500);
    }

    _applyShieldEffect(duration) {
        const quizArea = document.querySelector('.c-quiz-container') || document.querySelector('main');
        if (!quizArea) return;
        quizArea.classList.add('effect-shield');
        setTimeout(() => quizArea.classList.remove('effect-shield'), duration * 1000);
    }

    _applyDoublePointsEffect() {
        const scoreEls = document.querySelectorAll('.c-player-score, .c-score-display, [data-score]');
        scoreEls.forEach(el => {
            el.classList.add('effect-double-points');
            setTimeout(() => el.classList.remove('effect-double-points'), 8000);
        });
    }

    _applyTimeWarpEffect(seconds) {
        const timer = document.querySelector('.c-timer, .quiz-timer, [data-timer]');
        if (timer) {
            timer.classList.add('effect-time-warp');
            setTimeout(() => timer.classList.remove('effect-time-warp'), 3000);
        }
    }

    _applyLightningEffect(eliminate) {
        const answers = document.querySelectorAll('.c-answer-btn, .c-answers-container button');
        let eliminated = 0;
        answers.forEach(btn => {
            if (eliminated >= eliminate) return;
            // Try to detect wrong answers by data attributes or class
            const isCorrect = btn.classList.contains('correct') || btn.dataset.correct === 'true';
            if (!isCorrect && !btn.disabled) {
                btn.classList.add('effect-lightning-eliminate');
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.3';
                eliminated++;
            }
        });
    }

    _applyMysteryBoxEffect() {
        const quizArea = document.querySelector('.c-quiz-container') || document.querySelector('main');
        if (!quizArea) return;
        quizArea.classList.add('effect-mystery-box');
        setTimeout(() => quizArea.classList.remove('effect-mystery-box'), 3000);
    }

    _applySpotlightEffect(duration) {
        const answers = document.querySelectorAll('.c-answer-btn, .c-answers-container button');
        answers.forEach(btn => {
            const isCorrect = btn.classList.contains('correct') || btn.dataset.correct === 'true';
            if (isCorrect) {
                btn.classList.add('effect-spotlight-highlight');
                setTimeout(() => btn.classList.remove('effect-spotlight-highlight'), duration * 1000);
            }
        });
    }

    _applyEarthquakeEffect(duration) {
        document.body.classList.add('effect-earthquake');
        setTimeout(() => document.body.classList.remove('effect-earthquake'), duration * 1000);
    }
}

window.QuizSocketHandler = QuizSocketHandler;