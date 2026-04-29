/**
 * Support Chat System - Multi-Room
 * Connects via Socket.IO, manages rooms, loads/sends messages.
 */
class SupportChatSystem {
    constructor() {
        this.currentUser = null;
        this.baseURL = `https://${window.location.hostname}`;
        this.socket = null;
        this.rooms = [];
        this.activeRoomId = null;
        this.joinedSocketRooms = new Set();

        this.initializeSocket();
        this.listenForUserEvents();
    }

    /* ──────────────────── Socket ──────────────────── */
    initializeSocket() {
        this.socket = io(this.baseURL, {
            transports: ['polling', 'websocket'],
            timeout: 30000,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 15000,
            upgrade: true,
            autoConnect: true
        });

        window.supportSocket = this.socket;

        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
            for (const rName of this.joinedSocketRooms) {
                this.socket.emit('join', rName);
            }
            this.registerSocketAuth();
            if (this.activeRoomId) this.loadMessages(this.activeRoomId);
        });

        this.socket.on('disconnect', () => this.updateConnectionStatus(false));
        this.socket.on('reconnecting', () => this.updateConnectionStatus(null));

        // Real-time message for any support room
        this.socket.on('support_message', (data) => {
            if (data.room_id === this.activeRoomId) {
                this.appendMessage(data);
            }
        });

        this.socket.on('support_message_deleted', (data) => {
            this.markMessageDeleted(data.message_id, data.room_id);
        });

        this.socket.on('support_banned', (data) => {
            this.showNotification(data.reason || 'You have been banned from support chat', 'error');
            this.handleBannedUser();
        });

        // Room list changed (created / deleted)
        this.socket.on('support_rooms_updated', () => {
            this.loadRooms();
        });
    }

    registerSocketAuth() {
        const user = this.getCurrentUser();
        if (!user || !this.socket) return;
        this.socket.emit('support_auth', {
            user_id: user.id,
            room_ids: this.rooms.map(room => room.id),
        });
    }

    /* ──────────────────── Auth events ──────────────────── */
    listenForUserEvents() {
        document.addEventListener('userAuthenticated', (e) => {
            this.currentUser = e.detail.user;
            this.loadRooms().then(() => {
                this.registerSocketAuth();
                // Auto-select Global Chat (room 1)
                if (!this.activeRoomId && this.rooms.length) {
                    const global = this.rooms.find(r => r.id === 1) || this.rooms[0];
                    this.selectRoom(global.id);
                }
            });
            this.updateConnectionStatus();
        });

        document.addEventListener('userLoggedOut', () => {
            this.currentUser = null;
            this.rooms = [];
            this.activeRoomId = null;
            this.joinedSocketRooms.forEach(r => this.socket.emit('leave', r));
            this.joinedSocketRooms.clear();
            this.renderRoomList();
            this.clearMessages();
            this.updateConnectionStatus();
        });
    }

    getCurrentUser() {
        if (this.currentUser) return this.currentUser;
        // Fallback to localStorage
        const id = localStorage.getItem('support_user_id');
        const fn = localStorage.getItem('support_first_name');
        const ln = localStorage.getItem('support_last_name');
        const roleId = localStorage.getItem('support_user_role_id');
        const isAdmin = localStorage.getItem('support_is_admin');
        if (id && fn && ln) {
            return {
                id,
                firstName: fn,
                lastName: ln,
                fullName: `${fn} ${ln}`,
                userRoleId: roleId ? Number(roleId) : 1,
                isAdmin: isAdmin === 'true',
            };
        }
        return null;
    }

    /* ──────────────────── Rooms ──────────────────── */
    async loadRooms() {
        const user = this.getCurrentUser();
        if (!user) return;
        try {
            const res = await fetch(`${this.baseURL}/api/v1/support/rooms?user_id=${user.id}`);
            if (!res.ok) throw new Error('Failed to load rooms');
            const data = await res.json();
            this.rooms = data.rooms || [];
            this.renderRoomList();

            // Join socket rooms for every room (so we get real-time messages)
            for (const room of this.rooms) {
                const rName = `support_room_${room.id}`;
                if (!this.joinedSocketRooms.has(rName)) {
                    this.socket.emit('join', rName);
                    this.joinedSocketRooms.add(rName);
                }
            }
            this.registerSocketAuth();
        } catch (err) {
            console.error('loadRooms error:', err);
        }
    }

    renderRoomList() {
        const list = document.getElementById('roomList');
        if (!list) return;
        list.innerHTML = '';

        if (!this.rooms.length) {
            list.innerHTML = '<div style="text-align:center;padding:20px;opacity:.6;font-size:.85rem;">No rooms available</div>';
            return;
        }

        for (const room of this.rooms) {
            const card = document.createElement('div');
            card.className = `room-card${room.id === this.activeRoomId ? ' active' : ''}`;
            card.dataset.roomId = room.id;

            const icon = room.is_private
                ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 1110 0v2h1a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h1zm2 0h6V8a3 3 0 10-6 0v2zm3 4a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"></path></svg>'
                : (room.id === 1
                    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 2c1.2 0 2.3.8 2.8 2H9.2C9.7 5.8 10.8 5 12 5zm-6 7c0-.7.1-1.4.4-2h3.1c-.1.6-.2 1.3-.2 2s.1 1.4.2 2H6.4a7 7 0 01-.4-2zm6 7c-1.2 0-2.3-.8-2.8-2h5.6c-.5 1.2-1.6 2-2.8 2zm3.6-4h-7.2a10.2 10.2 0 010-4h7.2a10.2 10.2 0 010 4zm1.8-2c0 .7-.1 1.4-.4 2h-3.1c.1-.6.2-1.3.2-2s-.1-1.4-.2-2h3.1c.3.6.4 1.3.4 2zm-1-4h-3.8a8.6 8.6 0 00-1.1-2 7 7 0 014.9 2zm-9.8 0H6.8a7 7 0 014.9-2 8.6 8.6 0 00-1.1 2z"></path></svg>'
                    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 5V5zm4 4h8m-8 3h5"></path></svg>');
            const meta = room.is_private ? 'Private' : `${room.message_count || 0} msgs`;

            card.innerHTML = `
                <span class="room-card-icon">${icon}</span>
                <div class="room-card-info">
                    <div class="room-card-name">${this.escapeHTML(room.name)}</div>
                    <div class="room-card-meta">${meta} · ${this.escapeHTML(room.creator_name || 'System')}</div>
                </div>
            `;

            card.addEventListener('click', () => this.selectRoom(room.id));
            list.appendChild(card);
        }
    }

    selectRoom(roomId) {
        if (this.activeRoomId === roomId) return;
        this.activeRoomId = roomId;
        this.renderRoomList(); // update active highlight

        const room = this.rooms.find(r => r.id === roomId);
        if (!room) return;

        // Update header
        const title = document.getElementById('roomTitle');
        const desc = document.getElementById('roomDescription');
        const deleteBtn = document.getElementById('deleteRoomBtn');
        const mobileName = document.getElementById('mobileRoomName');
        const banner = document.getElementById('roomInfoBanner');

        if (title) title.textContent = room.name;
        if (desc) desc.textContent = room.description || '';
        if (mobileName) mobileName.textContent = room.name;

        // Show delete btn only if user is owner or admin, and not Global Chat
        const user = this.getCurrentUser();
        if (deleteBtn) {
            const canDelete = room.id !== 1 && user && (
                String(room.created_by) === String(user.id) || this.isAdmin()
            );
            deleteBtn.style.display = canDelete ? 'inline-flex' : 'none';
        }

        // Show info banner only for Global Chat
        if (banner) {
            banner.style.display = room.id === 1 ? 'block' : 'none';
        }

        // Close sidebar on mobile
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');

        this.loadMessages(roomId);
    }

    async createRoom(name, description, isPrivate) {
        const user = this.getCurrentUser();
        if (!user) return null;
        try {
            const res = await fetch(`${this.baseURL}/api/v1/support/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, is_private: isPrivate, user_id: user.id })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to create room');
            }
            const data = await res.json();
            await this.loadRooms();
            this.selectRoom(data.room_id);
            return data.room_id;
        } catch (err) {
            this.showNotification(err.message, 'error');
            return null;
        }
    }

    async deleteRoom(roomId) {
        const user = this.getCurrentUser();
        if (!user) return false;
        try {
            const res = await fetch(`${this.baseURL}/api/v1/support/rooms/${roomId}?user_id=${user.id}`, {
                method: 'DELETE'
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to delete room');
            }
            // If we were in that room, switch to Global Chat
            if (this.activeRoomId === roomId) {
                this.activeRoomId = null;
                this.selectRoom(1);
            }
            await this.loadRooms();
            this.showNotification('Room deleted', 'success');
            return true;
        } catch (err) {
            this.showNotification(err.message, 'error');
            return false;
        }
    }

    /* ──────────────────── Messages ──────────────────── */
    async loadMessages(roomId) {
        const user = this.getCurrentUser();
        if (!user) return;
        const chatBox = document.getElementById('chatBox');
        if (!chatBox) return;

        try {
            const res = await fetch(`${this.baseURL}/api/v1/support/rooms/${roomId}/messages?user_id=${user.id}`);
            if (!res.ok) {
                if (res.status === 403) {
                    chatBox.innerHTML = '<div class="no-messages"><svg class="inline-status-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 1110 0v2h1a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h1zm2 0h6V8a3 3 0 10-6 0v2z"></path></svg> You don\'t have access to this room.</div>';
                    return;
                }
                throw new Error('Failed to load messages');
            }
            const data = await res.json();
            const messages = data.messages || [];

            chatBox.innerHTML = '';
            if (!messages.length) {
                chatBox.innerHTML = '<div class="no-messages">No messages yet. Start the conversation!</div>';
            } else {
                for (const msg of messages) {
                    this.appendMessage(msg, false);
                }
            }
            this.scrollToBottom();
        } catch (err) {
            console.error('loadMessages error:', err);
            chatBox.innerHTML = '<div class="no-messages">Unable to load messages. Try again later.</div>';
        }
    }

    appendMessage(msg, scroll = true) {
        const chatBox = document.getElementById('chatBox');
        if (!chatBox) return;

        const placeholder = chatBox.querySelector('.no-messages');
        if (placeholder) placeholder.remove();

        const user = this.getCurrentUser();
        const currentName = user ? `${user.firstName} ${user.lastName}` : null;
        const isOwn = msg.username === currentName || String(msg.user_id) === String(user?.id);
        const isDeleted = Boolean(msg.deleted_at);
        const canModerate = this.isAdmin() && msg.user_id;

        const div = document.createElement('div');
        div.className = `chat-message ${isOwn ? 'own' : 'other'}${isDeleted ? ' deleted' : ''}`;
        div.dataset.messageId = msg.id || '';

        const topRow = document.createElement('div');
        topRow.className = 'chat-message__top';

        const nameEl = document.createElement('div');
        nameEl.className = 'username';
        nameEl.textContent = msg.username || 'Unknown';

        const timeEl = document.createElement('div');
        timeEl.className = 'timestamp';
        timeEl.textContent = this.formatTimestamp(msg.created_at);

        topRow.appendChild(nameEl);
        topRow.appendChild(timeEl);

        const bodyEl = document.createElement('div');
        bodyEl.className = 'message-body';
        bodyEl.textContent = isDeleted ? 'This message was removed by moderation.' : (msg.message || msg.message_text || '');

        div.appendChild(topRow);
        div.appendChild(bodyEl);

        if (canModerate && !isDeleted) {
            const actions = document.createElement('div');
            actions.className = 'message-actions';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'message-action message-action--danger';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => this.deleteMessage(msg.id));

            const banBtn = document.createElement('button');
            banBtn.type = 'button';
            banBtn.className = 'message-action';
            banBtn.textContent = 'Ban';
            banBtn.addEventListener('click', () => this.banUserFromMessage(msg));

            const historyBtn = document.createElement('button');
            historyBtn.type = 'button';
            historyBtn.className = 'message-action';
            historyBtn.textContent = 'History';
            historyBtn.addEventListener('click', () => this.openMessageHistory(msg.user_id));

            actions.appendChild(deleteBtn);
            actions.appendChild(banBtn);
            actions.appendChild(historyBtn);
            div.appendChild(actions);
        }

        chatBox.appendChild(div);

        if (scroll) this.scrollToBottom();
    }

    clearMessages() {
        const chatBox = document.getElementById('chatBox');
        if (chatBox) chatBox.innerHTML = '<div class="no-messages">Select a room to start chatting.</div>';
        const title = document.getElementById('roomTitle');
        if (title) title.textContent = 'Select a room';
        const desc = document.getElementById('roomDescription');
        if (desc) desc.textContent = '';
        const deleteBtn = document.getElementById('deleteRoomBtn');
        if (deleteBtn) deleteBtn.style.display = 'none';
    }

    markMessageDeleted(messageId, roomId) {
        const activeRoom = this.activeRoomId;
        if (roomId && activeRoom && String(roomId) !== String(activeRoom)) return;
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) {
            if (activeRoom && String(roomId) === String(activeRoom)) {
                this.loadMessages(activeRoom);
            }
            return;
        }
        messageEl.classList.add('deleted');
        const bodyEl = messageEl.querySelector('.message-body');
        if (bodyEl) bodyEl.textContent = 'This message was removed by moderation.';
        const actions = messageEl.querySelector('.message-actions');
        if (actions) actions.remove();
    }

    handleBannedUser() {
        const sendBtn = document.getElementById('sendButton');
        const input = document.getElementById('messageInput');
        if (sendBtn) sendBtn.disabled = true;
        if (input) input.disabled = true;
    }

    authHeaders() {
        const userId = localStorage.getItem('support_user_id');
        const password = localStorage.getItem('support_password');
        return {
            'Content-Type': 'application/json',
            'X-User-ID': userId || '',
            'X-Password': password || '',
        };
    }

    async deleteMessage(messageId) {
        if (!this.isAdmin()) return false;
        try {
            const res = await fetch(`${this.baseURL}/api/admin/messages/${messageId}`, {
                method: 'DELETE',
                headers: this.authHeaders(),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Failed to delete message');
            }
            return true;
        } catch (err) {
            this.showNotification(err.message, 'error');
            return false;
        }
    }

    async banUserFromMessage(msg) {
        if (!this.isAdmin() || !msg?.user_id) return false;
        const reason = window.prompt('Ban reason', 'Support chat policy violation');
        if (reason === null) return false;
        const duration = window.prompt('Ban duration in minutes, leave blank for permanent', '60');
        const isPermanent = duration === '';
        try {
            const res = await fetch(`${this.baseURL}/api/admin/users/${msg.user_id}/ban`, {
                method: 'POST',
                headers: this.authHeaders(),
                body: JSON.stringify({
                    reason: reason || 'Support chat policy violation',
                    duration_minutes: isPermanent ? null : Number(duration),
                    is_permanent: isPermanent,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Failed to ban user');
            }
            this.showNotification('User banned', 'success');
            return true;
        } catch (err) {
            this.showNotification(err.message, 'error');
            return false;
        }
    }

    async openMessageHistory(userId) {
        if (!this.isAdmin() || !userId) return;
        try {
            const res = await fetch(`${this.baseURL}/api/admin/users/${userId}/messages`, {
                headers: this.authHeaders(),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Failed to load history');
            }
            const data = await res.json();
            const lines = (data.messages || []).slice(0, 8).map(message => {
                const roomName = message.room_name || `Room ${message.room_id}`;
                return `${roomName}: ${message.message || ''}`;
            });
            this.showNotification(lines.length ? lines.join(' | ') : 'No message history found', 'success');
        } catch (err) {
            this.showNotification(err.message, 'error');
        }
    }

    async loadBannedUsers() {
        if (!this.isAdmin()) return [];
        try {
            const res = await fetch(`${this.baseURL}/api/admin/users/banned`, {
                headers: this.authHeaders(),
            });
            if (!res.ok) return [];
            const data = await res.json();
            return data.users || [];
        } catch {
            return [];
        }
    }

    async unbanUser(userId) {
        if (!this.isAdmin()) return false;
        try {
            const res = await fetch(`${this.baseURL}/api/admin/users/${userId}/unban`, {
                method: 'POST',
                headers: this.authHeaders(),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Failed to unban user');
            }
            return true;
        } catch (err) {
            this.showNotification(err.message, 'error');
            return false;
        }
    }

    async sendMessage(text) {
        if (!text || !text.trim()) return false;
        const user = this.getCurrentUser();
        if (!user) { this.showNotification('Please log in to send messages', 'error'); return false; }
        if (!this.activeRoomId) { this.showNotification('Select a room first', 'error'); return false; }

        try {
            const res = await fetch(`${this.baseURL}/api/v1/support/rooms/${this.activeRoomId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_text: text.trim(), user_id: user.id })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to send');
            }
            // Message will arrive via socket event - no manual append needed
            // But if socket is disconnected, reload manually
            if (!this.socket || !this.socket.connected) {
                setTimeout(() => this.loadMessages(this.activeRoomId), 200);
            }
        const user = this.getCurrentUser();
        return Boolean(user?.isAdmin || (user?.userRoleId && Number(user.userRoleId) >= 3))wNotification(err.message, 'error');
            return false;
        }
    }

    /* ──────────────────── Helpers ──────────────────── */
    isAdmin() {
        // Simple heuristic - the backend does the real check
        // We could store userRoleId, but for now return false (UI only)
        return false;
    }

    updateConnectionStatus(connected = null) {
        const el = document.getElementById('connectionStatus');
        const sendBtn = document.getElementById('sendButton');
        const user = this.getCurrentUser();

        if (connected === null && this.socket) connected = this.socket.connected;

        if (el) {
            const span = el.querySelector('span:last-child');
            if (connected && user) {
                el.className = 'status-indicator connected';
                if (span) span.textContent = 'Connected';
            } else if (connected === null) {
                el.className = 'status-indicator connecting';
                if (span) span.textContent = 'Reconnecting…';
            } else if (!user) {
                el.className = 'status-indicator disconnected';
                if (span) span.textContent = 'Please log in…';
            } else {
                el.className = 'status-indicator disconnected';
                if (span) span.textContent = 'Disconnected';
            }
        }
        if (sendBtn) {
            sendBtn.disabled = !(connected && user && this.activeRoomId);
        }
    }

    formatTimestamp(ts) {
        if (!ts) return '';
        let date;
        try {
            let s = String(ts).trim();
            // Normalize SQL datetime
            s = s.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/, '$1T$2');
            // Trim excess fractional seconds
            s = s.replace(/(\.\d{3})\d+/, '$1');
            date = new Date(s);
            if (isNaN(date)) date = new Date(s + 'Z');
        } catch { date = null; }
        if (!date || isNaN(date.getTime())) return '';

        const diffMin = Math.floor((Date.now() - date) / 60000);
        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    scrollToBottom() {
        const chatBox = document.getElementById('chatBox');
        if (chatBox) requestAnimationFrame(() => { chatBox.scrollTop = chatBox.scrollHeight; });
    }

    escapeHTML(str) {
        if (!str) return '';
        const el = document.createElement('span');
        el.textContent = str;
        return el.innerHTML;
    }

    showNotification(message, type = 'error') {
        // Reuse or create a toast element
        let toast = document.getElementById('supportToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'supportToast';
            toast.style.cssText = 'position:fixed;top:16px;right:16px;z-index:1000;padding:12px 18px;border-radius:8px;font-size:.9rem;font-weight:500;box-shadow:0 4px 14px rgba(0,0,0,.15);transition:opacity .3s;max-width:340px;';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.background = type === 'error' ? '#dc3545' : '#28a745';
        toast.style.color = '#fff';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 4000);
    }

    isConnected() { return this.socket && this.socket.connected; }
    canChat() { return !!this.getCurrentUser(); }
    destroy() { if (this.socket) this.socket.disconnect(); }
}

window.SupportChatSystem = SupportChatSystem;
