// QuizTimerHandler class removed to avoid conflict with object in quizlogic.js
// The object version in quizlogic.js is used instead

// Entire class commented out to prevent duplicate identifier error

/*
class QuizTimerHandler {
    constructor() {
        this.maxTime = 60; // Default will be overridden by server
        this.currentTime = 0;
        this.speedMultiplier = 1.0;
        this.temperature = 0;
        this.illuminance = 0;
        this.socket = window.sharedSocket;
        this.isTimerRunning = false;
        
        // Bind methods to ensure proper 'this' context
        this.initializeTimer = this.initializeTimer.bind(this);
        this.createStatsDisplay = this.createStatsDisplay.bind(this);
        this.updateStatsDisplay = this.updateStatsDisplay.bind(this);
        this.updateTimer = this.updateTimer.bind(this);
        this.updateTimeDisplay = this.updateTimeDisplay.bind(this);
        this.updateVisualBar = this.updateVisualBar.bind(this);
        this.handleTimerFinished = this.handleTimerFinished.bind(this);
        this.handleTimerData = this.handleTimerData.bind(this);
        
        // Initialize
        this.initializeTimer();
        this.createStatsDisplay();
        this.bindSocketEvents();
    }

    initializeTimer() {
        // Add CSS animations if not already added
        if (!document.getElementById('timerAnimations')) {
            const style = document.createElement('style');
            style.id = 'timerAnimations';
            style.textContent = `
                @keyframes timer-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(1.05); }
                }
                @keyframes timer-final-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.1); }
                }
                .c-timer-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 12px;
                    background: var(--light-color, #f4f8fc);
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    min-width: 120px;
                }
                .c-servo-visual {
                    width: 100px;
                    height: 8px;
                    background: var(--light-color, #f4f8fc);
                    border-radius: 20px;
                    overflow: hidden;
                    position: relative;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                }
                .c-servo-bar {
                    height: 100%;
                    width: 100%;
                    background: linear-gradient(to right, #00ff00, #88ff00);
                    border-radius: 20px;
                    transition: width 0.5s ease-out, background 0.3s ease;
                }
                .c-time-remaining {
                    font-size: 16px;
                    font-weight: bold;
                    color: #333;
                    min-width: 30px;
                    text-align: center;
                }
                .c-quiz-controls {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-top: 8px;
                }
                .c-stats-display {
                    display: flex;
                    gap: 12px;
                    justify-content: space-between;
                    flex-wrap: wrap;
                }
                .c-timer-stats {
                    display: flex;
                    gap: 12px;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    margin-top: 8px;
                }
                .c-stat-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 8px 12px;
                    background: rgba(255, 255, 255, 0.8);
                    border-radius: 8px;
                    min-width: 60px;
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                .c-stat-item span:first-child {
                    font-size: 12px;
                    font-weight: bold;
                    color: #666;
                    margin-bottom: 4px;
                }
                .c-stat-item span:last-child {
                    font-size: 14px;
                    font-weight: bold;
                }
                .c-speed-display {
                    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                }
                .c-temp-display {
                    background: linear-gradient(135deg, #fff1eb 0%, #ace0f9 100%);
                }
                .c-light-display {
                    background: linear-gradient(135deg, #ffffb5 0%, #247ba0 100%);
                }
                .c-speed-value {
                    color: #4a6baf;
                }
                .c-temp-value {
                    color: #e67e22;
                }
                .c-light-value {
                    color: #f1c40f;
                }
            `;
            document.head.appendChild(style);
        }
    }

    createStatsDisplay() {
        // Check if timer stats display already exists
        if (document.querySelector('.c-timer-stats')) {
            return;
        }

        // Create the timer stats display structure
        const timerStatsContainer = document.createElement('div');
        timerStatsContainer.className = 'c-timer-stats';
        timerStatsContainer.innerHTML = `
            <div class="c-stat-item c-speed-display">
                <span>Speed</span>
                <span class="c-speed-value" id="speedValue">1.0x</span>
            </div>
            <div class="c-stat-item c-temp-display">
                <span>Temp</span>
                <span class="c-temp-value" id="tempValue">0°</span>
            </div>
            <div class="c-stat-item c-light-display">
                <span>Light</span>
                <span class="c-light-value" id="lightValue">0</span>
            </div>
        `;

        // Find the existing stats display and add our timer stats after it
        const existingStatsDisplay = document.querySelector('.c-stats-display');
        const quizControls = document.querySelector('.c-quiz-controls');
        
        if (existingStatsDisplay && quizControls) {
            // Insert after the existing stats display
            existingStatsDisplay.insertAdjacentElement('afterend', timerStatsContainer);
        } else if (quizControls) {
            // If no existing stats display, append to quiz controls
            quizControls.appendChild(timerStatsContainer);
        } else {
            // Create a basic container if none exists
            const container = document.createElement('div');
            container.className = 'c-quiz-controls';
            container.appendChild(timerStatsContainer);
            document.body.appendChild(container);
        }
    }

    bindSocketEvents() {
        if (!this.socket) {
            console.error("Socket not available for timer");
            return;
        }

        // Remove existing listeners to prevent duplicates
        this.socket.off('quiz_timer');
        this.socket.off('quiz_timer_finished');

        // Listen for timer updates
        this.socket.on('quiz_timer', this.handleTimerData);

        // Listen for timer completion
        this.socket.on('quiz_timer_finished', this.handleTimerFinished);
    }

    handleTimerData(data) {
        try {
            // Map the incoming data to our expected format with better error handling
            const timerData = {
                total_time: typeof data.totalTime === 'number' ? data.totalTime : this.maxTime,
                speed_multiplier: typeof data.speedMultiplier === 'number' ? data.speedMultiplier : 1.0,
                temperature: typeof data.temperature === 'number' ? data.temperature : 0,
                illuminance: typeof data.illuminance === 'number' ? data.illuminance : 0,
                time_remaining: Math.max(0, parseInt(data.timeRemaining) || 0)
            };

            this.maxTime = timerData.total_time;
            this.speedMultiplier = timerData.speed_multiplier;
            this.temperature = timerData.temperature;
            this.illuminance = timerData.illuminance;
            this.isTimerRunning = timerData.time_remaining > 0;
            
            this.updateTimer(timerData.time_remaining);
            this.updateStatsDisplay();
        } catch (error) {
            console.error('Error handling timer data:', error);
        }
    }

    updateTimer(timeRemaining) {
        this.currentTime = Math.max(0, timeRemaining);
        this.updateTimeDisplay(this.currentTime);
        this.updateVisualBar(this.currentTime);
    }

    updateTimeDisplay(timeRemaining) {
        const timeElement = document.getElementById('timeRemaining');
        if (timeElement) {
            timeElement.textContent = timeRemaining;
            
            // Color based on time remaining
            if (timeRemaining <= 0) {
                timeElement.style.color = '#ff0000';
            } else if (timeRemaining <= 10) {
                timeElement.style.color = '#ff0000';
            } else if (timeRemaining <= 30) {
                timeElement.style.color = '#ff9900';
            } else {
                timeElement.style.color = '#333';
            }
        }
    }

    updateVisualBar(timeRemaining) {
        let servoElement = document.querySelector('.c-servo-bar');
        
        if (!servoElement) {
            // Create the bar if it doesn't exist
            const servoContainer = document.getElementById('servoVisual');
            if (servoContainer) {
                servoElement = document.createElement('div');
                servoElement.className = 'c-servo-bar';
                servoContainer.appendChild(servoElement);
            } else {
                // Create the entire servo visual structure if it doesn't exist
                const visualContainer = document.createElement('div');
                visualContainer.className = 'c-servo-visual';
                visualContainer.id = 'servoVisual';
                
                servoElement = document.createElement('div');
                servoElement.className = 'c-servo-bar';
                visualContainer.appendChild(servoElement);
                
                const timerContainer = document.querySelector('.c-timer-container');
                if (timerContainer) {
                    timerContainer.insertBefore(visualContainer, timerContainer.firstChild);
                }
            }
        }

        if (!servoElement) return;

        // Calculate progress percentage
        const percentage = this.maxTime > 0 ? Math.max(0, Math.min(100, (timeRemaining / this.maxTime) * 100)) : 0;
        
        // Color based on time remaining
        let color1, color2;
        if (timeRemaining <= 0) {
            color1 = '#ff0000';
            color2 = '#ff0000';
        } else if (timeRemaining <= 10) {
            color1 = '#ff0000';
            color2 = '#ff4444';
        } else if (timeRemaining <= 30) {
            color1 = '#ff6600';
            color2 = '#ffaa00';
        } else {
            color1 = '#00ff00';
            color2 = '#88ff00';
        }

        // Update bar
        servoElement.style.width = `${percentage}%`;
        servoElement.style.background = `linear-gradient(to right, ${color1}, ${color2})`;
        
        // Add pulse effect when time is low
        if (timeRemaining <= 10 && timeRemaining > 0) {
            servoElement.style.animation = 'timer-pulse 0.8s infinite';
        } else {
            servoElement.style.animation = '';
        }
    }

    updateStatsDisplay() {
        // Update speed multiplier
        const speedElement = document.getElementById('speedValue');
        if (speedElement) {
            speedElement.textContent = `${this.speedMultiplier.toFixed(1)}x`;
        }

        // Update temperature
        const tempElement = document.getElementById('tempValue');
        if (tempElement) {
            tempElement.textContent = `${Math.round(this.temperature)}°`;
        }

        // Update illuminance
        const lightElement = document.getElementById('lightValue');
        if (lightElement) {
            lightElement.textContent = Math.round(this.illuminance).toString();
        }
    }

    handleTimerFinished() {
        console.log("Timer finished!");
        this.isTimerRunning = false;
        
        const servoElement = document.querySelector('.c-servo-bar');
        const timeElement = document.getElementById('timeRemaining');
        
        if (servoElement) {
            servoElement.style.width = '0%';
            servoElement.style.background = '#ff0000';
            servoElement.style.animation = 'timer-final-pulse 0.5s 3';
        }

        if (timeElement) {
            timeElement.textContent = '0';
            timeElement.style.color = '#ff0000';
        }
       
        // Dispatch custom event
        try {
            document.dispatchEvent(new CustomEvent('quizTimerFinished', {
                detail: {
                    totalTime: this.maxTime,
                    speedMultiplier: this.speedMultiplier,
                    temperature: this.temperature,
                    illuminance: this.illuminance
                }
            }));
        } catch (error) {
            console.error('Error dispatching timer finished event:', error);
        }
        
        this.showTimerFinishedFeedback();
    }

    showTimerFinishedFeedback() {
        const timeElement = document.getElementById('timeRemaining');
        if (timeElement) {
            timeElement.style.textShadow = '0 0 20px #ff0000, 0 0 40px #ff0000';
            setTimeout(() => {
                if (timeElement) {
                    timeElement.style.textShadow = '';
                }
            }, 3000);
        }
        
        // Flash all stats for visual feedback
        const stats = document.querySelectorAll('.c-stat-item');
        stats.forEach(stat => {
            stat.style.transform = 'scale(1.05)';
            stat.style.boxShadow = '0 0 15px rgba(255, 0, 0, 0.3)';
            setTimeout(() => {
                stat.style.transform = '';
                stat.style.boxShadow = '';
            }, 1000);
        });
    }

    resetTimer() {
        this.currentTime = this.maxTime;
        this.speedMultiplier = 1.0;
        this.temperature = 0;
        this.illuminance = 0;
        this.isTimerRunning = false;
        
        this.updateTimer(this.maxTime);
        this.updateStatsDisplay();
        
        // Reset animations
        const servoElement = document.querySelector('.c-servo-bar');
        if (servoElement) {
            servoElement.style.animation = '';
        }

        // Reset text shadow
        const timeElement = document.getElementById('timeRemaining');
        if (timeElement) {
            timeElement.style.textShadow = '';
        }
    }

    hideTimer() {
        const timerContainer = document.querySelector('.c-timer-container');
        const quizControls = document.querySelector('.c-quiz-controls');
        if (timerContainer) timerContainer.style.display = 'none';
        if (quizControls) quizControls.style.display = 'none';
    }

    showTimer() {
        const timerContainer = document.querySelector('.c-timer-container');
        const quizControls = document.querySelector('.c-quiz-controls');
        if (timerContainer) timerContainer.style.display = 'flex';
        if (quizControls) quizControls.style.display = 'flex';
    }

    // Cleanup method to properly remove event listeners
    destroy() {
        if (this.socket) {
            this.socket.off('quiz_timer', this.handleTimerData);
            this.socket.off('quiz_timer_finished', this.handleTimerFinished);
        }
    }

    // Getter methods for accessing current state
    getCurrentTime() {
        return this.currentTime;
    }

    getMaxTime() {
        return this.maxTime;
    }

    isRunning() {
        return this.isTimerRunning;
    }
}

// Ensure global availability
window.QuizTimerHandler = QuizTimerHandler;
*/