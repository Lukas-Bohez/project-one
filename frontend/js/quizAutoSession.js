/**
 * Quiz Auto-Session Manager
 * Automatically creates/joins sessions and requests questions
 */

class QuizAutoSession {
    constructor() {
        this.sessionId = null;
        this.userId = null;
        this.socket = null;
        this.questionRequestInterval = null;
        this.lanIP = localStorage.getItem('lanIP') || 'http://localhost:8001';
    }

    /**
     * Initialize auto-session with user ID
     */
    async init(userId, socket) {
        // console.log('🎮 QuizAutoSession: Initializing with user:', userId);
        this.userId = userId;
        this.socket = socket;

        // Auto-start or join a session
        await this.autoStartSession();

        // Set up socket listeners
        this.setupSocketListeners();

        // Backend will auto-start quiz when user joins session
        // console.log('💡 QuizAutoSession: Session ready. Backend will auto-start quiz flow.');
        // console.log('ℹ️ QuizAutoSession: Waiting for backend to send theme selection...');
    }
    
    /**
     * Fetch question via HTTP and dispatch event
     */
    async fetchQuestionHTTP() {
        try {
            // Ensure lanIP includes protocol
            const baseUrl = this.lanIP.startsWith('http') ? this.lanIP : `http://${this.lanIP}`;
            const url = `${baseUrl}/api/v1/sessions/${this.sessionId}/question`;
            // console.log('📡 QuizAutoSession: Fetching from URL:', url);
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success !== false && data.question) {
                // console.log('✅ QuizAutoSession: Question fetched via HTTP:', data.question.id);
                
                // Dispatch as event for quiz logic to handle
                document.dispatchEvent(new CustomEvent('quizQuestionReceived', {
                    detail: data
                }));
            } else {
                console.error('❌ QuizAutoSession: Invalid question response:', data);
            }
        } catch (error) {
            console.error('❌ QuizAutoSession: HTTP question fetch failed:', error);
        }
    }

    /**
     * Auto-start or join active session
     */
    async autoStartSession() {
        try {
            // Wait for chat system to initialize and get session ID
            let attempts = 0;
            while (attempts < 20) {  // Wait up to 2 seconds
                if (window.chatSystemInstance && window.chatSystemInstance.sessionId) {
                    this.sessionId = window.chatSystemInstance.sessionId;
                    // console.log(`✅ QuizAutoSession: Using existing session ID from chat: ${this.sessionId}`);
                    
                    // Dispatch event for other components
                    document.dispatchEvent(new CustomEvent('quizSessionReady', {
                        detail: { sessionId: this.sessionId }
                    }));
                    
                    return this.sessionId;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            // console.log('⚠️ Chat system not ready, trying API...');
            
            // Try to fetch or create a session
            const response = await fetch(`${this.lanIP}/api/v1/sessions/auto-start?user_id=${this.userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to auto-start session: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.sessionId = data.session_id;
                // console.log(`✅ QuizAutoSession: ${data.status} - Session ID: ${this.sessionId}`);
                
                // Join the socket.io room for this session
                if (this.socket) {
                    this.socket.emit('join', `quiz_session_${this.sessionId}`, (response) => {
                        // console.log('✅ Joined quiz session room:', response);
                    });
                }

                // Dispatch event for other components
                document.dispatchEvent(new CustomEvent('quizSessionReady', {
                    detail: { sessionId: this.sessionId }
                }));

                return this.sessionId;
            } else {
                console.error('❌ Failed to auto-start session:', data);
                // Fall through to check chat system again
            }
        } catch (error) {
            console.error('❌ Error auto-starting session:', error);
        }
        
        // Final fallback: use chat system's session ID or default to 2
        if (window.chatSystemInstance && window.chatSystemInstance.sessionId) {
            this.sessionId = window.chatSystemInstance.sessionId;
            console.warn(`⚠️ Using fallback from chat system: session ${this.sessionId}`);
        } else {
            this.sessionId = 2;
            console.warn('⚠️ Using fallback session ID: 2');
        }
        
        if (this.socket) {
            this.socket.emit('join', `quiz_session_${this.sessionId}`);
        }
        
        return this.sessionId;
    }

    /**
     * Set up socket listeners for question events
     */
    setupSocketListeners() {
        if (!this.socket) {
            console.warn('⚠️ No socket available for question listeners');
            return;
        }

        // Listen for new questions
        this.socket.on('new_question', (data) => {
            // console.log('📝 QuizAutoSession: Received new question:', data);
            
            // Dispatch event for quiz logic to handle
            document.dispatchEvent(new CustomEvent('quizQuestionReceived', {
                detail: data
            }));
        });

        // Listen for errors
        this.socket.on('error', (data) => {
            console.error('❌ QuizAutoSession: Socket error:', data);
        });

        // console.log('✅ QuizAutoSession: Socket listeners set up');
    }

    /**
     * Request a question from the server
     */
    requestQuestion() {
        if (!this.socket || !this.sessionId) {
            console.warn('⚠️ Cannot request question: socket or sessionId missing');
            return;
        }

        // console.log('📤 QuizAutoSession: Requesting question for session:', this.sessionId);
        
        this.socket.emit('request_question', {
            session_id: this.sessionId
        });
    }

    /**
     * Start auto-requesting questions at intervals
     * DISABLED: Quiz uses theme selection flow instead
     */
    startAutoQuestionRequest() {
        // DISABLED: Quiz requires theme selection first
        // The quiz flow is: theme_selection → theme_description → questions from that theme
        // console.log('ℹ️ QuizAutoSession: Auto-questions disabled - quiz is theme-driven');
        // console.log('ℹ️ QuizAutoSession: Questions will be received via Socket.IO "new_question" events');
        // this.questionRequestInterval = setInterval(async () => {
        //     // console.log('⏰ QuizAutoSession: Auto-requesting next question');
        //     await this.fetchQuestionHTTP();
        // }, 60000); // 60 seconds
    }

    /**
     * Stop auto-requesting questions
     */
    stopAutoQuestionRequest() {
        if (this.questionRequestInterval) {
            clearInterval(this.questionRequestInterval);
            this.questionRequestInterval = null;
            // console.log('⏹️ QuizAutoSession: Auto-question request stopped');
        }
    }

    /**
     * Get current session ID
     */
    getSessionId() {
        return this.sessionId;
    }

    /**
     * Manually trigger question request
     */
    nextQuestion() {
        this.requestQuestion();
    }

    /**
     * Clean up
     */
    destroy() {
        this.stopAutoQuestionRequest();
        if (this.socket && this.sessionId) {
            this.socket.emit('leave', `quiz_session_${this.sessionId}`);
        }
        // console.log('🧹 QuizAutoSession: Cleaned up');
    }
}

// Make it globally available
window.QuizAutoSession = QuizAutoSession;

// Auto-initialize when user is authenticated
document.addEventListener('userAuthenticated', async (event) => {
    const user = event.detail.user;
    
    // Wait for socket to be available
    const waitForSocket = () => {
        return new Promise((resolve) => {
            const checkSocket = () => {
                if (window.sharedSocket && window.sharedSocket.connected) {
                    resolve(window.sharedSocket);
                } else {
                    setTimeout(checkSocket, 100);
                }
            };
            checkSocket();
        });
    };

    try {
        const socket = await waitForSocket();
        
        // Create and initialize auto-session
        window.quizAutoSession = new QuizAutoSession();
        await window.quizAutoSession.init(user.id, socket);
        
        // console.log('✅ Quiz auto-session fully initialized');
    } catch (error) {
        console.error('❌ Failed to initialize quiz auto-session:', error);
    }
});

// Provide manual control functions
window.requestNextQuestion = () => {
    if (window.quizAutoSession) {
        window.quizAutoSession.nextQuestion();
    } else {
        console.warn('⚠️ Auto-session not initialized yet');
    }
};

// console.log('📦 QuizAutoSession module loaded');

// Start quiz - automatically join active session or create new one
window.startQuizWithThemes = async () => {
    // console.log('🎮 Starting quiz...');
    
    // Check if already in a session with a question loaded
    if (window.quizLogicInstance?.questionHandler?.currentQuestion) {
        // console.log('✅ Already in active quiz session');
        return;
    }
    
    const sessionId = window.quizAutoSession?.sessionId || window.chatSystemInstance?.sessionId || 1000167;
    
    // Build proper backend URL - check multiple sources for the IP
    let lanIP = localStorage.getItem('lanIP');
    
    // If lanIP doesn't include protocol, construct full URL
    if (!lanIP || lanIP === 'undefined') {
        // Use stored IP from quizmain.js or fallback to current host
        const storedIP = localStorage.getItem('ip') || window.location.hostname;
        lanIP = `https://${storedIP}`;
    } else if (!lanIP.startsWith('http')) {
        lanIP = `https://${lanIP}`;
    }
    
    // console.log(`🎮 Joining/creating session ${sessionId}...`);
    // console.log(`📡 Using backend URL: ${lanIP}`);
    
    try {
        // Fetch all themes for selection
        const themesUrl = `${lanIP}/api/v1/themes/`;
        // console.log(`🔍 Fetching themes from: ${themesUrl}`);
        const response = await fetch(themesUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const themes = await response.json();
        
        if (themes && themes.length > 0) {
            // Pick 4 random themes for selection
            const shuffled = themes.sort(() => 0.5 - Math.random());
            const selectedThemes = shuffled.slice(0, Math.min(4, themes.length));
            
            // console.log('✅ Theme selection started');
            // console.log('📋 Available themes:', selectedThemes.map(t => t.name || t[1]).join(', '));
            
            // Format as theme_selection question
            const themeSelectionData = {
                type: 'theme_selection',
                question: 'Select a theme for the quiz:',
                themes: selectedThemes,
                session_id: sessionId
            };
            
            // Dispatch as theme_selection question
            document.dispatchEvent(new CustomEvent('quizQuestionReceived', {
                detail: themeSelectionData
            }));
            
            return themeSelectionData;
        } else {
            console.error('❌ No themes available');
        }
    } catch (error) {
        console.error('❌ Failed to start theme selection:', error);
    }
};

// Alias for the "Get Question" button
window.testQuizQuestion = window.startQuizWithThemes;

// console.log('🎮 Quiz will auto-start when you join the session');
