// Chat System with Socket.IO support and auto-retry with sessionId updates
// Note: Frontend chat filtering/flagging display has been removed; moderation is handled by the backend.
class ChatSystem {
    constructor() {
        this.currentUser = null;
        this.lanIP = `https://${window.location.hostname}`;
        this.sessionId = null;
        this.lastMessageCount = 0; // Track message count for smart scrolling
        this.sessionUpdateInterval = null; // Store interval ID
        this.pendingMessage = null; // Store message being retried
        this.retryAttempts = 0;
        this.maxRetryAttempts = 10; // Maximum retry attempts
        this.explicitSessionId = null;

        console.log('ChatSystem: Constructor called. Fetching active session ID...');

        // Try to get session ID from URL params first (set by hub join button)
        const urlParams = new URLSearchParams(window.location.search);
        const urlSessionId = urlParams.get('session');
        if (urlSessionId) {
            this.sessionId = parseInt(urlSessionId, 10);
            this.explicitSessionId = this.sessionId;
            sessionStorage.setItem('quiz_session_id', String(this.sessionId));
            console.log(`ChatSystem: Using session ID from URL: ${this.sessionId}`);
        } else {
            // Check sessionStorage (set by session create flow)
            const storedId = sessionStorage.getItem('quiz_session_id');
            if (storedId) {
                this.sessionId = parseInt(storedId, 10);
                this.explicitSessionId = this.sessionId;
                console.log(`ChatSystem: Using session ID from sessionStorage: ${this.sessionId}`);
            }
        }
        // Store a global reference for other modules
        window.currentQuizSessionId = this.sessionId;

        this.fetchActiveSessionId().then(() => {
            if (typeof io !== 'undefined') {
                this.socket = window.createCompatibleSocket ? 
                    window.createCompatibleSocket(this.lanIP, {
                        // Enhanced configuration for better reliability
                        timeout: 30000,             // 30 second timeout
                        reconnectionAttempts: 10,   // More retry attempts
                        reconnectionDelay: 2000,    // Start with 2 second delay
                        reconnectionDelayMax: 10000, // Max 10 second delay
                        autoConnect: true,          // Auto connect on creation
                        forceNew: false            // Allow connection reuse
                    }) : 
                    io(this.lanIP, {
                        // Enhanced fallback configuration
                        transports: ["polling", "websocket"],  // Try polling first for compatibility
                        timeout: 30000,
                        reconnection: true,
                        reconnectionAttempts: 10,
                        reconnectionDelay: 2000,
                        reconnectionDelayMax: 10000,
                        forceNew: false,
                        upgrade: true,              // Allow upgrade to websocket
                        rememberUpgrade: false      // Don't remember across sessions
                    });
                
                this.initializeSocketListeners();
                // IMPORTANT: Make the socket instance available globally for other classes
                window.sharedSocket = this.socket;
                console.log('ChatSystem: Socket initialized and made available on window.sharedSocket.');
            } else {
                console.warn('ChatSystem: Socket.IO not available. Chat will work without real-time updates.');
                this.socket = null;
            }
            this.init();
            this.startSessionIdUpdater(); // Start periodic session ID updates
        });
    }

    init() {
        console.log('ChatSystem: init() started.');
        this.bindChatEvents();
        this.listenForUserEvents();
        this.loadChatMessages();
        console.log('ChatSystem: init() completed.');
    }

    // Start periodic sessionId updates
    startSessionIdUpdater() {
        console.log('ChatSystem: Starting periodic sessionId updater...');
        this.sessionUpdateInterval = setInterval(() => {
            this.fetchActiveSessionId();
        }, 30000); // Update every 30 seconds
    }

    // Stop periodic sessionId updates
    stopSessionIdUpdater() {
        if (this.sessionUpdateInterval) {
            clearInterval(this.sessionUpdateInterval);
            this.sessionUpdateInterval = null;
            console.log('ChatSystem: Stopped periodic sessionId updater');
        }
    }

