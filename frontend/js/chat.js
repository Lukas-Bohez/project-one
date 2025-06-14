// Chat System with Socket.IO support and message flagging
class ChatSystem {
    constructor() {
        this.currentUser = null;
        this.lanIP = `http://${window.location.hostname}`;
        this.sessionId = null;
        this.lastMessageCount = 0; // Track message count for smart scrolling

        console.log('ChatSystem: Constructor called. Fetching active session ID...');
        this.fetchActiveSessionId().then(() => {
            if (typeof io !== 'undefined') {
                this.socket = io(this.lanIP, {
                    transports: ["websocket", "polling"],
                    timeout: 20000,
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000
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
        });
    }

    init() {
        console.log('ChatSystem: init() started.');
        this.bindChatEvents();
        this.listenForUserEvents();
        this.loadChatMessages();
        console.log('ChatSystem: init() completed.');
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
                this.socket.emit('join', `quiz_session_${this.sessionId}`, (response) => {
                    if (response && response.status === 'success') {
                        console.log(`ChatSystem: Successfully joined room: quiz_session_${this.sessionId}`);
                    } else {
                        console.error(`ChatSystem: Failed to join room: quiz_session_${this.sessionId}`, response);
                    }
                });
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
            const activeSessionIdsList = data.active_session_ids;

            if (activeSessionIdsList && activeSessionIdsList.length > 0) {
                this.sessionId = activeSessionIdsList[0];
                console.log(`ChatSystem: Active session ID set to: ${this.sessionId}`);
            } else {
                console.warn('ChatSystem: No active sessions found. Defaulting to 2.');
                this.sessionId = 2;
            }
        } catch (error) {
            console.error('ChatSystem: Error fetching active session ID:', error);
            console.warn('ChatSystem: Could not fetch active session. Defaulting to 2.');
            this.sessionId = 2;
        }
    }

    listenForUserEvents() {
        // ... (unchanged)
        document.addEventListener('userAuthenticated', (event) => {
            this.currentUser = event.detail.user;
            this.loadChatMessages();
        });

        document.addEventListener('userRegistered', (event) => {
            const user = event.detail.user;
            this.addChatMessage('System', `${user.fullName} has joined the quiz!`);
        });

        document.addEventListener('userLoggedOut', () => {
            this.currentUser = null;
        });
    }

    bindChatEvents() {
        // ... (unchanged)
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
        // ... (unchanged)
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

    async sendChatMessage() {
        // ... (unchanged)
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();

        if (!message) {
            this.showChatError('Please enter a message to chat.');
            return;
        }

        if (!this.currentUser) {
            this.showChatError('Please log in to chat.');
            return;
        }

        if (!this.sessionId) {
            this.showChatError('Chat session not initialized. Please wait or refresh.');
            console.error('ChatSystem: sendChatMessage: sessionId is not set.');
            return;
        }

        chatInput.value = '';

        try {
            const response = await fetch(`${this.lanIP}/api/v1/chat/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    message_text: message,
                    user_id: this.currentUser.id,
                    message_type: 'chat',
                    reply_to_id: null
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to send message');
            }

            const result = await response.json();
            console.log('ChatSystem: Message sent successfully:', result);

            if (!this.socket) {
                document.dispatchEvent(new CustomEvent('messageSent', {
                    detail: {
                        sender: this.currentUser.fullName,
                        message,
                        userId: this.currentUser.id
                    }
                }));
            }

        } catch (error) {
            console.error('ChatSystem: Error sending message:', error);
            this.showChatError('Failed to send message. Please try again.');
            chatInput.value = message;
        }
    }

    addChatMessage(sender, message, isFlagged = false, flaggedBy = null, flaggedReason = null) {
        // ... (unchanged)
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = 'c-chat-message';

        if (sender === 'System') {
            messageElement.classList.add('c-chat-message-system');
        }

        if (isFlagged) {
            messageElement.classList.add('c-chat-message-flagged');
        }

        const sanitizedSender = this.sanitizeHTML(sender);
        let messageContent;

        if (isFlagged) {
            let flaggedText = '[Message Flagged]';

            if (flaggedBy && flaggedReason) {
                flaggedText = `[Flagged by ${this.sanitizeHTML(flaggedBy)}: ${this.sanitizeHTML(flaggedReason)}]`;
            } else if (flaggedBy) {
                flaggedText = `[Flagged by ${this.sanitizeHTML(flaggedBy)}]`;
            } else if (flaggedReason) {
                flaggedText = `[Flagged: ${this.sanitizeHTML(flaggedReason)}]`;
            }

            messageContent = `
                <span class="c-chat-sender">${sanitizedSender}:</span>
                <span class="c-chat-text c-chat-flagged-text">${flaggedText}</span>
            `;
        } else {
            const sanitizedMessage = this.sanitizeHTML(message);
            messageContent = `
                <span class="c-chat-sender">${sanitizedSender}:</span>
                <span class="c-chat-text">${sanitizedMessage}</span>
            `;
        }

        messageElement.innerHTML = messageContent;
        chatMessages.appendChild(messageElement);
    }

    isScrolledToBottom() {
        // ... (unchanged)
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return true;

        const threshold = 50;
        return chatMessages.scrollTop >= (chatMessages.scrollHeight - chatMessages.clientHeight - threshold);
    }

    sanitizeHTML(str) {
        // ... (unchanged)
        if (!str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    scrollChatToBottom() {
        // ... (unchanged)
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    showChatError(message) {
        // ... (unchanged)
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const errorElement = document.createElement('div');
        errorElement.className = 'c-chat-message c-chat-error';
        errorElement.innerHTML = `
            <span class="c-chat-sender">Error:</span>
            <span class="c-chat-text">${message}</span>
        `;

        chatMessages.appendChild(errorElement);
        this.scrollChatToBottom();

        setTimeout(() => {
            if (errorElement.parentNode) {
                errorElement.parentNode.removeChild(errorElement);
            }
        }, 5000);
    }

    setSessionId(sessionId) {
        // ... (unchanged)
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
        // ... (unchanged)
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
        this.lastMessageCount = 0;
    }

    getSessionId() {
        // ... (unchanged)
        return this.sessionId;
    }

    canChat() {
        // ... (unchanged)
        return this.currentUser !== null;
    }

    getCurrentUser() {
        // ... (unchanged)
        return this.currentUser;
    }
}

// Export for use in other scripts
window.ChatSystem = ChatSystem;