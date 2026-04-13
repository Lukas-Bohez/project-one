/**
 * Quiz The Spire - Hub & Spire AI Collaboration
 * Central hub: play (with multi-theme picker), community, create, CSV upload, admin review
 */

(function () {
    'use strict';

    // ── Config ──
    const API_BASE = `https://${window.location.hostname}/api/v1`;
    const COMMUNITY_API = `${API_BASE}/community`;
    const QUIZ_PAGE = '/pages/quiz/';

    const STORAGE_KEYS = {
        USER_ID: 'user_user_id',
        FIRST_NAME: 'user_first_name',
        LAST_NAME: 'user_last_name',
        PASSWORD: 'user_password'
    };

    let currentUser = null;
    let activeThemeId = null;
    let myThemes = [];
    let sessionRefreshInterval = null;

    // Multi-theme picker state
    const selectedThemes = new Set();
    const selectedThemeData = new Map(); // key → { id, type, name }
    let officialThemes = [];
    let communityThemes = [];
    let currentPickerTab = 'official';

    // ── Helpers ──
    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    function api(endpoint, opts = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${COMMUNITY_API}${endpoint}`;
        const headers = { 'Accept': 'application/json', ...opts.headers };
        if (!(opts.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        if (currentUser) {
            headers['X-User-ID'] = String(currentUser.id);
            // Send password for authentication
            const storedPassword = localStorage.getItem('sai_password') || localStorage.getItem(STORAGE_KEYS.PASSWORD);
            if (storedPassword) {
                headers['X-Password'] = storedPassword;
            }
        }
        return fetch(url, { ...opts, headers })
            .then(async r => {
                const data = await r.json().catch(() => null);
                if (!r.ok) throw { status: r.status, detail: data?.detail || r.statusText };
                return data;
            });
    }

    function apiRaw(endpoint, opts = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
        return fetch(url, opts).then(async r => {
            const data = await r.json().catch(() => null);
            if (!r.ok) throw { status: r.status, detail: data?.detail || r.statusText };
            return data;
        });
    }

    // ── Toast ──
    function toast(msg, type = 'info') {
        let container = $('#sai-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'sai-toast-container';
            container.className = 'sai-toast-container';
            document.body.appendChild(container);
        }
        const el = document.createElement('div');
        el.className = `sai-toast sai-toast--${type}`;
        el.textContent = msg;
        container.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function escAttr(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                          .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderStars(avg) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            html += `<i class="fa${i <= Math.round(avg) ? 's' : 'r'} fa-star"></i>`;
        }
        return html;
    }

    // ── Auth ──
    function getStoredUser() {
        const id = localStorage.getItem(STORAGE_KEYS.USER_ID);
        const fn = localStorage.getItem(STORAGE_KEYS.FIRST_NAME);
        const ln = localStorage.getItem(STORAGE_KEYS.LAST_NAME);
        const pw = localStorage.getItem(STORAGE_KEYS.PASSWORD);

        const looksLikePlaceholder = String(fn || '').toLowerCase() === 'gamepad' &&
            String(ln || '').toLowerCase() === 'user';
        if (looksLikePlaceholder) {
            localStorage.removeItem(STORAGE_KEYS.USER_ID);
            localStorage.removeItem(STORAGE_KEYS.FIRST_NAME);
            localStorage.removeItem(STORAGE_KEYS.LAST_NAME);
            localStorage.removeItem(STORAGE_KEYS.PASSWORD);
            localStorage.removeItem('sai_password');
            return null;
        }

        if (id && fn && ln) return { id, firstName: fn, lastName: ln, password: pw };
        return null;
    }

    function storeUser(id, firstName, lastName, password) {
        localStorage.setItem(STORAGE_KEYS.USER_ID, id);
        localStorage.setItem(STORAGE_KEYS.FIRST_NAME, firstName);
        localStorage.setItem(STORAGE_KEYS.LAST_NAME, lastName);
        if (password) {
            localStorage.setItem(STORAGE_KEYS.PASSWORD, password);
            localStorage.setItem('sai_password', password);
        }
    }

    async function doLogin(firstName, lastName, password) {
        // Use community auth endpoint - password is optional
        const body = { first_name: firstName, last_name: lastName };
        if (password) body.password = password;
        const r = await fetch(`${COMMUNITY_API}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!r.ok) throw new Error('Login failed');
        const data = await r.json();
        if (data.user_id) {
            storeUser(data.user_id, firstName, lastName, password);
            currentUser = { id: data.user_id, firstName, lastName };
            return true;
        }
        throw new Error('Login failed');
    }

    async function doRegister(firstName, lastName, password) {
        // Use community auth endpoint - password is optional, creates account if needed
        const body = { first_name: firstName, last_name: lastName };
        if (password) body.password = password;
        const r = await fetch(`${COMMUNITY_API}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!r.ok) throw new Error('Registration failed');
        const data = await r.json();
        if (data.user_id) {
            storeUser(data.user_id, firstName, lastName, password);
            currentUser = { id: data.user_id, firstName, lastName };
            return true;
        }
        throw new Error('Registration failed');
    }

    function showApp() {
        $('#loginModal').classList.remove('sai-modal--active');
        $('#mainApp').style.display = '';
        const display = $('#userDisplayName');
        if (display) {
            const span = display.querySelector('span');
            if (span) span.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        }
        loadPlayTab();
    }

    function logout() {
        if (sessionRefreshInterval) { clearInterval(sessionRefreshInterval); sessionRefreshInterval = null; }
        if (hubSocket) { hubSocket.disconnect(); hubSocket = null; }
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('sai_password');
        currentUser = null;
        location.reload();
    }

    async function autoLogin() {
        const stored = getStoredUser();
        if (stored && stored.id && stored.firstName && stored.lastName) {
            try {
                await doLogin(stored.firstName, stored.lastName, stored.password || null);
                showApp();
            } catch {
                // stored credentials invalid - show login modal
            }
        }
    }

    // ══════════════════════════════════════
    //  TAB NAVIGATION
    // ══════════════════════════════════════
    window.switchTab = function (tabId) {
        // Clear play tab polling when navigating away
        if (tabId !== 'play' && sessionRefreshInterval) {
            clearInterval(sessionRefreshInterval);
            sessionRefreshInterval = null;
        }

        $$('.sai-tab').forEach(t => t.classList.remove('sai-tab--active'));
        $$('.sai-nav-btn').forEach(b => b.classList.remove('sai-nav-btn--active'));
        const tab = $(`#tab-${tabId}`);
        const btn = $(`.sai-nav-btn[data-tab="${tabId}"]`);
        if (tab) tab.classList.add('sai-tab--active');
        if (btn) btn.classList.add('sai-nav-btn--active');

        if (tabId === 'play') loadPlayTab();
        if (tabId === 'explore') loadExploreTab();
        if (tabId === 'my-themes') loadMyThemes();
        if (tabId === 'csv-upload') loadCsvThemeSelect();
        if (tabId === 'paste-text') loadPasteThemeSelect();
        if (tabId === 'create') resetCreateTab();
    };

    // ══════════════════════════════════════
    //  PLAY TAB - Sessions + Theme Picker
    // ══════════════════════════════════════
    async function loadPlayTab() {
        loadActiveSessions();
        loadStats();
        loadThemePicker();
        if (sessionRefreshInterval) clearInterval(sessionRefreshInterval);
        sessionRefreshInterval = setInterval(loadActiveSessions, 5000);
    }

    // ── Active Sessions ──
    async function loadActiveSessions() {
        const container = $('#activeSessionsList');
        try {
            const response = await apiRaw('/sessions/active');
            const sessions = response?.sessions || [];
            const sessionIds = response?.active_session_ids || [];

            const liveEl = $('#statLive');
            if (liveEl) liveEl.textContent = sessionIds.length;

            if (sessions.length === 0) {
                while (container.firstChild) container.removeChild(container.firstChild);
                const noEl = document.createElement('div');
                noEl.className = 'sai-no-sessions';
                const icon = document.createElement('i'); icon.className = 'fas fa-satellite-dish';
                const h3 = document.createElement('h3'); h3.textContent = 'No active sessions right now';
                const p = document.createElement('p'); p.textContent = 'Start a new quiz below or wait for someone to create one!';
                noEl.appendChild(icon); noEl.appendChild(h3); noEl.appendChild(p);
                container.appendChild(noEl);
                return;
            }

            while (container.firstChild) container.removeChild(container.firstChild);
            const frag = document.createDocumentFragment();
            sessions.forEach(s => {
                const phaseLabel = { voting: 'Voting', theme_display: 'Theme Reveal', quiz: 'Playing' }[s.phase] || 'Waiting';
                const phaseClass = { voting: 'voting', theme_display: 'playing', quiz: 'playing' }[s.phase] || 'waiting';

                const card = document.createElement('div'); card.className = 'sai-session-card';

                const header = document.createElement('div'); header.className = 'sai-session-card__header';
                const title = document.createElement('span'); title.className = 'sai-session-card__title'; title.textContent = (typeof esc === 'function') ? esc(s.name) : s.name;
                const live = document.createElement('span'); live.className = 'sai-session-card__live'; live.textContent = 'Live';
                header.appendChild(title); header.appendChild(live);

                const meta = document.createElement('div'); meta.className = 'sai-session-card__meta';
                const playersSpan = document.createElement('span');
                const usersIcon = document.createElement('i'); usersIcon.className = 'fas fa-users';
                playersSpan.appendChild(usersIcon);
                playersSpan.appendChild(document.createTextNode(' ' + s.player_count + ' player' + (s.player_count !== 1 ? 's' : '')));
                meta.appendChild(playersSpan);

                if (s.theme_name) {
                    const themeSpan = document.createElement('span');
                    const pal = document.createElement('i'); pal.className = 'fas fa-palette';
                    themeSpan.appendChild(pal);
                    themeSpan.appendChild(document.createTextNode(' ' + ((typeof esc === 'function') ? esc(s.theme_name) : s.theme_name)));
                    meta.appendChild(themeSpan);
                } else if (s.theme_count > 0) {
                    const themeSpan = document.createElement('span');
                    const pal = document.createElement('i'); pal.className = 'fas fa-palette';
                    themeSpan.appendChild(pal);
                    themeSpan.appendChild(document.createTextNode(' ' + s.theme_count + ' themes'));
                    meta.appendChild(themeSpan);
                }

                const phaseSpan = document.createElement('span'); phaseSpan.className = 'sai-session-card__phase sai-phase--' + phaseClass; phaseSpan.textContent = phaseLabel;
                meta.appendChild(phaseSpan);

                const actions = document.createElement('div'); actions.className = 'sai-session-card__actions';
                const joinBtn = document.createElement('button'); joinBtn.className = 'sai-btn sai-btn--success sai-btn--sm';
                const playIcon = document.createElement('i'); playIcon.className = 'fas fa-play';
                joinBtn.appendChild(playIcon);
                joinBtn.appendChild(document.createTextNode(' Join'));
                joinBtn.addEventListener('click', function () { joinActiveQuiz(s.id); });
                actions.appendChild(joinBtn);

                card.appendChild(header);
                card.appendChild(meta);
                card.appendChild(actions);
                frag.appendChild(card);
            });
            container.appendChild(frag);
        } catch {
            while (container.firstChild) container.removeChild(container.firstChild);
            const noEl = document.createElement('div');
            noEl.className = 'sai-no-sessions';
            const icon = document.createElement('i'); icon.className = 'fas fa-satellite-dish';
            const h3 = document.createElement('h3'); h3.textContent = 'No active sessions';
            const p = document.createElement('p'); p.textContent = 'Start a new quiz below to begin playing';
            noEl.appendChild(icon); noEl.appendChild(h3); noEl.appendChild(p);
            container.appendChild(noEl);
        }
    }

    window.joinActiveQuiz = async function (sessionId, themeId) {
        if (!currentUser || !currentUser.id) {
            toast('Please log in before joining a quiz', 'error');
            $('#loginModal')?.classList.add('sai-modal--active');
            return;
        }

        const createSession = async (themeIds) => {
            const result = await apiRaw('/sessions/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    theme_ids: themeIds,
                    user_id: currentUser.id
                })
            });

            if (!result || !result.session_id) {
                throw new Error('Session creation failed');
            }

            sessionStorage.setItem('quiz_session_id', String(result.session_id));
            window.location.href = `${QUIZ_PAGE}?session=${result.session_id}`;
        };

        if (sessionId) {
            sessionStorage.setItem('quiz_session_id', String(sessionId));
            window.location.href = `${QUIZ_PAGE}?session=${sessionId}`;
            return;
        }

        if (themeId) {
            try {
                await createSession([themeId]);
                return;
            } catch (error) {
                console.error('Failed to create quiz session from theme detail:', error);
                toast(error.detail || error.message || 'Failed to create quiz session', 'error');
                return;
            }
        }

        try {
            // If there are active sessions, join one at random first.
            const active = await apiRaw('/sessions/active');
            const activeIds = Array.isArray(active?.active_session_ids) ? active.active_session_ids : [];
            if (activeIds.length > 0) {
                const randomSessionId = activeIds[Math.floor(Math.random() * activeIds.length)];
                sessionStorage.setItem('quiz_session_id', String(randomSessionId));
                window.location.href = `${QUIZ_PAGE}?session=${randomSessionId}`;
                return;
            }

            // No active sessions: create one with all available themes (official + community).
            const seenThemeIds = new Set();
            const addThemes = (themes) => {
                (Array.isArray(themes) ? themes : []).forEach((theme) => {
                    const id = parseInt(theme?.id, 10);
                    if (Number.isInteger(id) && id > 0) {
                        seenThemeIds.add(id);
                    }
                });
            };

            addThemes(officialThemes);
            addThemes(communityThemes);

            if (seenThemeIds.size === 0) {
                try {
                    const allThemes = await api('/themes');
                    addThemes(allThemes);
                } catch (e) {
                    console.warn('Could not load /community/themes for auto-join creation:', e);
                }
            }

            const themeIds = Array.from(seenThemeIds);
            if (themeIds.length === 0) {
                toast('No themes available to create a quiz session.', 'error');
                return;
            }

            await createSession(themeIds);
        } catch (error) {
            console.error('Join Quiz failed:', error);
            toast(error.detail || error.message || 'Failed to join or create a quiz session', 'error');
        }
    };

    // ── Stats ──
    async function loadStats() {
        try {
            const stats = await api('/admin/stats');
            if (stats.total_themes !== undefined) {
                const el = id => $(id);
                if (el('#statThemes')) el('#statThemes').textContent = stats.total_themes || 0;
                if (el('#statPlays')) el('#statPlays').textContent = stats.total_plays || 0;
                if (el('#statCreators')) el('#statCreators').textContent = stats.total_creators || 0;
                // Show stats bar only when data loaded
                const bar = $('#statsBar');
                if (bar) bar.style.display = '';
            }
        } catch {
            // Stats require admin - keep the bar hidden for non-admin users
        }
    }

    // ══════════════════════════════════════
    //  THEME PICKER - Multi-Select
    // ══════════════════════════════════════
    async function loadThemePicker() {
        const grid = $('#themePickerGrid');
        grid.innerHTML = '<div class="sai-spinner"></div>';

        // Fetch official themes and community themes in parallel
        try {
            const [officialRes, communityRes] = await Promise.allSettled([
                apiRaw('/themes/'),
                api('/themes?status=approved')
            ]);

            officialThemes = officialRes.status === 'fulfilled' ? (officialRes.value || []) : [];
            communityThemes = communityRes.status === 'fulfilled' ? (communityRes.value || []) : [];

            // If official themes came as an object with themes array, unwrap
            if (officialThemes && !Array.isArray(officialThemes) && officialThemes.themes) {
                officialThemes = officialThemes.themes;
            }
            if (!Array.isArray(officialThemes)) officialThemes = [];
            if (!Array.isArray(communityThemes)) communityThemes = [];

        } catch {
            officialThemes = [];
            communityThemes = [];
        }

        renderPickerGrid();
    }

    function renderPickerGrid() {
        const grid = $('#themePickerGrid');
        const themes = currentPickerTab === 'official' ? officialThemes : communityThemes;

        if (!themes || themes.length === 0) {
            const label = currentPickerTab === 'official' ? 'official' : 'community';
            grid.innerHTML = `
                <div class="sai-picker-empty">
                    <i class="fas fa-inbox"></i>
                    <p>No ${label} themes available yet.</p>
                </div>`;
            return;
        }

        grid.innerHTML = themes.map(t => {
            const id = t.id || t.theme_id;
            const key = `${currentPickerTab}-${id}`;
            const isSelected = selectedThemes.has(key);
            const name = t.name || t.theme_name || 'Untitled';
            const qCount = t.question_count || t.questions_count || 0;
            const source = currentPickerTab === 'official' ? 'Official' : (t.creator_name || 'Community');

            return `
                <div class="sai-picker-card ${isSelected ? 'sai-picker-card--selected' : ''}"
                     onclick="toggleThemeSelection('${key}', this)"
                     data-theme-key="${key}"
                     data-theme-id="${id}"
                     data-theme-type="${currentPickerTab}"
                     data-theme-name="${escAttr(name)}">
                    <div class="sai-picker-card__name">${esc(name)}</div>
                    <div class="sai-picker-card__info">
                        <span><i class="fas fa-question-circle"></i> ${qCount}</span>
                        <span><i class="fas fa-${currentPickerTab === 'official' ? 'crown' : 'users'}"></i> ${esc(source)}</span>
                    </div>
                </div>`;
        }).join('');
    }

    window.toggleThemeSelection = function (key, el) {
        if (selectedThemes.has(key)) {
            selectedThemes.delete(key);
            selectedThemeData.delete(key);
            el.classList.remove('sai-picker-card--selected');
        } else {
            selectedThemes.add(key);
            selectedThemeData.set(key, {
                id: el.dataset.themeId,
                type: el.dataset.themeType,
                name: el.dataset.themeName
            });
            el.classList.add('sai-picker-card--selected');
        }
        updateSelectedCount();
    };

    function updateSelectedCount() {
        const countEl = $('#selectedThemeCount');
        const btn = $('#startSessionBtn');
        const count = selectedThemes.size;
        countEl.textContent = `${count} selected`;
        btn.disabled = count === 0;
    }

    function setupPickerTabs() {
        $$('.sai-picker-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                $$('.sai-picker-tab').forEach(t => t.classList.remove('sai-picker-tab--active'));
                tab.classList.add('sai-picker-tab--active');
                currentPickerTab = tab.dataset.picker;
                renderPickerGrid();
            });
        });
    }

    function setupStartSession() {
        const btn = $('#startSessionBtn');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            if (selectedThemes.size === 0) return toast('Select at least one theme', 'error');

            // Gather selected theme IDs from the stored Map (not DOM - other tab cards may not exist)
            const themeIds = [];
            const themeData = [];
            selectedThemeData.forEach((meta, key) => {
                themeIds.push(parseInt(meta.id, 10));
                themeData.push({
                    id: meta.id,
                    type: meta.type,
                    name: meta.name
                });
            });

            if (themeIds.length === 0) return toast('No valid themes selected', 'error');

            // Create session on the backend with selected themes
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating session…';

            try {
                const result = await apiRaw('/sessions/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        theme_ids: themeIds,
                        user_id: currentUser.id
                    })
                });

                // Also store in sessionStorage as fallback
                sessionStorage.setItem('quiz_selected_themes', JSON.stringify(themeData));
                sessionStorage.setItem('quiz_session_id', String(result.session_id));

                toast(`Session created with ${result.theme_count} theme${result.theme_count > 1 ? 's' : ''} - voting starts now!`, 'success');

                // Navigate to quiz page with session ID
                setTimeout(() => {
                    window.location.href = `${QUIZ_PAGE}?session=${result.session_id}`;
                }, 500);

            } catch (err) {
                console.error('Session creation failed:', err);
                toast(err.detail || 'Failed to create session', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-rocket"></i> Start Quiz with Selected Themes';
            }
        });
    }

    // ══════════════════════════════════════
    //  EXPLORE TAB - Community Themes + Admin Review
    // ══════════════════════════════════════
    async function loadExploreTab() {
        try {
            const themes = await api('/themes?status=approved');
            renderThemeGrid('#exploreGrid', themes || [], false);
        } catch {
            try {
                const all = await api('/themes');
                renderThemeGrid('#exploreGrid', all || [], false);
            } catch (e) {
                console.warn('Failed to load themes:', e);
            }
        }
        loadAdminReviewBanner();
    }

    async function loadAdminReviewBanner() {
        try {
            const pending = await api('/admin/pending');
            if (!pending || pending.length === 0) {
                const existing = $('#adminReviewBanner');
                if (existing) existing.innerHTML = '';
                return;
            }
            let banner = $('#adminReviewBanner');
            banner.innerHTML = `
                <div class="sai-review-banner">
                    <div class="sai-review-banner__text">
                        <i class="fas fa-gavel"></i>
                        <span>Admin: Community themes pending review</span>
                        <span class="sai-review-banner__count">${pending.length}</span>
                    </div>
                </div>
                ${pending.map(t => `
                    <div class="sai-review-card" id="review-card-${t.id}">
                        <div class="sai-review-card__header">
                            <span class="sai-review-card__title">${esc(t.name)}</span>
                            <span class="sai-theme-card__badge sai-badge--pending">Pending</span>
                        </div>
                        <p class="sai-review-card__desc">${esc(t.description || 'No description')}</p>
                        <div class="sai-review-card__meta">
                            <span><i class="fas fa-user"></i> ${esc(t.creator_name || 'Anonymous')}</span>
                            <span><i class="fas fa-question-circle"></i> ${t.question_count || 0} questions</span>
                            <span><i class="fas fa-calendar"></i> ${t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}</span>
                        </div>
                        <div class="sai-review-card__actions">
                            <button class="sai-btn sai-btn--ghost sai-btn--sm" onclick="previewReviewTheme(${t.id})">
                                <i class="fas fa-eye"></i> Preview
                            </button>
                            <button class="sai-btn sai-btn--success sai-btn--sm" onclick="reviewTheme(${t.id}, 'approve')">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button class="sai-btn sai-btn--danger sai-btn--sm" onclick="reviewTheme(${t.id}, 'reject')">
                                <i class="fas fa-times"></i> Reject
                            </button>
                            <button class="sai-btn sai-btn--primary sai-btn--sm" onclick="promoteTheme(${t.id})" title="Promote to official">
                                <i class="fas fa-crown"></i> Promote
                            </button>
                        </div>
                    </div>
                `).join('')}
            `;
        } catch {
            // Not admin - no review banner
        }
    }

    window.previewReviewTheme = async function (themeId) {
        try {
            const theme = await api(`/themes/${themeId}`);
            const questions = await api(`/themes/${themeId}/questions`);

            const content = $('#themeDetailContent');
            content.innerHTML = `
                <div class="sai-theme-detail__header">
                    <h2>${esc(theme.name)}</h2>
                    <span class="sai-theme-card__badge sai-badge--${theme.status}" style="display:inline-block;margin-top:8px;">${theme.status}</span>
                    <p style="color:var(--sai-text-muted);margin-top:8px;">${esc(theme.description || '')}</p>
                    <div class="sai-theme-detail__stats">
                        <span><i class="fas fa-question-circle"></i> ${(questions || []).length} questions</span>
                        <span><i class="fas fa-user"></i> ${esc(theme.creator_name || 'Anonymous')}</span>
                    </div>
                </div>
                <div class="sai-theme-detail__questions">
                    <h4 style="margin-bottom:12px;">All Questions</h4>
                    ${(questions || []).map((q, i) => `
                        <div class="sai-preview-question">
                            <div class="sai-preview-question__text">${i+1}. ${esc(q.question_text)}</div>
                            ${(q.answers || []).map(a => `
                                <span class="sai-preview-answer ${a.is_correct ? 'sai-preview-answer--correct' : 'sai-preview-answer--wrong'}">
                                    ${a.is_correct ? '✓' : '✗'} ${esc(a.answer_text)}
                                </span>
                            `).join('')}
                            ${q.explanation ? `<p style="font-size:0.8rem;color:var(--sai-text-muted);margin-top:4px;"><em>${esc(q.explanation)}</em></p>` : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="sai-theme-detail__actions">
                    <button class="sai-btn sai-btn--ghost" onclick="closeModal('themeDetailModal')">Close</button>
                </div>
            `;
            $('#themeDetailModal').classList.add('sai-modal--active');
        } catch (e) {
            toast('Failed to load theme preview', 'error');
        }
    };

    window.reviewTheme = async function (themeId, action) {
        const notes = action === 'reject' ? prompt('Rejection reason (optional):') : null;
        try {
            await api(`/admin/review/${themeId}`, {
                method: 'POST',
                body: JSON.stringify({ action, notes: notes || null })
            });
            toast(`Theme ${action === 'approve' ? 'approved' : 'rejected'}!`, action === 'approve' ? 'success' : 'info');
            const card = $(`#review-card-${themeId}`);
            if (card) card.remove();
            loadExploreTab();
        } catch (e) {
            toast('Review failed: ' + (e.detail || ''), 'error');
        }
    };

    window.promoteTheme = async function (themeId) {
        if (!confirm('Promote this community theme to an official quiz theme?')) return;
        try {
            await api(`/admin/promote/${themeId}`, { method: 'POST' });
            toast('Theme promoted to official!', 'success');
            loadExploreTab();
        } catch (e) {
            toast('Promotion failed: ' + (e.detail || ''), 'error');
        }
    };

    function renderThemeGrid(selector, themes, showStatus) {
        const grid = $(selector);
        if (!themes || themes.length === 0) {
            grid.innerHTML = `
                <div class="sai-empty">
                    <i class="fas fa-rocket"></i>
                    <h3>No themes yet</h3>
                    <p>Be the first to create one!</p>
                    <button class="sai-btn sai-btn--primary" onclick="switchTab('create')">
                        <i class="fas fa-plus"></i> Create Theme
                    </button>
                </div>`;
            return;
        }

        grid.innerHTML = themes.map(t => `
            <div class="sai-theme-card" onclick="openThemeDetail(${t.id})">
                <div class="sai-theme-card__header">
                    <h3 class="sai-theme-card__title">${esc(t.name)}</h3>
                    ${showStatus ? `<span class="sai-theme-card__badge sai-badge--${t.status}">${t.status}</span>` : ''}
                </div>
                <p class="sai-theme-card__desc">${esc(t.description || 'No description')}</p>
                <div class="sai-theme-card__meta">
                    <span><i class="fas fa-question-circle"></i> ${t.question_count || 0} questions</span>
                    <span><i class="fas fa-play"></i> ${t.play_count || 0} plays</span>
                </div>
                <div class="sai-theme-card__footer">
                    <div class="sai-theme-card__rating">
                        ${renderStars(t.avg_rating || 0)}
                        <small>(${(t.avg_rating || 0).toFixed(1)})</small>
                    </div>
                    <span class="sai-theme-card__creator"><i class="fas fa-user"></i> ${esc(t.creator_name || 'Anonymous')}</span>
                </div>
            </div>
        `).join('');
    }

    // ── Theme Detail Modal ──
    window.openThemeDetail = async function (themeId) {
        try {
            const theme = await api(`/themes/${themeId}`);
            let questions = [];
            try { questions = await api(`/themes/${themeId}/questions`); } catch {}

            const content = $('#themeDetailContent');
            content.innerHTML = `
                <div class="sai-theme-detail__header">
                    <h2>${esc(theme.name)}</h2>
                    <p style="color:var(--sai-text-muted);margin-top:4px;">${esc(theme.description || '')}</p>
                    <div class="sai-theme-detail__stats">
                        <span><i class="fas fa-question-circle"></i> ${(questions || []).length} questions</span>
                        <span><i class="fas fa-play"></i> ${theme.play_count || 0} plays</span>
                        <span><i class="fas fa-star" style="color:var(--sai-warning)"></i> ${(theme.avg_rating || 0).toFixed(1)}</span>
                    </div>
                </div>
                <div class="sai-theme-detail__questions">
                    <h4 style="margin-bottom:12px;">Preview Questions</h4>
                    ${(questions || []).slice(0, 10).map((q, i) => `
                        <div class="sai-preview-question">
                            <div class="sai-preview-question__text">${i+1}. ${esc(q.question_text)}</div>
                            ${(q.answers || []).map(a => `
                                <span class="sai-preview-answer ${a.is_correct ? 'sai-preview-answer--correct' : 'sai-preview-answer--wrong'}">
                                    ${a.is_correct ? '✓' : '✗'} ${esc(a.answer_text)}
                                </span>
                            `).join('')}
                        </div>
                    `).join('')}
                    ${(questions || []).length > 10 ? `<p style="color:var(--sai-text-muted);text-align:center;margin-top:8px;">… and ${questions.length - 10} more questions</p>` : ''}
                </div>
                <div style="margin-top:20px;">
                    <h4 style="margin-bottom:8px;">Rate this theme</h4>
                    <div class="sai-stars" id="rateStars">
                        ${[1,2,3,4,5].map(s => `<i class="far fa-star sai-star" data-value="${s}" onclick="rateTheme(${themeId},${s})"></i>`).join('')}
                    </div>
                </div>
                <div class="sai-theme-detail__actions">
                    <button class="sai-btn sai-btn--success" onclick="closeModal('themeDetailModal'); joinActiveQuiz(null, ${themeId});">
                        <i class="fas fa-play"></i> Play Quiz
                    </button>
                    <button class="sai-btn sai-btn--ghost" onclick="closeModal('themeDetailModal')">Close</button>
                </div>
            `;

            $('#themeDetailModal').classList.add('sai-modal--active');
        } catch (e) {
            toast('Failed to load theme details', 'error');
            console.error(e);
        }
    };

    window.rateTheme = async function (themeId, stars) {
        // Check if user is logged in
        if (!currentUser || !currentUser.id) {
            toast('Please log in to rate themes', 'error');
            $('#loginModal').classList.add('sai-modal--active');
            return;
        }
        
        try {
            await api(`/themes/${themeId}/rate`, {
                method: 'POST',
                body: JSON.stringify({ rating: stars })
            });
            $$('#rateStars .sai-star').forEach(s => {
                const v = parseInt(s.dataset.value);
                s.className = `fa${v <= stars ? 's' : 'r'} fa-star sai-star ${v <= stars ? 'sai-star--active' : ''}`;
            });
            toast('Thanks for rating!', 'success');
        } catch (e) {
            if (e.status === 401 || e.detail === 'Unauthorized') {
                toast('Your session expired. Please log in again.', 'error');
                $('#loginModal').classList.add('sai-modal--active');
            } else {
                toast('Rating failed - ' + (e.detail || 'try again'), 'error');
            }
        }
    };

    window.closeModal = function (id) {
        $(`#${id}`).classList.remove('sai-modal--active');
    };

    // Search
    let searchTimer;
    function setupSearch() {
        const input = $('#searchInput');
        if (!input) return;
        input.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(async () => {
                const q = input.value.trim();
                if (q.length < 2) { loadExploreTab(); return; }
                try {
                    const results = await api(`/themes?search=${encodeURIComponent(q)}`);
                    renderThemeGrid('#exploreGrid', results, false);
                } catch (e) {
                    console.warn('Search failed:', e);
                }
            }, 350);
        });
    }

    // ══════════════════════════════════════
    //  CREATE TAB
    // ══════════════════════════════════════

    /* ---------- char counters ---------- */
    function setupCharCounters() {
        const nameInput = $('#themeName');
        const descInput = $('#themeDesc');
        const nameCount = $('#themeNameCount');
        const descCount = $('#themeDescCount');
        if (nameInput && nameCount) {
            const update = () => nameCount.textContent = `${nameInput.value.length}/${nameInput.maxLength}`;
            nameInput.addEventListener('input', update);
            update();
        }
        if (descInput && descCount) {
            const update = () => descCount.textContent = `${descInput.value.length}/${descInput.maxLength}`;
            descInput.addEventListener('input', update);
            update();
        }
    }

    /* ---------- step indicator ---------- */
    function setCreateStep(num) {
        document.querySelectorAll('.sai-step').forEach(el => {
            const s = parseInt(el.dataset.step);
            el.classList.toggle('sai-step--active', s === num);
            el.classList.toggle('sai-step--done', s < num);
        });
    }

    /* ---------- question progress bar ---------- */
    function updateQuestionProgress(count) {
        const bar = $('#questionProgressBar');
        const needed = $('#questionsNeeded');
        const btn = $('#submitForReviewBtn');
        if (!bar) return;
        const pct = Math.min(count / 5, 1) * 100;
        bar.style.width = pct + '%';
        const remaining = Math.max(5 - count, 0);
        if (btn) {
            btn.disabled = count < 5;
            if (count >= 5) {
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit for Review';
            } else {
                btn.innerHTML = `<i class="fas fa-paper-plane"></i> Submit for Review (need ${remaining} more)`;
            }
        }
        if (needed) needed.textContent = remaining;
    }

    function setupCreateForm() {
        const form = $('#createThemeForm');
        if (!form) return;
        setupCharCounters();
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const name = $('#themeName').value.trim();
            const desc = $('#themeDesc').value.trim();
            if (!name) return toast('Theme name is required', 'error');

            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…';

            try {
                const theme = await api('/themes', {
                    method: 'POST',
                    body: JSON.stringify({ name, description: desc })
                });
                activeThemeId = theme.id;
                toast('Theme created! Now add questions.', 'success');
                showQuestionBuilder(theme);
                form.style.display = 'none';
                setCreateStep(2);
            } catch (e) {
                toast('Failed to create theme: ' + (e.detail || ''), 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-arrow-right"></i> Create Theme &amp; Add Questions';
            }
        });
    }

    function showQuestionBuilder(theme) {
        const form = $('#createThemeForm');
        if (form) form.style.display = 'none';
        const builder = $('#questionBuilder');
        builder.style.display = '';
        builder.style.animation = 'sai-fadeUp 0.4s ease';
        $('#builderThemeName').textContent = theme.name;
        activeThemeId = theme.id;
        setCreateStep(2);
        loadQuestions(theme.id);
    }

    function resetCreateTab() {
        // If actively editing a theme, reload its questions
        if (activeThemeId) {
            loadQuestions(activeThemeId);
            return;
        }
        // Otherwise reset to step 1 - fresh creation flow
        setCreateStep(1);
        const form = $('#createThemeForm');
        if (form) { form.style.display = ''; form.reset(); }
        const builder = $('#questionBuilder');
        if (builder) builder.style.display = 'none';
        // Reset char counters
        const nc = $('#themeNameCount');
        const dc = $('#themeDescCount');
        if (nc) nc.textContent = '0/100';
        if (dc) dc.textContent = '0/500';
    }

    async function loadQuestions(themeId) {
        try {
            const questions = await api(`/themes/${themeId}/questions`);
            renderQuestionsList(questions);
        } catch {
            renderQuestionsList([]);
        }
    }

    function renderQuestionsList(questions) {
        const list = $('#questionsList');
        const count = $('#questionCount');
        const submitBtn = $('#submitForReviewBtn');
        count.textContent = `${questions.length} question${questions.length !== 1 ? 's' : ''}`;
        submitBtn.disabled = questions.length < 5;
        updateQuestionProgress(questions.length);

        if (questions.length >= 5) setCreateStep(3);

        if (questions.length === 0) {
            list.innerHTML = '<p style="color:var(--sai-text-muted);text-align:center;padding:20px;">No questions yet. Add your first one below!</p>';
            return;
        }

        list.innerHTML = questions.map((q, i) => `
            <div class="sai-question-item">
                <span class="sai-question-item__num">${i + 1}</span>
                <span class="sai-question-item__text">${esc(q.question_text)}</span>
                <span class="sai-question-item__meta">
                    <span>${q.difficulty || 'medium'}</span>
                    <span>${q.points || 10}pts</span>
                </span>
                <button class="sai-question-item__delete" onclick="deleteQuestion(${q.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    function setupQuestionForm() {
        const form = $('#addQuestionForm');
        if (!form) return;
        form.addEventListener('submit', async e => {
            e.preventDefault();
            if (!activeThemeId) return toast('Create a theme first', 'error');

            const questionText = $('#qText').value.trim();
            if (!questionText) return toast('Question text is required', 'error');

            const answers = [];
            for (let i = 1; i <= 4; i++) {
                const text = $(`#aText${i}`).value.trim();
                const correct = $(`#aCorrect${i}`).checked;
                if (text) answers.push({ answer_text: text, is_correct: correct });
            }

            if (answers.length < 2) return toast('At least 2 answers required', 'error');
            if (!answers.some(a => a.is_correct)) return toast('Mark at least one correct answer', 'error');

            try {
                await api(`/themes/${activeThemeId}/questions`, {
                    method: 'POST',
                    body: JSON.stringify({
                        question_text: questionText,
                        difficulty: $('#qDifficulty').value,
                        time_limit: parseInt($('#qTimeLimit').value) || 30,
                        points: parseInt($('#qPoints').value) || 10,
                        explanation: $('#qExplanation').value.trim() || null,
                        is_ai_generated: $('#qAiGenerated').checked,
                        answers
                    })
                });
                toast('Question added!', 'success');
                form.reset();
                $('#aCorrect1').checked = true;
                $('#qDifficulty').value = 'medium';
                $('#qTimeLimit').value = '30';
                $('#qPoints').value = '10';
                loadQuestions(activeThemeId);
            } catch (e) {
                toast('Failed to add question: ' + (e.detail || ''), 'error');
            }
        });
    }

    window.deleteQuestion = async function (qId) {
        if (!confirm('Delete this question?')) return;
        try {
            await api(`/questions/${qId}`, { method: 'DELETE' });
            toast('Question deleted', 'info');
            loadQuestions(activeThemeId);
        } catch (e) {
            toast('Failed to delete: ' + (e.detail || ''), 'error');
        }
    };

    function setupSubmitForReview() {
        const btn = $('#submitForReviewBtn');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            if (!activeThemeId) return;
            try {
                await api(`/themes/${activeThemeId}/submit`, { method: 'POST' });
                toast('Theme submitted for admin review!', 'success');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-check"></i> Submitted';
            } catch (e) {
                toast('Submit failed: ' + (e.detail || ''), 'error');
            }
        });
    }

    // ══════════════════════════════════════
    //  MY THEMES TAB
    // ══════════════════════════════════════
    async function loadMyThemes() {
        try {
            const themes = await api(`/themes?creator_id=${currentUser.id}`);
            myThemes = themes || [];
            renderThemeGrid('#myThemesGrid', myThemes, true);

            $$('#myThemesGrid .sai-theme-card').forEach((card, i) => {
                const theme = myThemes[i];
                if (!theme) return;
                const footer = card.querySelector('.sai-theme-card__footer');
                if (footer && theme.status === 'draft') {
                    const editBtn = document.createElement('button');
                    editBtn.className = 'sai-btn sai-btn--ghost sai-btn--sm';
                    editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
                    editBtn.onclick = (e) => { e.stopPropagation(); editTheme(theme); };
                    footer.appendChild(editBtn);
                }
            });
        } catch (e) {
            console.warn('Failed to load my themes:', e);
        }
    }

    function editTheme(theme) {
        switchTab('create');
        showQuestionBuilder(theme);
    }

    // ══════════════════════════════════════
    //  CSV UPLOAD TAB
    // ══════════════════════════════════════
    async function loadCsvThemeSelect() {
        try {
            const themes = await api(`/themes?creator_id=${currentUser.id}`);
            const select = $('#csvThemeSelect');
            select.innerHTML = '<option value="">- Select a theme -</option>';
            (themes || []).forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = `${t.name} (${t.status})`;
                select.appendChild(opt);
            });
        } catch { /* no themes */ }
    }

    function setupCsvUpload() {
        const dropZone = $('#csvDropZone');
        const fileInput = $('#csvFileInput');
        const downloadBtn = $('#downloadTemplateBtn');
        const newThemeBtn = $('#csvNewThemeBtn');

        if (!dropZone) return;

        dropZone.addEventListener('click', () => {
            const input = $('#csvFileInput');
            if (input) input.click();
        });
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('sai-dropzone--active'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('sai-dropzone--active'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('sai-dropzone--active');
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.csv')) uploadCsv(file);
            else toast('Please drop a .csv file', 'error');
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files[0]) uploadCsv(fileInput.files[0]);
        });

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const csv = 'question,correct_answer,wrong_answer_1,wrong_answer_2,wrong_answer_3,explanation,difficulty,ai_generated\n"What is 2+2?","4","3","5","6","Basic arithmetic","easy","false"\n';
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'quiz-template.csv';
                a.click();
                URL.revokeObjectURL(a.href);
            });
        }

        if (newThemeBtn) {
            newThemeBtn.addEventListener('click', () => switchTab('create'));
        }
    }

    async function uploadCsv(file) {
        const themeId = $('#csvThemeSelect').value;
        if (!themeId) return toast('Select a theme first', 'error');

        const dropZone = $('#csvDropZone');
        dropZone.innerHTML = '<div class="sai-spinner"></div><p>Uploading & parsing…</p>';

        try {
            const formData = new FormData();
            formData.append('file', file);

            const result = await api(`/themes/${themeId}/csv-upload`, {
                method: 'POST',
                headers: {},
                body: formData
            });

            const resultsDiv = $('#csvResults');
            resultsDiv.style.display = '';
            resultsDiv.innerHTML = `
                <h4><i class="fas fa-check-circle" style="color:var(--sai-success)"></i> Import Complete</h4>
                <div class="sai-result-stat">
                    <span>Questions imported</span>
                    <strong style="color:var(--sai-success)">${result.imported || 0}</strong>
                </div>
                <div class="sai-result-stat">
                    <span>Failed rows</span>
                    <strong style="color:${result.failed ? 'var(--sai-danger)' : 'var(--sai-text-muted)'}">${result.failed || 0}</strong>
                </div>
                ${result.errors && result.errors.length > 0 ? `
                    <div style="margin-top:12px;font-size:0.85rem;color:var(--sai-danger)">
                        <strong>Errors:</strong>
                        <ul style="margin-left:16px;margin-top:4px;">
                            ${result.errors.slice(0, 5).map(e => `<li>${esc(e)}</li>`).join('')}
                        </ul>
                    </div>` : ''}
            `;
            toast(`Imported ${result.imported || 0} questions!`, 'success');
        } catch (e) {
            toast('CSV upload failed: ' + (e.detail || ''), 'error');
        }

        dropZone.innerHTML = `
            <i class="fas fa-cloud-upload-alt"></i>
            <h3>Drop CSV file here</h3>
            <p>or click to browse</p>
            <input type="file" id="csvFileInput" accept=".csv" hidden>`;
        const newInput = $('#csvFileInput');
        newInput.addEventListener('change', () => {
            if (newInput.files[0]) uploadCsv(newInput.files[0]);
        });
    }

    // ══════════════════════════════════════
    //  PASTE RAW TEXT TAB
    // ══════════════════════════════════════
    async function loadPasteThemeSelect() {
        try {
            const themes = await api(`/themes?creator_id=${currentUser.id}`);
            const select = $('#pasteThemeSelect');
            select.innerHTML = '<option value="">- Select a theme -</option>';
            (themes || []).forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = `${t.name} (${t.status})`;
                select.appendChild(opt);
            });
        } catch { /* no themes */ }
    }

    function parseRawTextToQuestions(text) {
        const questions = [];
        // Split by blank lines or "Q:" markers
        const blocks = text.split(/\n\s*\n/).filter(b => b.trim());
        
        for (const block of blocks) {
            const lines = block.split('\n').map(l => l.trim()).filter(l => l);
            let questionText = '';
            const answers = [];
            let explanation = null;
            let difficulty = 'medium';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (/^Q:\s*/i.test(line)) {
                    questionText = line.replace(/^Q:\s*/i, '').trim();
                } else if (/^A:\s*/i.test(line)) {
                    const answerRaw = line.replace(/^A:\s*/i, '').trim();
                    const isCorrect = /\(correct\)/i.test(answerRaw);
                    const answerText = answerRaw.replace(/\s*\(correct\)\s*/i, '').trim();
                    if (answerText) answers.push({ answer_text: answerText, is_correct: isCorrect });
                } else if (/^E:\s*/i.test(line)) {
                    explanation = line.replace(/^E:\s*/i, '').trim() || null;
                } else if (/^D:\s*/i.test(line)) {
                    const d = line.replace(/^D:\s*/i, '').trim().toLowerCase();
                    if (['easy', 'medium', 'hard', 'expert'].includes(d)) difficulty = d;
                } else if (!questionText && i === 0) {
                    // First line without prefix treated as question
                    questionText = line;
                }
            }

            if (questionText && answers.length >= 2) {
                // Ensure at least one correct answer
                if (!answers.some(a => a.is_correct) && answers.length > 0) {
                    answers[0].is_correct = true;
                }
                questions.push({ question_text: questionText, answers, explanation, difficulty });
            }
        }
        return questions;
    }

    function setupPasteText() {
        const textarea = $('#pasteTextarea');
        const parseBtn = $('#parseTextBtn');
        const newThemeBtn = $('#pasteNewThemeBtn');
        const lineCount = $('#pasteLineCount');

        if (!textarea || !parseBtn) return;

        textarea.addEventListener('input', () => {
            const lines = textarea.value.split('\n').filter(l => l.trim()).length;
            if (lineCount) lineCount.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
        });

        if (newThemeBtn) {
            newThemeBtn.addEventListener('click', () => switchTab('create'));
        }

        parseBtn.addEventListener('click', async () => {
            const themeId = $('#pasteThemeSelect').value;
            if (!themeId) return toast('Select a theme first', 'error');

            const text = textarea.value.trim();
            if (!text) return toast('Paste some text first', 'error');

            const questions = parseRawTextToQuestions(text);
            if (questions.length === 0) {
                return toast('Could not parse any questions. Use Q: and A: prefixes.', 'error');
            }

            parseBtn.disabled = true;
            parseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing…';

            let imported = 0;
            let failed = 0;
            const errors = [];

            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                try {
                    await api(`/themes/${themeId}/questions`, {
                        method: 'POST',
                        body: JSON.stringify({
                            question_text: q.question_text,
                            difficulty: q.difficulty,
                            time_limit: 30,
                            points: 10,
                            explanation: q.explanation,
                            is_ai_generated: true,
                            answers: q.answers
                        })
                    });
                    imported++;
                } catch (e) {
                    failed++;
                    errors.push(`Q${i+1}: ${e.detail || 'Failed'}`);
                }
            }

            const resultsDiv = $('#pasteResults');
            resultsDiv.style.display = '';
            resultsDiv.innerHTML = `
                <h4><i class="fas fa-check-circle" style="color:var(--sai-success)"></i> Import Complete</h4>
                <div class="sai-result-stat">
                    <span>Questions imported</span>
                    <strong style="color:var(--sai-success)">${imported}</strong>
                </div>
                <div class="sai-result-stat">
                    <span>Failed</span>
                    <strong style="color:${failed ? 'var(--sai-danger)' : 'var(--sai-text-muted)'}">${failed}</strong>
                </div>
                ${errors.length > 0 ? `
                    <div style="margin-top:12px;font-size:0.85rem;color:var(--sai-danger)">
                        <strong>Errors:</strong>
                        <ul style="margin-left:16px;margin-top:4px;">
                            ${errors.slice(0, 5).map(e => `<li>${esc(e)}</li>`).join('')}
                        </ul>
                    </div>` : ''}
            `;

            toast(`Imported ${imported} question${imported !== 1 ? 's' : ''} from pasted text!`, 'success');

            parseBtn.disabled = false;
            parseBtn.innerHTML = '<i class="fas fa-magic"></i> Parse & Import Questions';
        });
    }

    // ══════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════
    // ══════════════════════════════════════
    //  REAL-TIME SESSION UPDATES VIA SOCKET.IO
    // ══════════════════════════════════════
    let hubSocket = null;

    function setupRealtimeSessionUpdates() {
        if (typeof io === 'undefined') return;
        try {
            hubSocket = io(`https://${window.location.hostname}`, {
                transports: ['polling', 'websocket'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 3000,
                forceNew: false
            });

            hubSocket.on('connect', () => {
                console.log('[SpireAI] Hub socket connected');
            });

            // A new session was just created - refresh the list immediately
            hubSocket.on('session_created', (data) => {
                console.log('[SpireAI] New session created:', data);
                loadActiveSessions();
                const name = data.name || `Session #${data.session_id}`;
                toast(`New quiz started: ${name}`, 'info');
            });

            // A session's phase/theme changed
            hubSocket.on('session_updated', () => {
                loadActiveSessions();
            });

            // A session ended
            hubSocket.on('session_ended', () => {
                loadActiveSessions();
            });
        } catch (err) {
            console.warn('[SpireAI] Could not set up real-time session updates:', err);
        }
    }

    function init() {
        // Auth form
        $('#loginForm').addEventListener('submit', async e => {
            e.preventDefault();
            const fn = $('#loginFirst').value.trim();
            const ln = $('#loginLast').value.trim();
            const pw = $('#loginPassword').value || null;
            if (!fn || !ln) return toast('Enter your first and last name', 'error');
            try {
                await doLogin(fn, ln, pw);
                showApp();
                toast(`Welcome back, ${fn}!`, 'success');
            } catch {
                toast('Login failed - check your credentials', 'error');
            }
        });

        $('#registerBtn').addEventListener('click', async () => {
            const fn = $('#loginFirst').value.trim();
            const ln = $('#loginLast').value.trim();
            const pw = $('#loginPassword').value || null;
            if (!fn || !ln) return toast('Enter your first and last name', 'error');
            try {
                await doRegister(fn, ln, pw);
                showApp();
                toast(`Welcome, ${fn}!`, 'success');
            } catch {
                toast('Registration failed - try different credentials', 'error');
            }
        });

        $('#logoutBtn').addEventListener('click', logout);

        // Tab nav
        $$('.sai-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Refresh sessions button
        const refreshBtn = $('#refreshSessionsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                loadActiveSessions();
                toast('Sessions refreshed', 'info');
            });
        }

        // Modal backdrop close (skip login modal - would leave blank page)
        $$('.sai-modal__backdrop').forEach(bd => {
            bd.addEventListener('click', () => {
                const modal = bd.parentElement;
                if (modal.id === 'loginModal') return;
                modal.classList.remove('sai-modal--active');
            });
        });

        // Setup all features
        setupPickerTabs();
        setupStartSession();
        setupSearch();
        setupCreateForm();
        setupQuestionForm();
        setupSubmitForReview();
        setupCsvUpload();
        setupPasteText();
        setupRealtimeSessionUpdates();

        // Theme toggle icon sync
        function updateThemeIcon() {
            const btn = $('#theme-toggle');
            if (!btn) return;
            const icon = btn.querySelector('i');
            if (!icon) return;
            const theme = document.documentElement.getAttribute('data-theme');
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
        updateThemeIcon();
        window.addEventListener('themeChanged', updateThemeIcon);

        autoLogin();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
