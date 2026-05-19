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
      autoConnect: true,
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
      room_ids: this.rooms.map((room) => room.id),
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
          const global = this.rooms.find((r) => r.id === 1) || this.rooms[0];
          this.selectRoom(global.id);
        }
      });
      this.updateConnectionStatus();
    });

    document.addEventListener('userLoggedOut', () => {
      this.currentUser = null;
      this.rooms = [];
      this.activeRoomId = null;
      this.joinedSocketRooms.forEach((r) => this.socket.emit('leave', r));
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
      list.innerHTML =
        '<div style="text-align:center;padding:20px;opacity:.6;font-size:.85rem;">No rooms available</div>';
      return;
    }

    for (const room of this.rooms) {
      const card = document.createElement('div');
      card.className = `room-card${room.id === this.activeRoomId ? ' active' : ''}`;
      card.dataset.roomId = room.id;

      const icon = room.is_private
        ? '<i class="fa-solid fa-lock room-card-icon__glyph" aria-hidden="true"></i>'
        : room.id === 1
          ? '<i class="fa-solid fa-earth-americas room-card-icon__glyph" aria-hidden="true"></i>'
          : '<i class="fa-solid fa-comments room-card-icon__glyph" aria-hidden="true"></i>';
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

    const room = this.rooms.find((r) => r.id === roomId);
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
      const canDelete =
        room.id !== 1 && user && (String(room.created_by) === String(user.id) || this.isAdmin());
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
        body: JSON.stringify({ name, description, is_private: isPrivate, user_id: user.id }),
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
        method: 'DELETE',
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
      const res = await fetch(
        `${this.baseURL}/api/v1/support/rooms/${roomId}/messages?user_id=${user.id}`
      );
      if (!res.ok) {
        if (res.status === 403) {
          chatBox.innerHTML =
            '<div class="no-messages"><i class="fa-solid fa-lock inline-status-icon" aria-hidden="true"></i> You don\'t have access to this room.</div>';
          return;
        }
        throw new Error('Failed to load messages');
      }
      const data = await res.json();
      const messages = data.messages || [];

      chatBox.innerHTML = '';
      if (!messages.length) {
        chatBox.innerHTML =
          '<div class="no-messages">No messages yet. Start the conversation!</div>';
      } else {
        for (const msg of messages) {
          this.appendMessage(msg, false);
        }
      }
      this.scrollToBottom();
    } catch (err) {
      console.error('loadMessages error:', err);
      chatBox.innerHTML =
        '<div class="no-messages">Unable to load messages. Try again later.</div>';
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
    bodyEl.textContent = isDeleted
      ? 'This message was removed by moderation.'
      : msg.message || msg.message_text || '';

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
    if (chatBox)
      chatBox.innerHTML = '<div class="no-messages">Select a room to start chatting.</div>';
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
      const res = await fetch(`${this.baseURL}/api/v1/admin/messages/${messageId}`, {
        method: 'DELETE',
        headers: this.authHeaders(),
      });
      if (!res.ok) {
        let bodyText = null;
        try {
          const json = await res.json().catch(() => null);
          bodyText = json;
        } catch (e) {
          try {
            bodyText = await res.text();
          } catch (_) {
            bodyText = null;
          }
        }
        console.error('deleteMessage failed', {
          status: res.status,
          body: bodyText,
          messageId,
          headers: this.authHeaders(),
        });
        // Surface a clearer error to the UI
        const errDetail =
          (bodyText && bodyText.detail) ||
          (typeof bodyText === 'string' && bodyText) ||
          'Failed to delete message';
        throw new Error(errDetail || `Delete failed (${res.status})`);
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
      const res = await fetch(`${this.baseURL}/api/v1/admin/users/${msg.user_id}/ban`, {
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
      const res = await fetch(`${this.baseURL}/api/v1/admin/users/${userId}/messages`, {
        headers: this.authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to load history');
      }
      const data = await res.json();
      const lines = (data.messages || []).slice(0, 8).map((message) => {
        const roomName = message.room_name || `Room ${message.room_id}`;
        return `${roomName}: ${message.message || ''}`;
      });
      this.showNotification(
        lines.length ? lines.join(' | ') : 'No message history found',
        'success'
      );
    } catch (err) {
      this.showNotification(err.message, 'error');
    }
  }

  async loadBannedUsers() {
    if (!this.isAdmin()) return [];
    try {
      const res = await fetch(`${this.baseURL}/api/v1/admin/users/banned`, {
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
      const res = await fetch(`${this.baseURL}/api/v1/admin/users/${userId}/unban`, {
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
    if (!user) {
      this.showNotification('Please log in to send messages', 'error');
      return false;
    }
    if (!this.activeRoomId) {
      this.showNotification('Select a room first', 'error');
      return false;
    }

    try {
      const res = await fetch(
        `${this.baseURL}/api/v1/support/rooms/${this.activeRoomId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_text: text.trim(), user_id: user.id }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to send');
      }
      // Message will arrive via socket event - no manual append needed
      // But if socket is disconnected, reload manually
      if (!this.socket || !this.socket.connected) {
        setTimeout(() => this.loadMessages(this.activeRoomId), 200);
      }
      return true;
    } catch (err) {
      this.showNotification(err.message, 'error');
      return false;
    }
  }

  /* ──────────────────── Helpers ──────────────────── */
  isAdmin() {
    const user = this.getCurrentUser();
    return Boolean(user?.isAdmin || (user?.userRoleId && Number(user.userRoleId) >= 3));
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
    } catch {
      date = null;
    }
    if (!date || isNaN(date.getTime())) return '';

    const diffMin = Math.floor((Date.now() - date) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  }

  scrollToBottom() {
    const chatBox = document.getElementById('chatBox');
    if (chatBox)
      requestAnimationFrame(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
      });
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
      toast.style.cssText =
        'position:fixed;top:16px;right:16px;z-index:1000;padding:12px 18px;border-radius:8px;font-size:.9rem;font-weight:500;box-shadow:0 4px 14px rgba(0,0,0,.15);transition:opacity .3s;max-width:340px;';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.background = type === 'error' ? '#dc3545' : '#28a745';
    toast.style.color = '#fff';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
    }, 4000);
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }
  canChat() {
    return !!this.getCurrentUser();
  }
  destroy() {
    if (this.socket) this.socket.disconnect();
  }
}

window.SupportChatSystem = SupportChatSystem;