    // Generate random greeting synonyms
    getRandomGreeting() {
        const greetings = [
            "Hello there!",
            "Hi everyone!",
            "Greetings!",
            "Hey all!",
            "Good day!",
            "Salutations!",
            "Howdy!",
            "What's up!",
            "Hola!",
            "Bonjour!",
            "Guten Tag!",
            "Ciao!",
            "Aloha!",
            "Yo!",
            "Sup!",
            "Heya!",
            "G'day!",
            "Shalom!",
            "Namaste!",
            "Konnichiwa!"
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    initializeSocketListeners() {
        if (!this.socket) {
            console.warn('ChatSystem: Cannot initialize socket listeners, socket is null.');
            return;
        }

        console.log('ChatSystem: Initializing Socket.IO listeners...');
        this.socket.on('connect', () => {
            console.log('ChatSystem: Connected to server with ID:', this.socket.id);
            if (this.sessionId) {
                // Join the chat room
                this.socket.emit('join', `quiz_session_${this.sessionId}`, (response) => {
                    if (response && response.status === 'success') {
                        console.log(`ChatSystem: Successfully joined room: quiz_session_${this.sessionId}`);
                    } else {
                        console.error(`ChatSystem: Failed to join room: quiz_session_${this.sessionId}`, response);
                    }
                });
                // Also emit join_quiz_session so the backend tracks which session this client is in
                this.socket.emit('join_quiz_session', { session_id: this.sessionId });
                console.log(`ChatSystem: Emitted join_quiz_session for session ${this.sessionId}`);
            } else {
                console.warn('ChatSystem: Socket connected, but sessionId is null. Cannot join room.');
            }
        });

        this.socket.on('message_sent', (data) => {
            console.log('ChatSystem: Received message_sent event via Socket.IO:', data);

            if (data.session_id === this.sessionId) {
                console.log('ChatSystem: Reloading chat messages for current session');
                // Small delay to ensure the message is in the database
                setTimeout(() => {
                    this.loadChatMessages();
                }, 100);
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('ChatSystem: Disconnected:', reason);
        });

        this.socket.on('error', (error) => {
            console.error('ChatSystem: Socket.IO error:', error);
        });
        console.log('ChatSystem: Socket.IO listeners initialized.');
    }

    async fetchActiveSessionId() {
        try {
            const response = await fetch(`${this.lanIP}/api/v1/sessions/active`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to fetch active session.');
            }

            const data = await response.json();
            const activeSessionIdsList = data.active_session_ids || [];
            const sessions = Array.isArray(data.sessions) ? data.sessions : [];

            const newestSession = sessions
                .filter(session => session && session.id !== 999999)
                .sort((left, right) => {
                    const leftTime = Date.parse(left.start_time || '') || 0;
                    const rightTime = Date.parse(right.start_time || '') || 0;
                    if (rightTime !== leftTime) {
                        return rightTime - leftTime;
                    }
                    return (right.id || 0) - (left.id || 0);
                })[0];

            const newestSessionId = newestSession?.id || activeSessionIdsList[0] || null;

            // If we have an explicit session from URL/sessionStorage, keep it.
            // Do not overwrite it with an older active session while the new one is still warming up.
            if (this.explicitSessionId) {
                if (activeSessionIdsList.includes(this.explicitSessionId)) {
                    console.log(`ChatSystem: Explicit session ${this.explicitSessionId} is active`);
                } else {
                    console.log(`ChatSystem: Waiting for explicit session ${this.explicitSessionId} to become active`);
                }

                window.currentQuizSessionId = this.sessionId;
                return;
            }

            if (!newestSessionId) {
                console.warn('ChatSystem: No active sessions found. Waiting for a new session to be created.');
                return;
            }

            // If we had no explicit session, adopt the newest active session.
            if (this.sessionId !== newestSessionId) {
                const oldSessionId = this.sessionId;
                this.sessionId = newestSessionId;
                sessionStorage.setItem('quiz_session_id', String(this.sessionId));
                window.currentQuizSessionId = this.sessionId;
                console.log(`ChatSystem: Session ID updated from ${oldSessionId} to ${newestSessionId}`);

                if (this.socket) {
                    if (oldSessionId) {
                        this.socket.emit('leave', `quiz_session_${oldSessionId}`);
                        console.log(`ChatSystem: Emitted leave for room: quiz_session_${oldSessionId}`);
                    }
                    this.socket.emit('join', `quiz_session_${this.sessionId}`, (response) => {
                        if (response && response.status === 'success') {
                            console.log(`ChatSystem: Successfully joined room: quiz_session_${this.sessionId}`);
                        } else {
                            console.error(`ChatSystem: Failed to join room: quiz_session_${this.sessionId}`, response);
                        }
                    });
                    this.socket.emit('join_quiz_session', { session_id: this.sessionId });
                    console.log(`ChatSystem: Emitted join for room: quiz_session_${this.sessionId}`);
                }

                if (this.pendingMessage) {
                    console.log('ChatSystem: Retrying pending message with new sessionId');
                    this.retryPendingMessage();
                }
            }
        } catch (error) {
            console.error('ChatSystem: Error fetching active session ID:', error);
            // Keep the current sessionId untouched on transient failures.
        }
    }

    // Get user from localStorage as fallback
    getUserFromLocalStorage() {
        try {
            console.log('chatdebugconsolelog: Attempting to get user from localStorage...');
            
            const userId = localStorage.getItem('user_user_id');
            const firstName = localStorage.getItem('user_first_name');
            const lastName = localStorage.getItem('user_last_name');

            console.log('chatdebugconsolelog: localStorage values:');
            console.log('chatdebugconsolelog: userId:', userId);
            console.log('chatdebugconsolelog: firstName:', firstName);
            console.log('chatdebugconsolelog: lastName:', lastName);

            if (userId && firstName && lastName) {
                const userFromStorage = {
                    id: userId,
                    fullName: `${firstName} ${lastName}`,
                    firstName: firstName,
                    lastName: lastName
                };
                console.log('chatdebugconsolelog: Successfully created user from localStorage:', userFromStorage);
                return userFromStorage;
            } else {
                console.log('chatdebugconsolelog: Missing required localStorage values, returning null');
                return null;
            }
        } catch (error) {
            console.error('chatdebugconsolelog: Error reading from localStorage:', error);
            return null;
        }
    }

    // Get current user with localStorage fallback
    getCurrentUserWithFallback() {
        console.log('chatdebugconsolelog: getCurrentUserWithFallback called');
        console.log('chatdebugconsolelog: this.currentUser:', this.currentUser);
        
        if (this.currentUser) {
            console.log('chatdebugconsolelog: Using this.currentUser:', this.currentUser);
            return this.currentUser;
        }

        // Try localStorage as fallback
        console.log('chatdebugconsolelog: this.currentUser is null, trying localStorage fallback...');
        const userFromStorage = this.getUserFromLocalStorage();
        if (userFromStorage) {
            console.log('chatdebugconsolelog: Using user data from localStorage as fallback:', userFromStorage);
            return userFromStorage;
        }

        console.log('chatdebugconsolelog: No user found in currentUser or localStorage, returning null');
        return null;
    }

    listenForUserEvents() {
        document.addEventListener('userAuthenticated', (event) => {
            console.log('chatdebugconsolelog: userAuthenticated event received');
            console.log('chatdebugconsolelog: event.detail:', event.detail);
            this.currentUser = event.detail.user;
            console.log('chatdebugconsolelog: this.currentUser set to:', this.currentUser);
            this.loadChatMessages();
        });

        document.addEventListener('userRegistered', (event) => {
            console.log('chatdebugconsolelog: userRegistered event received');
            const user = event.detail.user;
            console.log('chatdebugconsolelog: registered user:', user);
            this.addChatMessage('System', `${user.fullName} has joined the quiz!`);
        });

        document.addEventListener('userLoggedOut', () => {
            console.log('chatdebugconsolelog: userLoggedOut event received');
            this.currentUser = null;
            console.log('chatdebugconsolelog: this.currentUser set to null');
        });
    }

    bindChatEvents() {
        const chatSend = document.getElementById('chatSend');
        const chatInput = document.getElementById('chatInput');
        const chatToggle = document.getElementById('chatToggle');
        const chatContent = document.getElementById('chatContent');
        const chatMessages = document.getElementById('chatMessages');

        if (!chatSend || !chatInput || !chatToggle || !chatContent || !chatMessages) {
            console.warn("ChatSystem: Chat elements not found. Skipping chat event binding.");
            return;
        }

        chatMessages.style.maxHeight = '250px';
        chatMessages.style.overflowY = 'auto';
        this.scrollChatToBottom();

        chatSend.addEventListener('click', () => this.sendChatMessage());

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });

        chatToggle.addEventListener('click', () => {
            chatContent.style.display = chatContent.style.display === 'none' ? 'block' : 'none';
            chatToggle.textContent = chatContent.style.display === 'none' ? '+' : '−';
            if (chatContent.style.display === 'block') {
                this.scrollChatToBottom();
            }
        });
    }

    async loadChatMessages() {
        if (!this.sessionId) {
            console.warn('ChatSystem: loadChatMessages: Session ID is not yet available. Skipping chat load.');
            return;
        }

        try {
            const response = await fetch(`${this.lanIP}/api/v1/chat/messages/${this.sessionId}`);
            if (!response.ok) throw new Error('Failed to load messages');

            const data = await response.json();
            const messages = data.messages || [];
            console.log('ChatSystem: Loaded messages:', messages);

            const chatMessages = document.getElementById('chatMessages');
            if (!chatMessages) return;

            const wasAtBottom = this.isScrolledToBottom();
            const previousMessageCount = this.lastMessageCount;

            chatMessages.innerHTML = '';

            messages.reverse().forEach(msg => {
                this.addChatMessage(msg.username, msg.message, msg.is_flagged, msg.flagged_by, msg.flagged_reason);
            });

            this.lastMessageCount = messages.length;

            if (wasAtBottom || previousMessageCount === 0) {
                this.scrollChatToBottom();
            }

        } catch (error) {
            console.error('ChatSystem: Error loading chat messages:', error);
        }
    }

    async retryPendingMessage() {
        if (!this.pendingMessage) return;

        console.log(`ChatSystem: Retrying pending message (attempt ${this.retryAttempts + 1}/${this.maxRetryAttempts})`);
        
        try {
            const response = await fetch(`${this.lanIP}/api/v1/chat/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...this.pendingMessage,
                    session_id: this.sessionId // Use current sessionId
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('ChatSystem: Pending message sent successfully:', result);
                
                // Clear pending message and reset retry counter
                this.pendingMessage = null;
                this.retryAttempts = 0;
                
                // Stop the session updater since message went through
                this.stopSessionIdUpdater();
                
                // Show success message
                this.showChatSuccess('Message sent successfully!');

                if (!this.socket) {
                    document.dispatchEvent(new CustomEvent('messageSent', {
                        detail: {
                            sender: this.pendingMessage.fullName,
                            message: this.pendingMessage.message_text,
                            userId: this.pendingMessage.user_id
                        }
                    }));
                }
            } else {
                throw new Error('Server returned error status');
            }
        } catch (error) {
            this.retryAttempts++;
            console.error(`ChatSystem: Retry attempt ${this.retryAttempts} failed:`, error);
            
            if (this.retryAttempts >= this.maxRetryAttempts) {
                console.error('ChatSystem: Max retry attempts reached, giving up');
                this.showChatError('Failed to send message after multiple attempts. Please try again manually.');
                this.pendingMessage = null;
                this.retryAttempts = 0;
                this.stopSessionIdUpdater();
            }
        }
    }

    async sendChatMessage() {
        console.log('chatdebugconsolelog: sendChatMessage called');
        
        const chatInput = document.getElementById('chatInput');
        let message = chatInput.value.trim();

        // If no message provided, use a random greeting
        if (!message) {
            message = this.getRandomGreeting();
            console.log('chatdebugconsolelog: No message provided, using random greeting:', message);
        }

        console.log('chatdebugconsolelog: Message to send:', message);

        // Try to get user with localStorage fallback
        const user = this.getCurrentUserWithFallback();
        console.log('chatdebugconsolelog: User from getCurrentUserWithFallback:', user);
        
        if (!user) {
            console.log('chatdebugconsolelog: No user found, showing login error');
            this.showChatError('Please log in to chat.');
            return;
        }

        if (!this.sessionId) {
            console.log('chatdebugconsolelog: No sessionId, showing session error');
            this.showChatError('Chat session not initialized. Please wait or refresh.');
            console.error('ChatSystem: sendChatMessage: sessionId is not set.');
            return;
        }

        console.log('chatdebugconsolelog: All checks passed, sending message with user:', user, 'sessionId:', this.sessionId);

        chatInput.value = '';

        try {
            const payload = {
                session_id: this.sessionId,
                message_text: message,
                user_id: user.id,
                message_type: 'chat',
                reply_to_id: null
            };
            
            console.log('chatdebugconsolelog: Sending payload:', payload);

            const response = await fetch(`${this.lanIP}/api/v1/chat/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.log('chatdebugconsolelog: Server error response:', errorData);
                
                // If it's a session-related error, set up for retry
                if (errorData.detail && (
                    errorData.detail.includes('session') || 
                    errorData.detail.includes('Session') ||
                    errorData.detail.includes('not found') ||
                    response.status === 404
                )) {
                    console.log('ChatSystem: Session-related error detected, setting up retry mechanism');
                    this.pendingMessage = {
                        ...payload,
                        fullName: user.fullName
                    };
                    this.retryAttempts = 0;
                    
                    // Start session updater if not already running
                    if (!this.sessionUpdateInterval) {
                        this.startSessionIdUpdater();
                    }
                    
                    this.showChatInfo('Updating session, retrying message...');
                    return;
                }
                
                throw new Error(errorData.detail || 'Failed to send message');
            }

            const result = await response.json();
            console.log('chatdebugconsolelog: Message sent successfully:', result);

            if (!this.socket) {
                console.log('chatdebugconsolelog: No socket, dispatching messageSent event');
                document.dispatchEvent(new CustomEvent('messageSent', {
                    detail: {
                        sender: user.fullName,
                        message,
                        userId: user.id
                    }
                }));
            }

        } catch (error) {
            console.error('chatdebugconsolelog: Error sending message:', error);
            this.showChatError('Failed to send message. Please try again.');
            chatInput.value = message;
        }
    }

    // Display a chat message. Flag parameters are ignored (filtering handled by backend).
    addChatMessage(sender, message, isFlagged = false, flaggedBy = null, flaggedReason = null) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = 'c-chat-message';

        if (sender === 'System') {
            messageElement.classList.add('c-chat-message-system');
        }

        const sanitizedSender = this.sanitizeHTML(sender);
        const sanitizedMessage = this.sanitizeHTML(message);
        const messageContent = `
            <span class="c-chat-sender">${sanitizedSender}:</span>
            <span class="c-chat-text">${sanitizedMessage}</span>
        `;

        messageElement.innerHTML = messageContent;
        chatMessages.appendChild(messageElement);
    }

    isScrolledToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return true;

        const threshold = 50;
        return chatMessages.scrollTop >= (chatMessages.scrollHeight - chatMessages.clientHeight - threshold);
    }

    sanitizeHTML(str) {
        if (!str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    scrollChatToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    showChatError(message) {
        this.showChatMessage('Error', message, 'c-chat-error');
    }

    showChatSuccess(message) {
        this.showChatMessage('Success', message, 'c-chat-success');
    }

    showChatInfo(message) {
        this.showChatMessage('Info', message, 'c-chat-info');
    }

    showChatMessage(type, message, className) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = `c-chat-message ${className}`;
        
        const senderSpan = document.createElement('span');
        senderSpan.className = 'c-chat-sender';
        senderSpan.textContent = type + ':';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'c-chat-text';
        textSpan.textContent = message;
        
        messageElement.appendChild(senderSpan);
        messageElement.appendChild(textSpan);

        chatMessages.appendChild(messageElement);
        this.scrollChatToBottom();

        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 5000);
    }

    setSessionId(sessionId) {
        const oldSessionId = this.sessionId;
        this.sessionId = sessionId;

        if (this.socket && this.socket.connected) {
            if (oldSessionId && oldSessionId !== this.sessionId) {
                this.socket.emit('leave', `quiz_session_${oldSessionId}`);
                console.log(`ChatSystem: Left old room: quiz_session_${oldSessionId}`);
            }
            this.socket.emit('join', `quiz_session_${this.sessionId}`);
            console.log(`ChatSystem: Switched to room: quiz_session_${this.sessionId}`);
        }

        this.lastMessageCount = 0;
        this.loadChatMessages();
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
        this.lastMessageCount = 0;
    }

    getSessionId() {
        return this.sessionId;
    }

    canChat() {
        // Check both currentUser and localStorage fallback
        const user = this.getCurrentUserWithFallback();
        console.log('chatdebugconsolelog: canChat() called, user:', user);
        return user !== null;
    }

    getCurrentUser() {
        // Return current user with localStorage fallback
        const user = this.getCurrentUserWithFallback();
        console.log('chatdebugconsolelog: getCurrentUser() called, returning:', user);
        return user;
    }

    // Cleanup method to stop intervals when needed
    destroy() {
        this.stopSessionIdUpdater();
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

document.addEventListener('userAuthenticated', (event) => {
    console.log("chatdebugconsolelog: Global userAuthenticated event received");
    const user = event.detail.user;
    console.log("chatdebugconsolelog: Global event user data:", user);
    // This should set the instance's currentUser, not the class property
    if (window.chatSystemInstance) {
        console.log("chatdebugconsolelog: Setting chatSystemInstance.currentUser");
        window.chatSystemInstance.currentUser = user;
        console.log("chatdebugconsolelog: chatSystemInstance.currentUser set to:", window.chatSystemInstance.currentUser);
        window.chatSystemInstance.fetchActiveSessionId();
    } else {
        console.log("chatdebugconsolelog: window.chatSystemInstance not found");
    }
});

// Export for use in other scripts
window.ChatSystem = ChatSystem;