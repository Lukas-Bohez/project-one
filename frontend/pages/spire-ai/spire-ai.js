/**
 * Quiz The Spire — Hub & Spire AI Collaboration
 * Central hub: active sessions, community themes, create, CSV upload, admin review
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
        if (id && fn && ln) return { id, firstName: fn, lastName: ln, password: pw };
        return null;
    }

    function storeUser(id, firstName, lastName, password) {
        localStorage.setItem(STORAGE_KEYS.USER_ID, id);
        localStorage.setItem(STORAGE_KEYS.FIRST_NAME, firstName);
        localStorage.setItem(STORAGE_KEYS.LAST_NAME, lastName);
        if (password) localStorage.setItem(STORAGE_KEYS.PASSWORD, password);
    }

    async function doLogin(firstName, lastName, password) {
        const data = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first_name: firstName, last_name: lastName, password })
        }).then(r => r.json());
        if (data.user_id) {
            storeUser(data.user_id, firstName, lastName, password);
            currentUser = { id: data.user_id, firstName, lastName };
            return true;
        }
        throw new Error('Login failed');
    }

    async function doRegister(firstName, lastName, password) {
        const data = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first_name: firstName, last_name: lastName, password })
        }).then(r => r.json());
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
        display.querySelector('span').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        loadPlayTab();
    }

    function logout() {
        if (sessionRefreshInterval) clearInterval(sessionRefreshInterval);
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        currentUser = null;
        location.reload();
    }

    async function autoLogin() {
        const stored = getStoredUser();
        if (stored && stored.password) {
            try {
                await doLogin(stored.firstName, stored.lastName, stored.password);
                showApp();
            } catch {
                // stored credentials invalid — show login modal
            }
        }
    }

    // ══════════════════════════════════════
    //  TAB NAVIGATION
    // ══════════════════════════════════════
    window.switchTab = function (tabId) {
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
    };

    // ══════════════════════════════════════
    //  PLAY TAB — Active Sessions + Quick Actions
    // ══════════════════════════════════════
    async function loadPlayTab() {
        loadActiveSessions();
        loadStats();
        // Auto-refresh sessions every 5 seconds
        if (sessionRefreshInterval) clearInterval(sessionRefreshInterval);
        sessionRefreshInterval = setInterval(loadActiveSessions, 5000);
    }

    async function loadActiveSessions() {
        const container = $('#activeSessionsList');
        try {
            const response = await apiRaw('/sessions/active');
            const sessionIds = Array.isArray(response)
                ? response
                : (response?.active_session_ids || []);

            // Update live stat
            const liveEl = $('#statLive');
            if (liveEl) liveEl.textContent = sessionIds.length;

            if (sessionIds.length === 0) {
                container.innerHTML = `
                    <div class="sai-no-sessions">
                        <i class="fas fa-satellite-dish"></i>
                        <h3>No active sessions right now</h3>
                        <p>Start a quiz from below or wait for someone to create one!</p>
                    </div>`;
                return;
            }

            container.innerHTML = sessionIds.map((sid, i) => `
                <div class="sai-session-card">
                    <div class="sai-session-card__header">
                        <span class="sai-session-card__title">Quiz Session #${sid}</span>
                        <span class="sai-session-card__live">Live</span>
                    </div>
                    <div class="sai-session-card__meta">
                        <span><i class="fas fa-clock"></i> Active now</span>
                        <span class="sai-session-card__phase sai-phase--playing">In Progress</span>
                    </div>
                    <div class="sai-session-card__actions">
                        <button class="sai-btn sai-btn--success sai-btn--sm" onclick="joinActiveQuiz()">
                            <i class="fas fa-play"></i> Join Session
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = `
                <div class="sai-no-sessions">
                    <i class="fas fa-satellite-dish"></i>
                    <h3>No active sessions</h3>
                    <p>Click "Join Active Quiz" to start or join a session</p>
                </div>`;
        }
    }

    window.joinActiveQuiz = function () {
        // Navigate to the quiz page — it will auto-join the active session
        window.location.href = QUIZ_PAGE;
    };

    async function loadStats() {
        try {
            const stats = await api('/admin/stats');
            if (stats.total_themes !== undefined) {
                const el = (id) => $(id);
                if (el('#statThemes')) el('#statThemes').textContent = stats.total_themes || 0;
                if (el('#statPlays')) el('#statPlays').textContent = stats.total_plays || 0;
                if (el('#statCreators')) el('#statCreators').textContent = stats.total_creators || 0;
            }
        } catch { /* stats endpoint may require admin — show defaults */ }
    }

    // ══════════════════════════════════════
    //  EXPLORE TAB — Community Themes + Admin Review
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
        // Check if user is admin → show review banner
        loadAdminReviewBanner();
    }

    async function loadAdminReviewBanner() {
        try {
            const pending = await api('/admin/pending');
            if (!pending || pending.length === 0) {
                const existing = $('#adminReviewBanner');
                if (existing) existing.remove();
                return;
            }
            // User is admin (request succeeded) — show review section
            let banner = $('#adminReviewBanner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'adminReviewBanner';
                const exploreTab = $('#tab-explore');
                const grid = $('#exploreGrid');
                exploreTab.insertBefore(banner, grid);
            }
            banner.innerHTML = `
                <div class="sai-review-banner">
                    <div class="sai-review-banner__text">
                        <i class="fas fa-gavel"></i>
                        <span>Admin: Community themes pending review</span>
                        <span class="sai-review-banner__count">${pending.length}</span>
                    </div>
                </div>
                <div class="sai-container" style="padding-top:0;">
                    ${pending.map(t => `
                        <div class="sai-review-card" id="review-card-${t.id}">
                            <div class="sai-review-card__header">
                                <span class="sai-review-card__title">${esc(t.name)}</span>
                                <span class="sai-theme-card__badge sai-badge--pending">Pending Review</span>
                            </div>
                            <p class="sai-review-card__desc">${esc(t.description || 'No description')}</p>
                            <div class="sai-review-card__meta">
                                <span><i class="fas fa-user"></i> ${esc(t.creator_name || 'Anonymous')}</span>
                                <span><i class="fas fa-question-circle"></i> ${t.question_count || 0} questions</span>
                                <span><i class="fas fa-calendar"></i> ${t.created_at ? new Date(t.created_at).toLocaleDateString() : 'Unknown'}</span>
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
                                <button class="sai-btn sai-btn--primary sai-btn--sm" onclick="promoteTheme(${t.id})" title="Promote to official quiz theme">
                                    <i class="fas fa-crown"></i> Promote to Official
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch {
            // Not admin or error — no review banner
        }
    }

    window.previewReviewTheme = async function (themeId) {
        try {
            // Fetch the theme details + questions for preview
            const theme = await api(`/themes/${themeId}`);
            const questions = await api(`/themes/${themeId}/questions`);

            const content = $('#themeDetailContent');
            content.innerHTML = `
                <div class="sai-theme-detail__header">
                    <h2>${esc(theme.name)}</h2>
                    <span class="sai-theme-card__badge sai-badge--${theme.status}" style="display:inline-block;margin-top:8px;">${theme.status}</span>
                    <p style="color:var(--sai-text-muted);margin-top:8px;">${esc(theme.description || '')}</p>
                    <div class="sai-theme-detail__stats" style="margin-top:12px;">
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
                            ${q.explanation ? `<p style="font-size:0.8rem;color:var(--sai-text-muted);margin-top:4px;"><em>Explanation: ${esc(q.explanation)}</em></p>` : ''}
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
            // Remove the card from DOM
            const card = $(`#review-card-${themeId}`);
            if (card) card.remove();
            loadExploreTab(); // Refresh
        } catch (e) {
            toast('Review failed: ' + (e.detail || ''), 'error');
        }
    };

    window.promoteTheme = async function (themeId) {
        if (!confirm('Promote this community theme to an official quiz theme? This will copy it into the main quiz system.')) return;
        try {
            await api(`/admin/promote/${themeId}`, { method: 'POST' });
            toast('Theme promoted to official! It will now appear in the main quiz rotation.', 'success');
            loadExploreTab();
        } catch (e) {
            toast('Promotion failed: ' + (e.detail || ''), 'error');
        }
    };

    function renderThemeGrid(selector, themes, showStatus) {
        const grid = $(selector);
        if (!themes || themes.length === 0) {
            grid.innerHTML = `
                <div class="sai-empty-state">
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
                    ${(questions || []).length > 10 ? `<p style="color:var(--sai-text-muted);text-align:center;margin-top:8px;">... and ${questions.length - 10} more questions</p>` : ''}
                </div>
                <div style="margin-top:20px;">
                    <h4 style="margin-bottom:8px;">Rate this theme</h4>
                    <div class="sai-stars" id="rateStars">
                        ${[1,2,3,4,5].map(s => `<i class="far fa-star sai-star" data-value="${s}" onclick="rateTheme(${themeId},${s})"></i>`).join('')}
                    </div>
                </div>
                <div class="sai-theme-detail__actions">
                    <button class="sai-btn sai-btn--success" onclick="closeModal('themeDetailModal'); joinActiveQuiz();">
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
            toast('Rating failed — ' + (e.detail || 'try again'), 'error');
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
    function setupCreateForm() {
        const form = $('#createThemeForm');
        if (!form) return;
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const name = $('#themeName').value.trim();
            const desc = $('#themeDesc').value.trim();
            if (!name) return toast('Theme name is required', 'error');

            try {
                const theme = await api('/themes', {
                    method: 'POST',
                    body: JSON.stringify({ name, description: desc })
                });
                activeThemeId = theme.id;
                toast('Theme created! Now add questions.', 'success');
                showQuestionBuilder(theme);
                form.reset();
            } catch (e) {
                toast('Failed to create theme: ' + (e.detail || ''), 'error');
            }
        });
    }

    function showQuestionBuilder(theme) {
        const builder = $('#questionBuilder');
        builder.style.display = '';
        $('#builderThemeName').textContent = theme.name;
        activeThemeId = theme.id;
        loadQuestions(theme.id);
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
                toast('Theme submitted for admin review! Once approved, it can be promoted to the main quiz.', 'success');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-check"></i> Submitted for Review';
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
            select.innerHTML = '<option value="">-- Select a theme to import into --</option>';
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

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('sai-drop-zone--active'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('sai-drop-zone--active'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('sai-drop-zone--active');
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
        dropZone.innerHTML = '<div class="sai-spinner"></div><p>Uploading & parsing...</p>';

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
            <p>or click to browse</p>`;
        $('#csvFileInput').value = '';
    }

    // ══════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════
    function init() {
        // Auth form
        $('#loginForm').addEventListener('submit', async e => {
            e.preventDefault();
            const fn = $('#loginFirst').value.trim();
            const ln = $('#loginLast').value.trim();
            const pw = $('#loginPassword').value;
            try {
                await doLogin(fn, ln, pw);
                showApp();
                toast(`Welcome back, ${fn}!`, 'success');
            } catch {
                toast('Login failed — check your credentials', 'error');
            }
        });

        $('#registerBtn').addEventListener('click', async () => {
            const fn = $('#loginFirst').value.trim();
            const ln = $('#loginLast').value.trim();
            const pw = $('#loginPassword').value;
            if (!fn || !ln || !pw) return toast('Fill in all fields', 'error');
            try {
                await doRegister(fn, ln, pw);
                showApp();
                toast(`Welcome, ${fn}! Start by joining a quiz or creating your own theme.`, 'success');
            } catch {
                toast('Registration failed — try different credentials', 'error');
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

        // Modal backdrop close
        $$('.sai-modal__backdrop').forEach(bd => {
            bd.addEventListener('click', () => {
                bd.parentElement.classList.remove('sai-modal--active');
            });
        });

        setupSearch();
        setupCreateForm();
        setupQuestionForm();
        setupSubmitForReview();
        setupCsvUpload();

        autoLogin();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();