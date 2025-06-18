// quiz-timer-handler.js
class QuizTimerHandler {
    constructor() {
        this.maxTime = 60; // Default will be overridden by server
        this.currentTime = 0;
        this.speedMultiplier = 1.0;
        this.temperature = 0;
        this.illuminance = 0;
        this.socket = window.sharedSocket;
        this.bindSocketEvents();
        this.initializeTimer();
        this.createStatsDisplay();
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
        const quizControls = document.querySelector('.c-quiz-controls') || document.createElement('div');
        quizControls.className = 'c-quiz-controls';
        
        const statsDisplay = document.createElement('div');
        statsDisplay.className = 'c-stats-display';
        
        // Speed Multiplier Display
        statsDisplay.innerHTML = `
            <div class="c-stat-item c-speed-display">
                <span>SPEED</span>
                <span class="c-speed-value js-speed">1.0x</span>
            </div>
            <div class="c-stat-item c-temp-display">
                <span>TEMP</span>
                <span class="c-temp-value js-temp">0°C</span>
            </div>
            <div class="c-stat-item c-light-display">
                <span>LIGHT</span>
                <span class="c-light-value js-light">0 lx</span>
            </div>
        `;
        
        // Only add if not already present
        if (!document.querySelector('.c-quiz-controls')) {
            quizControls.appendChild(statsDisplay);
            const timerContainer = document.querySelector('.c-timer-container');
            if (timerContainer) {
                timerContainer.parentNode.insertBefore(quizControls, timerContainer.nextSibling);
            }
        }
    }

    bindSocketEvents() {
        if (!this.socket) {
            console.error("Socket not available for timer");
            return;
        }

        // Listen for timer updates
        this.socket.on('quiz_timer', (data) => {
            this.maxTime = data.total_time || this.maxTime;
            this.speedMultiplier = data.speed_multiplier || 1.0;
            this.temperature = data.temperature || 0;
            this.illuminance = data.illuminance || 0;
            
            this.updateTimer(data.time_remaining);
            this.updateStatsDisplay();
        });

        // Listen for timer completion
        this.socket.on('quiz_timer_finished', () => {
            this.handleTimerFinished();
        });
    }

    updateStatsDisplay() {
        // Update speed multiplier
        const speedElement = document.querySelector('.js-speed');
        if (speedElement) {
            speedElement.textContent = `${this.speedMultiplier.toFixed(1)}x`;
            
            // Add visual feedback for speed changes
            if (this.speedMultiplier > 1.0) {
                speedElement.style.transform = 'scale(1.1)';
                speedElement.style.color = '#e74c3c';
                setTimeout(() => {
                    speedElement.style.transform = 'scale(1)';
                    speedElement.style.color = '';
                }, 300);
            }
        }
        
        // Update temperature
        const tempElement = document.querySelector('.js-temp');
        if (tempElement) {
            tempElement.textContent = `${Math.round(this.temperature)}°C`;
            
            // Color based on temperature
            if (this.temperature > 30) {
                tempElement.style.color = '#e74c3c';
            } else if (this.temperature < 10) {
                tempElement.style.color = '#3498db';
            } else {
                tempElement.style.color = '#e67e22';
            }
        }
        
        // Update illuminance
        const lightElement = document.querySelector('.js-light');
        if (lightElement) {
            lightElement.textContent = `${Math.round(this.illuminance)} lx`;
            
            // Visual feedback for light changes
            if (this.illuminance > 500) {
                lightElement.style.color = '#f39c12';
                lightElement.style.textShadow = '0 0 5px rgba(243, 156, 18, 0.5)';
            } else {
                lightElement.style.textShadow = 'none';
            }
        }
    }

updateTimer(timeRemaining, speedMultiplier, temperature, illuminance, totalTime) {
    console.log("Updating timer with full data:", { 
        timeRemaining, 
        speedMultiplier, 
        temperature, 
        illuminance,
        totalTime
    });
    
    // Update all properties
    if (totalTime !== undefined) this.maxTime = totalTime;
    if (speedMultiplier !== undefined) this.speedMultiplier = speedMultiplier;
    if (temperature !== undefined) this.temperature = temperature;
    if (illuminance !== undefined) this.illuminance = illuminance;
    
    this.currentTime = timeRemaining;
    
    this.updateTimeDisplay(timeRemaining);
    this.updateVisualBar(timeRemaining);
    this.updateStatsDisplay();
}

    updateTimeDisplay(timeRemaining) {
        const timeElement = document.getElementById('timeRemaining');
        if (timeElement) {
            timeElement.textContent = timeRemaining;
            
            // Color text based on time remaining
            if (timeRemaining <= 10) {
                timeElement.style.color = '#ff4444';
            } else if (timeRemaining <= 30) {
                timeElement.style.color = '#ffaa00';
            } else {
                timeElement.style.color = '#00ff22';
            }
        }
    }

    updateVisualBar(timeRemaining) {
        const servoElement = document.querySelector('.c-servo-bar');
        if (!servoElement) {
            // Create the bar if it doesn't exist
            const servoContainer = document.getElementById('servoVisual');
            if (servoContainer) {
                servoContainer.innerHTML = '<div class="c-servo-bar"></div>';
            }
            return;
        }

        // Calculate progress percentage
        const percentage = Math.max(0, (timeRemaining / this.maxTime) * 100);
        
        // Color based on time remaining
        let color1, color2;
        if (timeRemaining <= 10) {
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

    handleTimerFinished() {
        console.log("Timer finished!");
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
       
        document.dispatchEvent(new CustomEvent('quizTimerFinished'));
        this.showTimerFinishedFeedback();
    }

    showTimerFinishedFeedback() {
        const timeElement = document.getElementById('timeRemaining');
        if (timeElement) {
            timeElement.style.textShadow = '0 0 20px #ff0000, 0 0 40px #ff0000';
            setTimeout(() => {
                timeElement.style.textShadow = '';
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
        
        this.updateTimer(this.maxTime);
        this.updateStatsDisplay();
        
        // Reset animations
        const servoElement = document.querySelector('.c-servo-bar');
        if (servoElement) {
            servoElement.style.animation = '';
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
}

window.QuizTimerHandler = QuizTimerHandler;