/**
 * Admin Panel - Community Themes Moderation
 * Full moderation workflow: preview, edit questions, approve, reject, promote
 * Includes search, sort, bulk actions, and proper rejection reason modal
 */

(function () {
    'use strict';

    const API_BASE = `https://${window.location.hostname}/api/v1/community`;
    let communityFilter = 'pending';
    let communitySearch = '';
    let communitySort = 'newest';
    let selectedThemeIds = new Set();

    // ── Auth helpers ──
    function getAuthHeaders() {
        const userId = sessionStorage.getItem('admin_user_id');
        // client-side RFID removed
        const rfidCode = null;
        const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
        if (userId && rfidCode) {
            headers['X-User-ID'] = userId;
            headers['X-RFID'] = rfidCode;
        }
        return headers;
    }

    async function communityApi(endpoint, opts = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = { ...getAuthHeaders(), ...opts.headers };
        if (opts.body instanceof FormData) delete headers['Content-Type'];
        const r = await fetch(url, { ...opts, headers });
        const data = await r.json().catch(() => null);
        if (!r.ok) throw { status: r.status, detail: data?.detail || r.statusText };
        return data;
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function notify(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            const el = document.createElement('div');
            el.style.cssText = `
                position:fixed;top:20px;right:20px;padding:14px 22px;border-radius:10px;z-index:10000;
                color:#fff;font-weight:500;font-size:.9rem;animation:fadeIn .3s ease;
                background:${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
                box-shadow:0 8px 24px rgba(0,0,0,.2);
            `;
            el.textContent = message;
            document.body.appendChild(el);
            setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 3500);
            setTimeout(() => el.remove(), 4000);
        }
    }

    // ── Entry point ──
    window.loadCommunityTab = async function () {
        renderToolbar();
        updateBadge();
        loadCommunityStats();
        loadCommunityThemes(communityFilter);
        setupFilterButtons();
    };

    // ── Toolbar: search + sort ──
    function renderToolbar() {
        const container = document.querySelector('.js-community-list');
        if (!container) return;
        const parent = container.parentElement;
        if (parent.querySelector('.c-community-toolbar')) return;

        const toolbar = document.createElement('div');
        toolbar.className = 'c-community-toolbar';
        toolbar.innerHTML = `
            <div class="c-search-input-wrapper" style="flex:1;min-width:200px;">
                <i class="fas fa-search c-search-icon"></i>
                <input type="text" class="c-search-input js-community-search" placeholder="Search community themes...">
            </div>
            <select class="c-select js-community-sort">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="rating">Highest Rating</option>
                <option value="questions">Most Questions</option>
                <option value="name">Name A-Z</option>
            </select>
        `;
        parent.insertBefore(toolbar, container);

        toolbar.querySelector('.js-community-search').addEventListener('input', (e) => {
            communitySearch = e.target.value.toLowerCase();
            loadCommunityThemes(communityFilter);
        });
        toolbar.querySelector('.js-community-sort').addEventListener('change', (e) => {
            communitySort = e.target.value;
            loadCommunityThemes(communityFilter);
        });
    }

    // ── Filter buttons ──
    function setupFilterButtons() {
        document.querySelectorAll('.js-community-filter').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.js-community-filter').forEach(b => {
                    b.classList.remove('active', 'c-btn--primary');
                    b.classList.add('c-btn--ghost');
                });
                btn.classList.add('active', 'c-btn--primary');
                btn.classList.remove('c-btn--ghost');
                communityFilter = btn.dataset.filter;
                selectedThemeIds.clear();
                loadCommunityThemes(communityFilter);
            };
        });
    }

    // ── Badge ──
    async function updateBadge() {
        try {
            const pending = await communityApi('/admin/pending');
            const badge = document.querySelector('.js-community-badge');
            if (badge) {
                const count = (pending || []).length;
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-flex' : 'none';
            }
        } catch { /* not critical */ }
    }

    // ── Stats ──
    async function loadCommunityStats() {
        try {
            const stats = await communityApi('/admin/stats');
            const $ = (sel) => document.querySelector(sel);
            if ($('.js-pending-count'))  $('.js-pending-count').textContent  = stats.pending_themes  || 0;
            if ($('.js-approved-count')) $('.js-approved-count').textContent = stats.approved_themes || 0;
            if ($('.js-promoted-count')) $('.js-promoted-count').textContent = stats.promoted_themes || 0;
        } catch { /* non-critical */ }
    }

    // ── Load & render themes ──
    async function loadCommunityThemes(filter) {
        const container = document.querySelector('.js-community-list');
        if (!container) return;
        container.innerHTML = '<div class="c-loading"><i class="fas fa-spinner fa-spin"></i> Loading community themes...</div>';

        try {
            let themes;
            if (filter === 'pending') {
                themes = await communityApi('/admin/pending');
            } else if (filter === 'all') {
                themes = await communityApi('/themes');
            } else {
                themes = await communityApi(`/themes?status=${filter}`);
            }

            if (!themes || themes.length === 0) {
                container.innerHTML = renderEmpty(filter);
                hideBulkBar();
                return;
            }

            // Apply search
            if (communitySearch) {
                themes = themes.filter(t =>
                    (t.name || '').toLowerCase().includes(communitySearch) ||
                    (t.description || '').toLowerCase().includes(communitySearch) ||
                    (t.creator_name || '').toLowerCase().includes(communitySearch)
                );
            }

            // Apply sort
            themes = sortThemes(themes, communitySort);

            if (themes.length === 0) {
                container.innerHTML = renderEmpty('matching');
                hideBulkBar();
                return;
            }

            container.innerHTML = themes.map(t => renderCard(t)).join('');
            updateBulkBar();
        } catch (e) {
            container.innerHTML = `
                <div class="c-community-empty">
                    <div class="c-community-empty__icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <p class="c-community-empty__text" style="color:var(--admin-danger);">
                        Failed to load themes: ${esc(e.detail || 'Unknown error')}
                    </p>
                </div>`;
        }
    }

    function sortThemes(themes, sort) {
        const copy = [...themes];
        switch (sort) {
            case 'oldest':    return copy.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            case 'rating':    return copy.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
            case 'questions': return copy.sort((a, b) => (b.question_count || 0) - (a.question_count || 0));
            case 'name':      return copy.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            default:          return copy.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        }
    }

    function renderEmpty(filter) {
        const messages = {
            pending:  'All caught up! No themes waiting for review.',
            approved: 'No approved themes yet.',
            rejected: 'No rejected themes.',
            all:      'No community themes have been submitted yet.',
            matching: 'No themes match your search.'
        };
        return `
            <div class="c-community-empty">
                <div class="c-community-empty__icon"><i class="fas fa-inbox"></i></div>
                <h3 class="c-community-empty__title">No ${filter === 'all' || filter === 'matching' ? '' : filter + ' '}themes</h3>
                <p class="c-community-empty__text">${messages[filter] || messages.all}</p>
            </div>`;
    }

    // ── Card rendering (CSS classes, no inline styles) ──
    function renderCard(theme) {
        const statusClass = {
            pending_review: 'pending',
            approved: 'approved',
            rejected: 'rejected',
            draft: 'draft'
        }[theme.status] || 'draft';

        const isPending = theme.status === 'pending_review';
        const isApproved = theme.status === 'approved';
        const isChecked = selectedThemeIds.has(theme.id);

        return `
        <div class="c-community-card c-community-card--${statusClass}" id="community-card-${theme.id}">
            <div class="c-community-card__head">
                <div style="display:flex;align-items:center;gap:10px;">
                    ${isPending ? `<input type="checkbox" class="js-community-select" data-id="${theme.id}" ${isChecked ? 'checked' : ''} title="Select for bulk action">` : ''}
                    <div>
                        <h3 class="c-community-card__title">${esc(theme.name)}</h3>
                        <p class="c-community-card__desc">${esc(theme.description || 'No description')}</p>
                    </div>
                </div>
                <span class="c-community-card__badge c-community-card__badge--${statusClass}">
                    ${theme.status === 'pending_review' ? 'Pending Review' : theme.status}
                </span>
            </div>
            <div class="c-community-card__meta">
                <span><i class="fas fa-user"></i> ${esc(theme.creator_name || 'Anonymous')}</span>
                <span><i class="fas fa-question-circle"></i> ${theme.question_count || 0} questions</span>
                <span><i class="fas fa-star"></i> ${(theme.avg_rating || 0).toFixed(1)} avg</span>
                <span><i class="fas fa-calendar"></i> ${theme.created_at ? new Date(theme.created_at).toLocaleDateString() : 'Unknown'}</span>
                ${theme.reviewer_notes ? `<span><i class="fas fa-comment"></i> "${esc(theme.reviewer_notes)}"</span>` : ''}
            </div>
            <div class="c-community-card__actions">
                <button class="c-btn c-btn--sm c-btn--preview" onclick="previewCommunityTheme(${theme.id})">
                    <i class="fas fa-eye"></i> Preview
                </button>
                ${isPending ? `
                    <button class="c-btn c-btn--sm c-btn--edit-community" onclick="editCommunityTheme(${theme.id})">
                        <i class="fas fa-pen"></i> Edit Questions
                    </button>
                    <button class="c-btn c-btn--sm c-btn--approve" onclick="approveCommunityTheme(${theme.id})">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="c-btn c-btn--sm c-btn--reject" onclick="showRejectModal(${theme.id})">
                        <i class="fas fa-times"></i> Reject
                    </button>
                ` : ''}
                ${isApproved ? `
                    <button class="c-btn c-btn--sm c-btn--promote" onclick="promoteCommunityTheme(${theme.id})">
                        <i class="fas fa-crown"></i> Promote to Official
                    </button>
                ` : ''}
            </div>
        </div>`;
    }

    // ── Bulk action bar ──
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('js-community-select')) {
            const id = parseInt(e.target.dataset.id);
            if (e.target.checked) selectedThemeIds.add(id);
            else selectedThemeIds.delete(id);
            updateBulkBar();
        }
    });

    function updateBulkBar() {
        hideBulkBar();
        if (selectedThemeIds.size === 0) return;

        const container = document.querySelector('.js-community-list');
        if (!container) return;

        const bar = document.createElement('div');
        bar.className = 'c-bulk-bar js-bulk-bar';
        bar.innerHTML = `
            <span class="c-bulk-bar__count">${selectedThemeIds.size} theme${selectedThemeIds.size > 1 ? 's' : ''} selected</span>
            <div class="c-bulk-bar__actions">
                <button class="c-btn c-btn--sm c-btn--approve" onclick="bulkApprove()">
                    <i class="fas fa-check-double"></i> Approve All
                </button>
                <button class="c-btn c-btn--sm c-btn--reject" onclick="bulkReject()">
                    <i class="fas fa-times"></i> Reject All
                </button>
                <button class="c-btn c-btn--sm c-btn--preview" onclick="clearSelection()">
                    <i class="fas fa-times-circle"></i> Clear
                </button>
            </div>
        `;
        container.parentElement.insertBefore(bar, container);
    }

    function hideBulkBar() {
        document.querySelectorAll('.js-bulk-bar').forEach(b => b.remove());
    }

    window.clearSelection = function () {
        selectedThemeIds.clear();
        document.querySelectorAll('.js-community-select').forEach(cb => cb.checked = false);
        hideBulkBar();
    };

    window.bulkApprove = function () {
        showConfirmDialog(`Approve ${selectedThemeIds.size} theme(s)?`, async () => {
            for (const id of [...selectedThemeIds]) {
                try {
                    await communityApi(`/admin/review/${id}`, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'approve', notes: null })
                    });
                    removeCard(id);
                } catch (e) {
                    notify(`Failed to approve theme #${id}: ${e.detail || ''}`, 'error');
                }
            }
            selectedThemeIds.clear();
            hideBulkBar();
            updateBadge();
            loadCommunityStats();
            notify('Bulk approve complete!', 'success');
        });
    };

    window.bulkReject = function () {
        showRejectModal([...selectedThemeIds]);
    };

    // ── Reject modal (replaces browser prompt) ──
    window.showRejectModal = function (themeIdOrIds) {
        const ids = Array.isArray(themeIdOrIds) ? themeIdOrIds : [themeIdOrIds];
        const isBulk = ids.length > 1;

        const overlay = document.createElement('div');
        overlay.className = 'c-reject-modal';
        overlay.innerHTML = `
            <div class="c-reject-modal__content">
                <div class="c-reject-modal__title">
                    <i class="fas fa-times-circle"></i>
                    ${isBulk ? `Reject ${ids.length} Themes` : 'Reject Theme'}
                </div>
                <p style="margin:0 0 12px;font-size:.9rem;color:var(--admin-text-light);">
                    Provide feedback to the creator so they can improve their submission.
                </p>
                <textarea class="c-reject-modal__textarea js-reject-reason" placeholder="Rejection reason (e.g. 'Questions need more variety', 'Answers are incorrect')..."></textarea>
                <div class="c-reject-modal__actions">
                    <button class="c-btn c-btn--sm c-btn--cancel js-reject-cancel">Cancel</button>
                    <button class="c-btn c-btn--sm c-btn--reject js-reject-confirm">
                        <i class="fas fa-times"></i> Reject${isBulk ? ' All' : ''}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const textarea = overlay.querySelector('.js-reject-reason');
        textarea.focus();

        overlay.querySelector('.js-reject-cancel').onclick = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('.js-reject-confirm').onclick = async () => {
            const reason = textarea.value.trim() || null;
            overlay.querySelector('.js-reject-confirm').disabled = true;
            overlay.querySelector('.js-reject-confirm').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rejecting...';

            for (const id of ids) {
                try {
                    await communityApi(`/admin/review/${id}`, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'reject', notes: reason })
                    });
                    removeCard(id);
                } catch (e) {
                    notify(`Failed to reject theme #${id}: ${e.detail || ''}`, 'error');
                }
            }

            overlay.remove();
            selectedThemeIds.clear();
            hideBulkBar();
            updateBadge();
            loadCommunityStats();
            notify(isBulk ? `Rejected ${ids.length} themes.` : 'Theme rejected.', 'info');
        };
    };

    // ── Preview modal ──
    window.previewCommunityTheme = async function (themeId) {
        try {
            const theme = await communityApi(`/themes/${themeId}`);
            let questions = [];
            try { questions = await communityApi(`/themes/${themeId}/questions`); } catch {}

            const modal = document.getElementById('editModal');
            const title = modal.querySelector('.c-modal-title');
            const form = modal.querySelector('.c-edit-form');

            title.textContent = `Preview: ${theme.name}`;
            form.innerHTML = `
                <div class="c-preview-section">
                    <div class="c-preview-meta">
                        <div><strong>Description</strong><br><span>${esc(theme.description || 'No description')}</span></div>
                        <div><strong>Status</strong><br><span style="text-transform:capitalize;">${theme.status}</span></div>
                        <div><strong>Creator</strong><br><span>${esc(theme.creator_name || 'Anonymous')}</span></div>
                        <div><strong>Rating</strong><br><span>${(theme.avg_rating || 0).toFixed(1)}/5</span></div>
                    </div>
                    <hr style="border:none;border-top:1px solid rgba(0,0,0,.08);margin:16px 0;">
                    <h3 style="margin-bottom:12px;font-size:1rem;">Questions (${questions.length})</h3>
                    ${questions.length === 0 ? '<p class="c-community-empty__text">No questions in this theme.</p>' : ''}
                    ${questions.map((q, i) => `
                        <div class="c-preview-question">
                            <div class="c-preview-question__text">${i + 1}. ${esc(q.question_text)}</div>
                            <div class="c-preview-question__answers">
                                ${(q.answers || []).map(a => `
                                    <span class="c-preview-answer ${a.is_correct ? 'c-preview-answer--correct' : 'c-preview-answer--incorrect'}">
                                        ${a.is_correct ? '✓' : '✗'} ${esc(a.answer_text)}
                                    </span>
                                `).join('')}
                            </div>
                            ${q.explanation ? `<div class="c-preview-question__explanation"><em>${esc(q.explanation)}</em></div>` : ''}
                            <div class="c-preview-question__detail">
                                Difficulty: ${q.difficulty || 'medium'} &middot; Points: ${q.points || 10} &middot; Time: ${q.time_limit || 30}s
                            </div>
                        </div>
                    `).join('')}
                    <div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap;">
                        ${theme.status === 'pending_review' ? `
                            <button type="button" class="c-btn c-btn--sm c-btn--approve" onclick="document.getElementById('editModal').style.display='none';approveCommunityTheme(${theme.id})">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button type="button" class="c-btn c-btn--sm c-btn--reject" onclick="document.getElementById('editModal').style.display='none';showRejectModal(${theme.id})">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        ` : ''}
                        <button type="button" class="c-btn c-btn--sm c-btn--cancel" onclick="document.getElementById('editModal').style.display='none';">
                            Close
                        </button>
                    </div>
                </div>`;

            modal.style.display = 'block';
        } catch (e) {
            notify('Failed to load theme preview: ' + (e.detail || ''), 'error');
        }
    };

    // ── Edit questions before approving ──
    window.editCommunityTheme = async function (themeId) {
        try {
            const theme = await communityApi(`/themes/${themeId}`);
            let questions = [];
            try { questions = await communityApi(`/themes/${themeId}/questions`); } catch {}

            const modal = document.getElementById('editModal');
            const title = modal.querySelector('.c-modal-title');
            const form = modal.querySelector('.c-edit-form');

            title.textContent = `Edit: ${theme.name}`;
            form.innerHTML = `
                <div class="c-preview-section">
                    <div class="c-form-group">
                        <label>Theme Name</label>
                        <input type="text" class="c-form-input js-edit-theme-name" value="${esc(theme.name)}">
                    </div>
                    <div class="c-form-group">
                        <label>Description</label>
                        <textarea class="c-form-input js-edit-theme-desc" rows="2" style="resize:vertical;">${esc(theme.description || '')}</textarea>
                    </div>
                    <hr style="border:none;border-top:1px solid rgba(0,0,0,.08);margin:16px 0;">
                    <h3 style="margin-bottom:12px;font-size:1rem;">Questions (${questions.length})</h3>
                    <div class="js-edit-questions-container">
                        ${questions.map((q, i) => renderEditableQuestion(q, i)).join('')}
                    </div>
                    ${questions.length === 0 ? '<p class="c-community-empty__text">No questions to edit.</p>' : ''}
                    <div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap;">
                        <button type="button" class="c-btn c-btn--sm c-btn--primary js-save-community-edits" data-theme-id="${themeId}">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                        <button type="button" class="c-btn c-btn--sm c-btn--approve js-save-and-approve" data-theme-id="${themeId}">
                            <i class="fas fa-check"></i> Save & Approve
                        </button>
                        <button type="button" class="c-btn c-btn--sm c-btn--cancel" onclick="document.getElementById('editModal').style.display='none';">
                            Cancel
                        </button>
                    </div>
                </div>`;

            // Attach save handlers
            form.querySelector('.js-save-community-edits').onclick = () => saveCommunityEdits(themeId, false);
            form.querySelector('.js-save-and-approve').onclick = () => saveCommunityEdits(themeId, true);

            modal.style.display = 'block';
        } catch (e) {
            notify('Failed to load theme for editing: ' + (e.detail || ''), 'error');
        }
    };

    function renderEditableQuestion(q, i) {
        return `
        <div class="c-preview-question js-editable-question" data-question-id="${q.id}">
            <div class="c-form-group" style="margin-bottom:8px;">
                <label style="font-size:.8rem;color:var(--admin-text-light);">Question ${i + 1}</label>
                <input type="text" class="c-form-input js-eq-text" value="${esc(q.question_text)}" style="font-weight:600;">
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
                ${(q.answers || []).map((a, ai) => `
                    <div style="display:flex;align-items:center;gap:4px;flex:1;min-width:200px;">
                        <input type="checkbox" class="js-eq-correct" data-answer-index="${ai}" ${a.is_correct ? 'checked' : ''} title="Correct?">
                        <input type="text" class="c-form-input js-eq-answer" data-answer-index="${ai}" value="${esc(a.answer_text)}" style="font-size:.85rem;padding:6px 10px;">
                    </div>
                `).join('')}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <div style="flex:1;min-width:120px;">
                    <label style="font-size:.75rem;color:var(--admin-text-light);">Difficulty</label>
                    <select class="c-form-select js-eq-difficulty" style="padding:6px 10px;font-size:.85rem;">
                        <option value="easy" ${q.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
                        <option value="medium" ${q.difficulty === 'medium' || !q.difficulty ? 'selected' : ''}>Medium</option>
                        <option value="hard" ${q.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
                    </select>
                </div>
                <div style="flex:1;min-width:80px;">
                    <label style="font-size:.75rem;color:var(--admin-text-light);">Points</label>
                    <input type="number" class="c-form-input js-eq-points" value="${q.points || 10}" min="1" style="padding:6px 10px;font-size:.85rem;">
                </div>
                <div style="flex:1;min-width:80px;">
                    <label style="font-size:.75rem;color:var(--admin-text-light);">Time (s)</label>
                    <input type="number" class="c-form-input js-eq-time" value="${q.time_limit || 30}" min="5" style="padding:6px 10px;font-size:.85rem;">
                </div>
            </div>
            ${q.explanation ? `
                <div class="c-form-group" style="margin-top:8px;">
                    <label style="font-size:.75rem;color:var(--admin-text-light);">Explanation</label>
                    <textarea class="c-form-input js-eq-explanation" rows="2" style="font-size:.85rem;padding:6px 10px;resize:vertical;">${esc(q.explanation)}</textarea>
                </div>
            ` : ''}
            <button type="button" class="c-btn c-btn--sm c-btn--reject" style="margin-top:8px;font-size:.78rem;padding:4px 10px;"
                    onclick="this.closest('.js-editable-question').remove();">
                <i class="fas fa-trash"></i> Remove
            </button>
        </div>`;
    }

    async function saveCommunityEdits(themeId, alsoApprove) {
        const form = document.querySelector('.c-edit-form');
        if (!form) return;

        const themeName = form.querySelector('.js-edit-theme-name')?.value.trim();
        const themeDesc = form.querySelector('.js-edit-theme-desc')?.value.trim();

        try {
            if (themeName) {
                await communityApi(`/themes/${themeId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ name: themeName, description: themeDesc || '' })
                });
            }
        } catch (e) {
            notify('Failed to update theme: ' + (e.detail || ''), 'error');
            return;
        }

        const questionEls = form.querySelectorAll('.js-editable-question');
        for (const qEl of questionEls) {
            const questionId = parseInt(qEl.dataset.questionId);
            const text = qEl.querySelector('.js-eq-text')?.value.trim();
            const difficulty = qEl.querySelector('.js-eq-difficulty')?.value;
            const points = parseInt(qEl.querySelector('.js-eq-points')?.value) || 10;
            const timeLimit = parseInt(qEl.querySelector('.js-eq-time')?.value) || 30;
            const explanation = qEl.querySelector('.js-eq-explanation')?.value?.trim();

            try {
                const update = { question_text: text, difficulty, points, time_limit: timeLimit };
                if (explanation !== undefined) update.explanation = explanation;
                await communityApi(`/questions/${questionId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(update)
                });
            } catch (e) {
                notify(`Failed to update question #${questionId}: ${e.detail || ''}`, 'error');
            }
        }

        notify('Changes saved!', 'success');

        if (alsoApprove) {
            try {
                await communityApi(`/admin/review/${themeId}`, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'approve', notes: null })
                });
                notify('Theme approved!', 'success');
                document.getElementById('editModal').style.display = 'none';
                removeCard(themeId);
                updateBadge();
                loadCommunityStats();
            } catch (e) {
                notify('Saved but failed to approve: ' + (e.detail || ''), 'error');
            }
        } else {
            document.getElementById('editModal').style.display = 'none';
            loadCommunityThemes(communityFilter);
        }
    }

    // ── Approve ──
    window.approveCommunityTheme = async function (themeId) {
        if (typeof window.showConfirmDialog === 'function') {
            window.showConfirmDialog('Approve this community theme?', async () => {
                await doApprove(themeId);
            });
        } else {
            if (!confirm('Approve this community theme?')) return;
            await doApprove(themeId);
        }
    };

    async function doApprove(themeId) {
        try {
            await communityApi(`/admin/review/${themeId}`, {
                method: 'POST',
                body: JSON.stringify({ action: 'approve', notes: null })
            });
            notify('Theme approved!', 'success');
            removeCard(themeId);
            updateBadge();
            loadCommunityStats();
        } catch (e) {
            notify('Failed to approve: ' + (e.detail || ''), 'error');
        }
    }

    // ── Promote ──
    window.promoteCommunityTheme = async function (themeId) {
        if (typeof window.showConfirmDialog === 'function') {
            window.showConfirmDialog(
                'Promote this community theme to an official quiz theme? This copies the theme and all its questions into the main quiz system.',
                async () => { await doPromote(themeId); }
            );
        } else {
            if (!confirm('Promote this theme to official?')) return;
            await doPromote(themeId);
        }
    };

    async function doPromote(themeId) {
        try {
            await communityApi(`/admin/promote/${themeId}`, { method: 'POST' });
            notify('Theme promoted to official! It\'s now in the main quiz rotation.', 'success');
            loadCommunityThemes(communityFilter);
            loadCommunityStats();
        } catch (e) {
            notify('Promotion failed: ' + (e.detail || ''), 'error');
        }
    }

    // ── Card removal animation ──
    function removeCard(themeId) {
        const card = document.getElementById(`community-card-${themeId}`);
        if (card) {
            card.style.transition = 'opacity .3s, transform .3s, max-height .3s';
            card.style.opacity = '0';
            card.style.transform = 'translateX(20px)';
            card.style.overflow = 'hidden';
            setTimeout(() => {
                card.style.maxHeight = '0';
                card.style.padding = '0';
                card.style.margin = '0';
                card.style.border = 'none';
            }, 250);
            setTimeout(() => card.remove(), 500);
        }
        selectedThemeIds.delete(themeId);
    }

    // On page load, update the community badge
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(updateBadge, 1000);
    });
})();
