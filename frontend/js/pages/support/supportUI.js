/**
 * Support UI - Handles user interface interactions for multi-room support chat
 */
class SupportUI {
    constructor() {
        this.authSystem = null;
        this.chat = null;
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            // Auth system
            this.authSystem = new SupportAuthSystem();

            // Chat system
            this.chat = new SupportChatSystem();

            this.bindUI();
            this.bindUserDisplay();
        });
    }

    /* ───────── Core UI bindings ───────── */
    bindUI() {
        // Send message (form submit + Enter key)
        const form = document.getElementById('messageForm');
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendButton');

        if (form) {
            form.addEventListener('submit', (e) => { e.preventDefault(); this.handleSend(); });
        }
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend(); }
            });
            // Enable/disable send button
            input.addEventListener('input', () => {
                if (sendBtn) sendBtn.disabled = !input.value.trim() || !this.chat?.activeRoomId;
            });
            // Auto-resize
            input.addEventListener('input', function () {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (this.authSystem) this.authSystem.logout();
            });
        }

        // Mobile sidebar toggle
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const sidebarClose = document.getElementById('sidebarClose');

        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => sidebar.classList.add('open'));
        }
        if (sidebarClose && sidebar) {
            sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));
        }

        // Create room modal
        const createRoomBtn = document.getElementById('createRoomBtn');
        const createRoomModal = document.getElementById('createRoomModal');
        const createRoomClose = document.getElementById('createRoomClose');
        const createRoomCancel = document.getElementById('createRoomCancel');
        const createRoomForm = document.getElementById('createRoomForm');

        if (createRoomBtn && createRoomModal) {
            createRoomBtn.addEventListener('click', () => { createRoomModal.style.display = 'flex'; });
        }
        if (createRoomClose && createRoomModal) {
            createRoomClose.addEventListener('click', () => { createRoomModal.style.display = 'none'; });
        }
        if (createRoomCancel && createRoomModal) {
            createRoomCancel.addEventListener('click', () => { createRoomModal.style.display = 'none'; });
        }
        // Close modal on overlay click
        if (createRoomModal) {
            createRoomModal.addEventListener('click', (e) => {
                if (e.target === createRoomModal) createRoomModal.style.display = 'none';
            });
        }
        if (createRoomForm) {
            createRoomForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('roomNameInput')?.value.trim();
                const desc = document.getElementById('roomDescInput')?.value.trim();
                const priv = document.getElementById('roomPrivateCheck')?.checked || false;

                if (!name || name.length < 2) {
                    this.chat?.showNotification('Room name must be at least 2 characters', 'error');
                    return;
                }

                const roomId = await this.chat?.createRoom(name, desc, priv);
                if (roomId) {
                    createRoomForm.reset();
                    if (createRoomModal) createRoomModal.style.display = 'none';
                }
            });
        }

        // Delete room
        const deleteBtn = document.getElementById('deleteRoomBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (!this.chat?.activeRoomId) return;
                const room = this.chat.rooms.find(r => r.id === this.chat.activeRoomId);
                const roomName = room ? room.name : 'this room';
                if (confirm(`Delete "${roomName}"? This cannot be undone.`)) {
                    this.chat.deleteRoom(this.chat.activeRoomId);
                }
            });
        }
    }

    /* ───────── User display ───────── */
    bindUserDisplay() {
        document.addEventListener('userAuthenticated', (e) => {
            this.showUser(e.detail.user.fullName);
        });
        document.addEventListener('userLoggedOut', () => {
            this.hideUser();
        });

        // Delayed check after auth system initialises
        setTimeout(() => this.checkUser(), 600);
        setTimeout(() => this.checkUser(), 2000);
    }

    checkUser() {
        if (this.authSystem?.getCurrentUser()) {
            this.showUser(this.authSystem.getCurrentUser().fullName);
            return;
        }
        const fn = localStorage.getItem('support_first_name');
        const ln = localStorage.getItem('support_last_name');
        if (fn && ln) this.showUser(`${fn} ${ln}`);
        else this.hideUser();
    }

    showUser(name) {
        const el = document.getElementById('sidebarUser');
        const nameEl = document.getElementById('sidebarUserName');
        if (el) el.style.display = 'block';
        if (nameEl) nameEl.textContent = `👤 ${name}`;
    }

    hideUser() {
        const el = document.getElementById('sidebarUser');
        if (el) el.style.display = 'none';
    }

    /* ───────── Send helper ───────── */
    async handleSend() {
        const input = document.getElementById('messageInput');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        if (!this.chat) return;

        const ok = await this.chat.sendMessage(text);
        if (ok) {
            input.value = '';
            input.style.height = 'auto';
            const sendBtn = document.getElementById('sendButton');
            if (sendBtn) sendBtn.disabled = true;
        }
    }
}

// Boot
const supportUI = new SupportUI();

window.addEventListener('beforeunload', () => {
    if (supportUI.chat) supportUI.chat.destroy();
});