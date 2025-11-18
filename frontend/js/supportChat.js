// Support Chat System - Dedicated to session 999999
class SupportChatSystem {
    constructor() {
        this.currentUser = null;
        this.lanIP = `https://${window.location.hostname}`;
        this.sessionId = 999999; // Fixed support session ID
        this.socket = null;

        console.log('SupportChatSystem: Initializing for session 999999');
        this.initializeSocket();
        this.listenForUserEvents();
    }

    initializeSocket() {
        console.log('SupportChatSystem: Initializing Socket.IO connection...');
        
        this.socket = window.createCompatibleSocket ? 
            window.createCompatibleSocket(this.lanIP, {
                transports: ["polling", "websocket"],
                timeout: 30000,
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 2000,
                reconnectionDelayMax: 10000,
                autoConnect: true,
                forceNew: false
            }) : 
            io(this.lanIP, {
                transports: ["polling", "websocket"],
                timeout: 30000,
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 2000,
                reconnectionDelayMax: 10000,
                forceNew: false,
                upgrade: true,
                rememberUpgrade: false,
                autoConnect: true
            });
        
        // Make socket available globally for other systems
        window.supportSocket = this.socket;

        this.socket.on('connect', () => {
            console.log('SupportChatSystem: Connected to server with ID:', this.socket.id);
            this.updateConnectionStatus();
            
            // Join the support session room
            this.socket.emit('join', `quiz_session_${this.sessionId}`, (response) => {
                if (response && response.status === 'success') {
                    console.log(`SupportChatSystem: Successfully joined support room`);
                } else {
                    console.error(`SupportChatSystem: Failed to join support room`, response);
                }
            });
        });

        this.socket.on('disconnect', (reason) => {
            console.log('SupportChatSystem: Disconnected:', reason);
            this.updateConnectionStatus();
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('SupportChatSystem: Reconnected after', attemptNumber, 'attempts');
            this.updateConnectionStatus();
        });

        this.socket.on('reconnecting', (attemptNumber) => {
            console.log('SupportChatSystem: Reconnecting, attempt', attemptNumber);
            this.updateConnectionStatus();
        });

        this.socket.on('message_sent', (data) => {
            console.log('SupportChatSystem: Received message_sent event:', data);
            
            if (data.session_id === this.sessionId) {
                console.log('SupportChatSystem: Reloading messages for support session');
                setTimeout(() => {
                    this.loadMessages();
                }, 100);
            }
        });

        this.socket.on('error', (error) => {
            console.error('SupportChatSystem: Socket error:', error);
        });

        console.log('SupportChatSystem: Socket listeners initialized');
    }

    listenForUserEvents() {
        document.addEventListener('userAuthenticated', (event) => {
            console.log('SupportChatSystem: User authenticated event received');
            this.currentUser = event.detail.user;
            console.log('SupportChatSystem: Current user set to:', this.currentUser);
            
            // Load messages when user logs in
            this.loadMessages();
            this.updateConnectionStatus();
        });

        document.addEventListener('userLoggedOut', () => {
            console.log('SupportChatSystem: User logged out');
            this.currentUser = null;
            this.updateConnectionStatus();
        });
    }

    getUserFromLocalStorage() {
        try {
            const userId = localStorage.getItem('user_user_id');
            const firstName = localStorage.getItem('user_first_name');
            const lastName = localStorage.getItem('user_last_name');

            if (userId && firstName && lastName) {
                return {
                    id: userId,
                    fullName: `${firstName} ${lastName}`,
                    firstName: firstName,
                    lastName: lastName
                };
            }
            return null;
        } catch (error) {
            console.error('SupportChatSystem: Error reading from localStorage:', error);
            return null;
        }
    }

    getCurrentUserWithFallback() {
        if (this.currentUser) {
            return this.currentUser;
        }
        // Try localStorage as fallback
        return this.getUserFromLocalStorage();
    }

    async loadMessages() {
        try {
            console.log('SupportChatSystem: Loading messages...');
            const response = await fetch(`${this.lanIP}/api/v1/chat/messages/${this.sessionId}`);
            
            if (!response.ok) {
                throw new Error('Failed to load messages');
            }

            const data = await response.json();
            const messages = data.messages || [];
            console.log('SupportChatSystem: Loaded', messages.length, 'messages');

            const chatBox = document.getElementById('chatBox');
            if (!chatBox) {
                console.warn('SupportChatSystem: Chat box element not found');
                return;
            }

            chatBox.innerHTML = '';

            if (messages.length === 0) {
                chatBox.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary, #999);">No messages yet. Start the conversation!</div>';
            } else {
                // Reverse messages so oldest appears first (top) and newest last (bottom)
                messages.reverse().forEach((msg, idx) => {
                    // Pass the index so displayMessage can show a stable fallback when timestamps are missing
                    this.displayMessage(msg, idx);
                });
            }

            this.scrollToBottom();

        } catch (error) {
            console.error('SupportChatSystem: Error loading messages:', error);
            const chatBox = document.getElementById('chatBox');
            if (chatBox) {
                chatBox.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary, #999);">Unable to load messages. Please refresh the page.</div>';
            }
        }
    }

