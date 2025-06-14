// quiz-timer-handler.js
class QuizTimerHandler {
    constructor() {
        this.maxTime = 60; // Default will be overridden by server
        this.currentTime = 0;
        this.socket = window.sharedSocket;
        this.bindSocketEvents();
        this.initializeTimer();
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
            `;
            document.head.appendChild(style);
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
            this.updateTimer(data.time_remaining);
        });

        // Listen for timer completion
        this.socket.on('quiz_timer_finished', () => {
            this.handleTimerFinished();
        });
    }

    updateTimer(timeRemaining) {
        console.log("Updating timer:", timeRemaining);
        this.currentTime = timeRemaining;
        
        this.updateTimeDisplay(timeRemaining);
        this.updateVisualBar(timeRemaining);
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
    }

    resetTimer() {
        this.currentTime = this.maxTime;
        this.updateTimer(this.maxTime);
        
        // Reset animations
        const servoElement = document.querySelector('.c-servo-bar');
        if (servoElement) {
            servoElement.style.animation = '';
        }
    }

    hideTimer() {
        const timerContainer = document.querySelector('.c-timer-container');
        if (timerContainer) {
            timerContainer.style.display = 'none';
        }
    }

    showTimer() {
        const timerContainer = document.querySelector('.c-timer-container');
        if (timerContainer) {
            timerContainer.style.display = 'flex';
        }
    }
}

window.QuizTimerHandler = QuizTimerHandler;