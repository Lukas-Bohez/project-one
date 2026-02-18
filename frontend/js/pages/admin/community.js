/**
 * Admin Panel — Community Themes Review
 * Manages pending community themes: view, approve, reject, promote to official
 */

(function () {
    'use strict';

    const API_BASE = `https://${window.location.hostname}/api/v1/community`;
    let communityFilter = 'pending';

    function getAuthHeaders() {
        const userId = sessionStorage.getItem('admin_user_id');
        const rfidCode = sessionStorage.getItem('admin_rfid_code');
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
        if (opts.body instanceof FormData) {
            delete headers['Content-Type'];
        }
        const r = await fetch(url, { ...opts, headers });
        const data = await r.json().catch(() => null);
        if (!r.ok) throw { status: r.status, detail: data?.detail || r.statusText };
        return data;
    }

    function escHTML(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function showNotification(message, type = 'info') {
        // Reuse admin notification system if available, otherwise console
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            const el = document.createElement('div');
            el.style.cssText = `
                position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;z-index:10000;
                color:#fff;font-weight:500;font-size:0.9rem;animation:fadeIn .3s ease;
                background:${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
                box-shadow:0 4px 12px rgba(0,0,0,.3);
            `;
            el.textContent = message;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 4000);
        }
    }

    // Load community tab data
    window.loadCommunityTab = async function () {
        updateBadge();
        loadCommunityStats();
        loadCommunityThemes(communityFilter);
        setupFilterButtons();
    };

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
                loadCommunityThemes(communityFilter);
            };
        });
    }

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

    async function loadCommunityStats() {
        try {
            const stats = await communityApi('/admin/stats');
            const el = (sel) => document.querySelector(sel);
            if (el('.js-pending-count')) el('.js-pending-count').textContent = stats.pending_themes || 0;
            if (el('.js-approved-count')) el('.js-approved-count').textContent = stats.approved_themes || 0;
            if (el('.js-promoted-count')) el('.js-promoted-count').textContent = stats.promoted_themes || 0;
        } catch { /* stats may not have all fields */ }
    }

    async function loadCommunityThemes(filter) {
        const container = document.querySelector('.js-community-list');
        if (!container) return;

        container.innerHTML = '<div class="c-loading">Loading community themes...</div>';

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
                container.innerHTML = `
                    <div class="c-empty-state" style="text-align:center;padding:40px 20px;">
                        <i class="fas fa-inbox" style="font-size:3rem;color:var(--admin-text-muted,#6b7280);margin-bottom:12px;display:block;"></i>
                        <h3 style="margin-bottom:8px;">No ${filter === 'all' ? '' : filter + ' '}themes</h3>
                        <p style="color:var(--admin-text-muted,#6b7280);">
                            ${filter === 'pending' ? 'All caught up! No themes waiting for review.' : `No themes with status "${filter}".`}
                        </p>
                    </div>`;
                return;
            }

            container.innerHTML = themes.map(t => renderCommunityCard(t)).join('');
        } catch (e) {
            container.innerHTML = `
                <div class="c-empty-state" style="text-align:center;padding:40px 20px;color:var(--admin-danger,#ef4444);">
                    <i class="fas fa-exclamation-triangle" style="font-size:2rem;margin-bottom:12px;display:block;"></i>
                    <p>Failed to load community themes: ${escHTML(e.detail || 'Unknown error')}</p>
                </div>`;
        }
    }

    function renderCommunityCard(theme) {
        const statusColors = {
            pending_review: '#f59e0b',
            approved: '#10b981',
            rejected: '#ef4444',
            draft: '#6b7280'
        };
        const statusColor = statusColors[theme.status] || '#6b7280';
        const isPending = theme.status === 'pending_review';

        return `
            <div class="c-community-card" id="community-card-${theme.id}" style="
                background:var(--admin-card-bg,#1e1e2e);border:1px solid var(--admin-border,#2e2e4e);
                border-radius:12px;padding:20px;margin-bottom:16px;
                ${isPending ? 'border-left:4px solid #f59e0b;' : ''}
            ">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                    <div>
                        <h3 style="margin:0 0 4px 0;font-size:1.1rem;">${escHTML(theme.name)}</h3>
                        <p style="margin:0;color:var(--admin-text-muted,#9ca3af);font-size:0.9rem;">${escHTML(theme.description || 'No description')}</p>
                    </div>
                    <span style="
                        background:${statusColor}22;color:${statusColor};
                        padding:4px 12px;border-radius:20px;font-size:0.8rem;font-weight:600;white-space:nowrap;
                    ">${theme.status}</span>
                </div>
                <div style="display:flex;gap:16px;font-size:0.85rem;color:var(--admin-text-muted,#9ca3af);margin-bottom:16px;flex-wrap:wrap;">
                    <span><i class="fas fa-user"></i> ${escHTML(theme.creator_name || 'Anonymous')}</span>
                    <span><i class="fas fa-question-circle"></i> ${theme.question_count || 0} questions</span>
                    <span><i class="fas fa-star"></i> ${(theme.avg_rating || 0).toFixed(1)} avg rating</span>
                    <span><i class="fas fa-calendar"></i> ${theme.created_at ? new Date(theme.created_at).toLocaleDateString() : 'Unknown date'}</span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="c-btn c-btn--sm" onclick="previewCommunityTheme(${theme.id})" style="background:var(--admin-bg-hover,#2a2a3e);">
                        <i class="fas fa-eye"></i> Preview
                    </button>
                    ${isPending ? `
                        <button class="c-btn c-btn--sm" onclick="approveCommunityTheme(${theme.id})" style="background:#10b981;color:#fff;">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="c-btn c-btn--sm" onclick="rejectCommunityTheme(${theme.id})" style="background:#ef4444;color:#fff;">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                    ${theme.status === 'approved' ? `
                        <button class="c-btn c-btn--sm" onclick="promoteCommunityTheme(${theme.id})" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;">
                            <i class="fas fa-crown"></i> Promote to Official
                        </button>
                    ` : ''}
                </div>
            </div>`;
    }

    // Preview a community theme in the existing edit modal
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
                <div style="padding:12px 0;">
                    <div style="margin-bottom:16px;">
                        <strong>Description:</strong><br>
                        <span style="color:var(--admin-text-muted,#9ca3af);">${escHTML(theme.description || 'No description')}</span>
                    </div>
                    <div style="margin-bottom:16px;">
                        <strong>Status:</strong> <span style="text-transform:capitalize;">${theme.status}</span> &nbsp;|&nbsp;
                        <strong>Creator:</strong> ${escHTML(theme.creator_name || 'Anonymous')} &nbsp;|&nbsp;
                        <strong>Rating:</strong> ${(theme.avg_rating || 0).toFixed(1)}/5
                    </div>
                    <hr style="border-color:var(--admin-border,#2e2e4e);margin:16px 0;">
                    <h3 style="margin-bottom:12px;">Questions (${questions.length})</h3>
                    ${questions.length === 0 ? '<p style="color:var(--admin-text-muted,#9ca3af);">No questions in this theme.</p>' : ''}
                    ${questions.map((q, i) => `
                        <div style="background:var(--admin-bg-hover,#2a2a3e);border-radius:8px;padding:12px;margin-bottom:10px;">
                            <div style="font-weight:600;margin-bottom:8px;">${i+1}. ${escHTML(q.question_text)}</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                                ${(q.answers || []).map(a => `
                                    <span style="
                                        padding:4px 10px;border-radius:6px;font-size:0.85rem;
                                        background:${a.is_correct ? '#10b98133' : '#ef444433'};
                                        color:${a.is_correct ? '#10b981' : '#ef4444'};
                                    ">${a.is_correct ? '✓' : '✗'} ${escHTML(a.answer_text)}</span>
                                `).join('')}
                            </div>
                            ${q.explanation ? `<div style="margin-top:6px;font-size:0.8rem;color:var(--admin-text-muted,#9ca3af);"><em>${escHTML(q.explanation)}</em></div>` : ''}
                            <div style="margin-top:6px;font-size:0.8rem;color:var(--admin-text-muted,#9ca3af);">
                                Difficulty: ${q.difficulty || 'medium'} | Points: ${q.points || 10} | Time: ${q.time_limit || 30}s
                            </div>
                        </div>
                    `).join('')}
                    <div style="margin-top:20px;display:flex;gap:8px;">
                        <button type="button" class="c-btn c-btn--sm" onclick="document.getElementById('editModal').style.display='none';" style="background:var(--admin-bg-hover,#2a2a3e);">
                            Close
                        </button>
                    </div>
                </div>`;

            modal.style.display = 'block';
        } catch (e) {
            showNotification('Failed to load theme preview: ' + (e.detail || ''), 'error');
        }
    };

    window.approveCommunityTheme = async function (themeId) {
        if (!confirm('Approve this community theme?')) return;
        try {
            await communityApi(`/admin/review/${themeId}`, {
                method: 'POST',
                body: JSON.stringify({ action: 'approve', notes: null })
            });
            showNotification('Theme approved!', 'success');
            removeCard(themeId);
            updateBadge();
            loadCommunityStats();
        } catch (e) {
            showNotification('Failed to approve: ' + (e.detail || ''), 'error');
        }
    };

    window.rejectCommunityTheme = async function (themeId) {
        const reason = prompt('Rejection reason (optional):');
        try {
            await communityApi(`/admin/review/${themeId}`, {
                method: 'POST',
                body: JSON.stringify({ action: 'reject', notes: reason || null })
            });
            showNotification('Theme rejected.', 'info');
            removeCard(themeId);
            updateBadge();
            loadCommunityStats();
        } catch (e) {
            showNotification('Failed to reject: ' + (e.detail || ''), 'error');
        }
    };

    window.promoteCommunityTheme = async function (themeId) {
        if (!confirm('Promote this community theme to an official quiz theme? This copies the theme and all its questions into the main quiz system.')) return;
        try {
            await communityApi(`/admin/promote/${themeId}`, { method: 'POST' });
            showNotification('Theme promoted to official! It will now appear in the main quiz rotation.', 'success');
            loadCommunityThemes(communityFilter);
            loadCommunityStats();
        } catch (e) {
            showNotification('Promotion failed: ' + (e.detail || ''), 'error');
        }
    };

    function removeCard(themeId) {
        const card = document.getElementById(`community-card-${themeId}`);
        if (card) {
            card.style.transition = 'opacity .3s, transform .3s';
            card.style.opacity = '0';
            card.style.transform = 'translateX(20px)';
            setTimeout(() => card.remove(), 300);
        }
    }

    // On page load, update the community badge
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(updateBadge, 1000);
    });
})();