    displayMessage(msg, idx = null) {
        const chatBox = document.getElementById('chatBox');
        if (!chatBox) return;

        const currentUser = this.getCurrentUserWithFallback();
        const currentUsername = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : null;
        const isOwn = msg.username === currentUsername;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isOwn ? 'own' : 'other'}`;

        const usernameSpan = document.createElement('div');
        usernameSpan.className = 'username';
        usernameSpan.textContent = msg.username || 'Guest';

        const contentDiv = document.createElement('div');
        contentDiv.textContent = msg.message;

        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'timestamp';

        // Compute formatted timestamp once (avoid double-parsing)
        const candidateTs = this.getTimestampFromMessage(msg) || msg.created_at || msg.createdAt || msg.timestamp || msg.sent_at || msg.sentAt || msg.time || msg.date;
        const formattedTs = this.formatTimestamp(candidateTs);

        // If there's no usable timestamp, show a stable fallback using the message index (oldest-first)
        if (formattedTs === 'Unknown time' && Number.isInteger(idx)) {
            timestampDiv.textContent = `Message #${idx + 1} · Unknown time`;
        } else {
            timestampDiv.textContent = formattedTs;
        }

        // No debug logging here — use fallback timestamp extraction when fields are missing

        messageDiv.appendChild(usernameSpan);
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timestampDiv);

        chatBox.appendChild(messageDiv);
        
        // Auto-scroll to bottom to show newest messages
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    async sendMessage(messageText) {
        if (!messageText || !messageText.trim()) {
            console.warn('SupportChatSystem: Cannot send empty message');
            return;
        }

        const user = this.getCurrentUserWithFallback();
        if (!user) {
            console.error('SupportChatSystem: No user found, cannot send message');
            this.showError('Please log in to send messages');
            return;
        }

        console.log('SupportChatSystem: Sending message...', { user: user.fullName, message: messageText });

        try {
            const response = await fetch(`${this.lanIP}/api/v1/chat/support/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    message_text: messageText,
                    user_id: user.id,
                    message_type: 'chat',
                    reply_to_id: null
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to send message');
            }

            const result = await response.json();
            console.log('SupportChatSystem: Message sent successfully:', result);

            // If no socket, reload messages manually
            if (!this.socket || !this.socket.connected) {
                setTimeout(() => this.loadMessages(), 100);
            }

            return true;

        } catch (error) {
            console.error('SupportChatSystem: Error sending message:', error);
            this.showError('Failed to send message: ' + error.message);
            return false;
        }
    }

    updateConnectionStatus(connected = null) {
        const statusEl = document.getElementById('connectionStatus');
        const sendButton = document.getElementById('sendButton');

        if (!statusEl || !sendButton) return;

        const user = this.getCurrentUserWithFallback();
        
        // If connected parameter not provided, check actual socket state
        if (connected === null) {
            connected = this.socket && this.socket.connected;
        }
        
        const isReconnecting = this.socket && this.socket.reconnecting;

        if (connected && user) {
            statusEl.className = 'status-indicator connected';
            statusEl.querySelector('span:last-child').textContent = 'Connected';
            sendButton.disabled = false;
        } else if (isReconnecting && user) {
            statusEl.className = 'status-indicator connecting';
            statusEl.querySelector('span:last-child').textContent = 'Reconnecting...';
            sendButton.disabled = true;
        } else if (!user) {
            statusEl.className = 'status-indicator disconnected';
            statusEl.querySelector('span:last-child').textContent = 'Please log in to chat...';
            sendButton.disabled = true;
        } else {
            statusEl.className = 'status-indicator disconnected';
            statusEl.querySelector('span:last-child').textContent = 'Disconnected';
            sendButton.disabled = true;
        }
    }

    formatTimestamp(timestamp) {
        // Distinguish missing timestamp from a recent timestamp.
        // When there's no timestamp available, return an empty string so nothing is shown.
        if (timestamp === null || timestamp === undefined || timestamp === '') return '';

        // Normalize and robustly parse many timestamp formats:
        // - Unix seconds (e.g. 1630000000)
        // - Unix milliseconds (e.g. 1630000000000)
        // - Numeric strings of the above
        // - Common SQL datetime strings ("YYYY-MM-DD HH:MM:SS")
        // - ISO strings
        let date = null;

        try {
            if (typeof timestamp === 'number') {
                // If it looks like seconds (10 digits), convert to ms
                date = timestamp < 1e12 ? new Date(timestamp * 1000) : new Date(timestamp);
            } else if (typeof timestamp === 'string') {
                const s = timestamp.trim();

                // Pure numeric string
                if (/^\d+$/.test(s)) {
                    const num = parseInt(s, 10);
                    date = num < 1e12 ? new Date(num * 1000) : new Date(num);
                } else {
                    // Fix SQL-style 'YYYY-MM-DD HH:MM:SS' -> 'YYYY-MM-DDTHH:MM:SS' for reliable parsing
                    let normalized = s;
                    // Normalize SQL-style 'YYYY-MM-DD HH:MM:SS[.micro]' -> 'YYYY-MM-DDTHH:MM:SS[.ms][zone]'
                    const sqlMatch = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)(.*)$/);
                    if (sqlMatch) {
                        normalized = `${sqlMatch[1]}T${sqlMatch[2]}${sqlMatch[3] || ''}`;
                    }

                    // Trim fractional seconds to milliseconds precision (max 3 digits)
                    // e.g. 2025-11-18T17:24:27.122398 -> 2025-11-18T17:24:27.122
                    normalized = normalized.replace(/(\.\d{3})\d+/, '$1');

                    date = new Date(normalized);

                    // If still invalid, try removing fractional seconds entirely then parse
                    if (isNaN(date)) {
                        const withoutFraction = normalized.replace(/\.\d+/, '');
                        date = new Date(withoutFraction);
                    }

                    // If still invalid, try treating as UTC by appending 'Z'
                    if (isNaN(date) && !/Z$/.test(normalized)) {
                        date = new Date(normalized + 'Z');
                    }
                }
            }
        } catch (err) {
            date = null;
        }

        if (!date || isNaN(date.getTime())) {
            return 'Just now';
        }

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Try to extract a timestamp from a message object by checking common fields
    getTimestampFromMessage(msg) {
        if (!msg || typeof msg !== 'object') return null;

        // Common known fields
        const keysToTry = ['created_at', 'createdAt', 'timestamp', 'sent_at', 'sentAt', 'time', 'date', 'created', 'created_on', 'createdOn', 'ts'];
        for (const k of keysToTry) {
            if (k in msg && msg[k]) return msg[k];
        }

        // Shallow scan: look for any string/number value that looks like a date/time
        const isoLike = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+\-]\d{2}:?\d{2})?$/;
        const sqlLike = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
        for (const k in msg) {
            try {
                const v = msg[k];
                if (typeof v === 'string') {
                    const s = v.trim();
                    if (isoLike.test(s) || sqlLike.test(s) || /^\d{10,13}$/.test(s)) return s;
                } else if (typeof v === 'number') {
                    // plausible unix seconds or ms
                    if (v > 1e9) return v;
                }
            } catch (err) {
                // ignore
            }
        }

        return null;
    }

    scrollToBottom() {
        const chatBox = document.getElementById('chatBox');
        if (chatBox) {
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    sanitizeHTML(str) {
        if (!str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    showError(message) {
        this.showNotification('Error', message, 'error');
    }

    showSuccess(message) {
        this.showNotification('Success', message, 'success');
    }

    showNotification(title, message, type) {
        const chatBox = document.getElementById('chatBox');
        if (!chatBox) return;

        const notificationDiv = document.createElement('div');
        notificationDiv.className = `chat-notification chat-notification-${type}`;
        notificationDiv.style.cssText = `
            padding: 12px;
            margin: 10px 0;
            border-radius: 6px;
            text-align: center;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
        `;

        if (type === 'error') {
            notificationDiv.style.background = 'rgba(220, 53, 69, 0.1)';
            notificationDiv.style.color = '#dc3545';
            notificationDiv.style.border = '1px solid rgba(220, 53, 69, 0.3)';
        } else if (type === 'success') {
            notificationDiv.style.background = 'rgba(40, 167, 69, 0.1)';
            notificationDiv.style.color = '#28a745';
            notificationDiv.style.border = '1px solid rgba(40, 167, 69, 0.3)';
        }

        notificationDiv.innerHTML = `<strong>${title}:</strong> ${message}`;
        chatBox.appendChild(notificationDiv);
        this.scrollToBottom();

        setTimeout(() => {
            if (notificationDiv.parentNode) {
                notificationDiv.remove();
            }
        }, 5000);
    }

    isConnected() {
        return this.socket && this.socket.connected;
    }

    getCurrentUser() {
        return this.getCurrentUserWithFallback();
    }

    canChat() {
        return this.getCurrentUserWithFallback() !== null;
    }

    destroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Export for use in other scripts
window.SupportChatSystem = SupportChatSystem;
