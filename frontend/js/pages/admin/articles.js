// #region ***  Articles Management                      ***********

// Articles state
let articlesState = {
    articles: [],
    currentPage: 1,
    totalPages: 1,
    filters: {
        search: '',
        status: '',
        sortBy: 'created_at',
        storyId: ''
    },
    stories: [],
    stats: {
        total: 0,
        published: 0,
        draft: 0,
        archived: 0
    }
};

// Make state accessible to other scripts (e.g., admin.js)
window.articlesState = articlesState;

// #endregion

// #region ***  API Functions                            ***********

const fetchArticles = async (page = 1, limit = 10) => {
    try {
        const params = new URLSearchParams({ page, limit });
        // Use backend endpoints appropriately
        let url = `${lanIP}/api/v1/articles/?${params}`;
        if (articlesState.filters.storyId) {
            url = `${lanIP}/api/v1/articles/by-story/${encodeURIComponent(articlesState.filters.storyId)}/`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        // If by-story endpoint returns a list, normalize to state shape
        if (Array.isArray(data)) {
            articlesState.articles = data;
            articlesState.currentPage = 1;
            articlesState.totalPages = 1;
        } else {
            articlesState.articles = data.articles || [];
            articlesState.currentPage = data.page || 1;
            articlesState.totalPages = data.total_pages || 1;
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching articles:', error);
        showNotification('Error loading articles', 'error');
        return { articles: [], total: 0, page: 1, total_pages: 1 };
    }
};

// Fetch stories list for filtering/UI
const fetchStories = async () => {
    try {
        const response = await fetch(`${lanIP}/api/v1/stories/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (e) {
        console.warn('Failed to fetch stories:', e);
        return [];
    }
};

const fetchArticleStats = async () => {
    try {
        const response = await fetch(`${lanIP}/api/v1/articles/stats/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const stats = await response.json();
        articlesState.stats = stats;
        
        return stats;
    } catch (error) {
        console.error('Error fetching article stats:', error);
        return { total: 0, published: 0, draft: 0, archived: 0 };
    }
};

const createArticle = async (articleData) => {
    try {
        const userId = sessionStorage.getItem('admin_user_id');
        const rfidCode = sessionStorage.getItem('admin_rfid_code');
        
        if (!userId || !rfidCode) {
            throw new Error('Authentication required. Please log in as admin first.');
        }
        
        const response = await fetch(`${lanIP}/api/v1/articles/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId,
                'X-RFID': rfidCode
            },
            body: JSON.stringify(articleData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const newArticle = await response.json();
        showNotification('Article created successfully!', 'success');
        return newArticle;
    } catch (error) {
        console.error('Error creating article:', error);
        showNotification(`Error creating article: ${error.message}`, 'error');
        throw error;
    }
};

const updateArticle = async (articleId, articleData) => {
    try {
        const userId = sessionStorage.getItem('admin_user_id');
        const rfidCode = sessionStorage.getItem('admin_rfid_code');
        
        if (!userId || !rfidCode) {
            throw new Error('Authentication required. Please log in as admin first.');
        }
        
        const response = await fetch(`${lanIP}/api/v1/articles/${articleId}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId,
                'X-RFID': rfidCode
            },
            body: JSON.stringify(articleData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const updatedArticle = await response.json();
        showNotification('Article updated successfully!', 'success');
        return updatedArticle;
    } catch (error) {
        console.error('Error updating article:', error);
        showNotification(`Error updating article: ${error.message}`, 'error');
        throw error;
    }
};

const deleteArticle = async (articleId) => {
    try {
        const userId = sessionStorage.getItem('admin_user_id');
        const rfidCode = sessionStorage.getItem('admin_rfid_code');
        
        if (!userId || !rfidCode) {
            throw new Error('Authentication required. Please log in as admin first.');
        }
        
        const response = await fetch(`${lanIP}/api/v1/articles/${articleId}/`, {
            method: 'DELETE',
            headers: {
                'X-User-ID': userId,
                'X-RFID': rfidCode
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        showNotification('Article deleted successfully!', 'success');
        return true;
    } catch (error) {
        console.error('Error deleting article:', error);
        showNotification(`Error deleting article: ${error.message}`, 'error');
        throw error;
    }
};

const updateArticleStatus = async (articleId, status) => {
    try {
        // Map friendly status string to backend payload
        let payload = {};
        if (status === 'published' || status === true) {
            payload = { is_active: true };
        } else if (status === 'draft' || status === false || status === 'archived') {
            // Treat archived the same as draft (inactive) for now
            payload = { is_active: false };
        } else if (typeof status === 'object' && status !== null) {
            payload = status; // allow direct payloads like { is_featured: true }
        } else {
            payload = { is_active: false };
        }
        const userId = sessionStorage.getItem('admin_user_id');
        const rfidCode = sessionStorage.getItem('admin_rfid_code');

        if (!userId || !rfidCode) {
            throw new Error('Authentication required. Please log in as admin first.');
        }

        const response = await fetch(`${lanIP}/api/v1/articles/${articleId}/status/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId,
                'X-RFID': rfidCode
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const updatedArticle = await response.json();
        const verb = payload.is_active ? 'published' : 'unpublished';
        showNotification(`Article ${verb} successfully!`, 'success');
        return updatedArticle;
    } catch (error) {
        console.error('Error updating article status:', error);
        showNotification(`Error updating article status: ${error.message}`, 'error');
        throw error;
    }
};

// #endregion

// #region ***  UI Functions                             ***********

const loadArticles = async (page = 1) => {
    const articleList = document.querySelector('.c-article-list');
    if (!articleList) return;

    showLoading(articleList);

    try {
        // If a specific story is selected, fetch only that story's articles
        if (articlesState.filters.storyId) {
            await fetchArticles(page);
        } else {
            // No specific story selected: render grouped-by-story view
            await renderArticlesGrouped();
            // Still update stats for the header cards
            await fetchArticleStats();
            renderArticleStats();
            return; // We've already rendered grouped view
        }
        // If filtering by story, ensure we have stories cached to show the header
        if (articlesState.filters.storyId) {
            try {
                if (!Array.isArray(articlesState.stories) || articlesState.stories.length === 0) {
                    const stories = await fetchStories();
                    if (Array.isArray(stories)) {
                        articlesState.stories = stories;
                    }
                }
            } catch (e) {
                console.warn('Could not load stories for header:', e);
            }
            // Compute stats from filtered articles
            const totals = (articlesState.articles || []).reduce((acc, a) => {
                acc.total += 1;
                if (a.is_active) acc.active += 1;
                if (a.is_featured) acc.featured += 1;
                return acc;
            }, { total: 0, active: 0, featured: 0 });
            articlesState.stats = {
                total_articles: totals.total,
                active_articles: totals.active,
                featured_articles: totals.featured,
                by_category: [], top_authors: [], most_viewed: []
            };
        } else {
            // For flat view (if used), still fetch global stats
            // Note: grouped view returns early above
        }
        // When story filtered, we already computed stats; otherwise fallback to backend
        if (!articlesState.filters.storyId) {
            await fetchArticleStats();
        }
        
        renderArticles();
        renderArticleStats();
        updatePagination();
    } catch (error) {
        articleList.innerHTML = '<div class="c-error-state">Error loading articles. Please try again.</div>';
    }
};

// Render grouped-by-story articles for the Articles tab (no story filter selected)
const renderArticlesGrouped = async () => {
    const articleList = document.querySelector('.c-article-list');
    if (!articleList) return;

    try {
        const stories = await fetchStories();
        articlesState.stories = Array.isArray(stories) ? stories : [];
        if (!stories || stories.length === 0) {
            articleList.innerHTML = `
                <div class="c-empty-state">
                    <i class="fas fa-book-open"></i>
                    <h3>No stories yet</h3>
                    <p>Create articles with a story to get started.</p>
                </div>
            `;
            return;
        }

        // Fetch all story articles in parallel
        const perStoryArticles = await Promise.all(stories.map(async (s) => {
            try {
                const res = await fetch(`${lanIP}/api/v1/articles/by-story/${encodeURIComponent(s.id)}/`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const list = await res.json();
                // Order defensively by story_order
                list.sort((a, b) => (a.story_order ?? 0) - (b.story_order ?? 0));
                return { story: s, articles: list };
            } catch (e) {
                console.warn('Failed to load articles for story', s.id, e);
                return { story: s, articles: [] };
            }
        }));

        // Compute and set stats from grouped data (fallback if backend stats differ)
        const totals = perStoryArticles.reduce((acc, group) => {
            acc.total += group.articles.length;
            for (const a of group.articles) {
                if (a.is_active) acc.active += 1;
                if (a.is_featured) acc.featured += 1;
            }
            return acc;
        }, { total: 0, active: 0, featured: 0 });
        articlesState.stats = {
            total_articles: totals.total,
            active_articles: totals.active,
            featured_articles: totals.featured,
            by_category: [],
            top_authors: [],
            most_viewed: []
        };

        // Build HTML: story header + items for each story that has articles
        const html = perStoryArticles.map(({ story, articles }) => {
            if (!articles || articles.length === 0) return '';
            const headerHtml = `
                <div class="c-story-header">
                    <h2 class="c-story-title"><i class="fas fa-book-open"></i> ${escapeHTML(story.name)}</h2>
                    ${story.description ? `<p class=\"c-story-desc\">${escapeHTML(story.description)}</p>` : ''}
                    <div class="c-story-meta">${articles.length} article(s)</div>
                </div>
            `;
            const items = articles.map(a => createArticleElement(a)).join('');
            return `<section class="c-story-group">${headerHtml}${items}</section>`;
        }).join('');

        articleList.innerHTML = html || `
            <div class="c-empty-state">
                <i class="fas fa-newspaper"></i>
                <h3>No articles found</h3>
            </div>
        `;

        // Attach event listeners to the newly created buttons
        attachArticleButtonListeners(articleList);

        if (window.themeManager) {
            window.themeManager.applyTheme();
        }

        // Render the stats header from computed values
        renderArticleStats();
    } catch (error) {
        console.error('Error rendering grouped articles:', error);
        articleList.innerHTML = '<div class="c-error-state">Failed to load stories and articles.</div>';
    }
};

// Simple read-only view modal for an article (enhanced to show full JSON content)
// Exposed on window so the Stories tab can also use it
const showArticleDetails = window.showArticleDetails = (article) => {
    const modal = domAdmin.editModal;
    const modalTitle = modal.querySelector('.c-modal-title');
    const form = modal.querySelector('.c-edit-form');
    modalTitle.textContent = 'View Article';
    let contentData = {};
    try {
        contentData = typeof article.content === 'string' ? JSON.parse(article.content) : (article.content || {});
    } catch {}

    const highlightsHtml = (() => {
        if (!Array.isArray(contentData.highlights) || contentData.highlights.length === 0) return '';
        return `
            <div class="content-highlights">
                <h3 class="content-section-title"><i class="fas fa-star"></i> Highlights</h3>
                <div class="content-highlights-grid">
                    ${contentData.highlights.map(h => {
                        if (typeof h === 'object') {
                            return `
                                <div class="content-highlight-item">
                                    <h4 class="content-highlight-title">${escapeHTML(h.title || '')}</h4>
                                    ${h.content ? `<p class="content-highlight-content">${escapeHTML(h.content)}</p>` : ''}
                                </div>
                            `;
                        }
                        return `<div class="content-highlight-item"><p class="content-highlight-content">${escapeHTML(String(h))}</p></div>`;
                    }).join('')}
                </div>
            </div>`;
    })();

    const cardsHtml = (() => {
        if (!Array.isArray(contentData.cards) || contentData.cards.length === 0) return '';
        return `
            <div class="content-cards">
                <h3 class="content-section-title"><i class="fas fa-th-large"></i> Cards</h3>
                <div class="content-cards-grid">
                    ${contentData.cards.map(card => {
                        const listHtml = Array.isArray(card.list) && card.list.length
                            ? `<ul class="content-card-list">${card.list.map(li => `<li>${escapeHTML(String(li))}</li>`).join('')}</ul>`
                            : '';
                        const imgHtml = card.image ? `<div class="content-card-image"><img src="${escapeHTML(card.image)}" alt="${escapeHTML(card.title || 'Card image')}"></div>` : '';
                        return `
                            <div class="content-card">
                                <h4 class="content-card-title">${escapeHTML(card.title || '')}</h4>
                                ${imgHtml}
                                ${card.content ? `<p class="content-card-content">${escapeHTML(card.content)}</p>` : ''}
                                ${listHtml}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>`;
    })();

    const sectionsHtml = (() => {
        if (!Array.isArray(contentData.sections) || contentData.sections.length === 0) return '';
        return `
            <div class="content-sections">
                ${contentData.sections.map(sec => `
                    <div class="content-section">
                        <h3 class="content-section-heading">${escapeHTML(sec.title || '')}</h3>
                        ${sec.content ? `<p class="content-section-text">${escapeHTML(sec.content)}</p>` : ''}
                        ${Array.isArray(sec.list) && sec.list.length ? `<ul class="content-section-list">${sec.list.map(li => `<li>${escapeHTML(String(li))}</li>`).join('')}</ul>` : ''}
                    </div>
                `).join('')}
            </div>`;
    })();

    form.innerHTML = `
        <div class="content-enhancement-container">
            <div class="content-article-header">
                <h1 class="content-article-title">${escapeHTML(article.title)}</h1>
                <div class="content-article-meta">
                    <div class="content-meta-item"><i class="fas fa-user"></i> ${escapeHTML(article.author || '')}</div>
                    <div class="content-meta-item"><i class="fas fa-calendar-alt"></i> ${article.date_written || ''}</div>
                    <div class="content-meta-item"><i class="fas fa-hashtag"></i> Order: ${article.story_order ?? 0}</div>
                    ${article.view_count !== undefined ? `<div class="content-meta-item"><i class="fas fa-eye"></i> ${article.view_count} views</div>` : ''}
                </div>
            </div>
            ${contentData.intro || article.excerpt ? `<p class="content-article-intro">${escapeHTML(contentData.intro || article.excerpt || '')}</p>` : ''}
            ${highlightsHtml}
            ${cardsHtml}
            ${sectionsHtml}
            <div class="c-form-actions">
                <button type="button" class="c-btn c-btn--cancel js-close-modal">Close</button>
            </div>
        </div>
    `;
    modal.style.display = 'block';
    const closeBtn = modal.querySelector('.js-close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideEditModal, { once: true });
    }
};

const renderArticles = () => {
    const articleList = document.querySelector('.c-article-list');
    if (!articleList) return;

    // If story filter active, ensure ordering by story_order (server should already do this)
    if (articlesState.filters.storyId && Array.isArray(articlesState.articles)) {
        articlesState.articles.sort((a, b) => (a.story_order ?? 0) - (b.story_order ?? 0));
    }

    if (articlesState.articles.length === 0) {
        articleList.innerHTML = `
            <div class="c-empty-state">
                <i class="fas fa-newspaper"></i>
                <h3>No articles found</h3>
                <p>Create your first article to get started!</p>
                <button class="c-btn c-btn--primary js-add-article">
                    <i class="fas fa-plus"></i> Add Article
                </button>
            </div>
        `;
        return;
    }

    // When filtering by a specific story, show a story header and the ordered articles under it
    if (articlesState.filters.storyId) {
        const storyId = String(articlesState.filters.storyId);
        const story = (articlesState.stories || []).find(s => String(s.id) === storyId);
        const storyName = story ? story.name : 'Selected Story';
        const storyDesc = story && story.description ? `<p class="c-story-desc">${escapeHTML(story.description)}</p>` : '';

        const headerHtml = `
            <div class="c-story-header">
                <h2 class="c-story-title"><i class="fas fa-book-open"></i> ${escapeHTML(storyName)}</h2>
                ${storyDesc}
                <div class="c-story-meta">${articlesState.articles.length} article(s)</div>
            </div>
        `;
        const itemsHtml = articlesState.articles.map(article => createArticleElement(article)).join('');
        articleList.innerHTML = headerHtml + itemsHtml;
    } else {
        // Default flat list (keeps pagination behavior intact)
        articleList.innerHTML = articlesState.articles.map(article => createArticleElement(article)).join('');
    }
    
    // Attach event listeners to the newly created buttons
    attachArticleButtonListeners(articleList);
    
    // Apply theme to newly created elements
    if (window.themeManager) {
        window.themeManager.applyTheme();
    }
};

const createArticleElement = (article) => {
    const createdAt = new Date(article.created_at).toLocaleDateString();
    const updatedAt = new Date(article.updated_at).toLocaleDateString();
    
    // Parse the JSON content if it's a string
    let contentData = {};
    try {
        contentData = typeof article.content === 'string' 
            ? JSON.parse(article.content) 
            : (article.content || {});
    } catch (e) {
        console.warn('Failed to parse article content JSON:', e);
        contentData = {};
    }
    
    // Get highlights from parsed content
    const highlights = Array.isArray(contentData.highlights) 
        ? contentData.highlights.slice(0, 3).map(h => {
            const title = typeof h === 'object' ? h.title : h;
            return `<span class="c-article-highlight">${escapeHTML(title)}</span>`;
          }).join('')
        : '';

    // Get intro from parsed content, fall back to story field, then excerpt
    const intro = contentData.intro || 
                 article.story || 
                 article.excerpt || 
                 'No introduction available';
    
    // Determine article status
    const status = article.is_active ? 'published' : 'draft';
    
    return `
        <div class="c-article-item" data-id="${article.id}">
            <div class="c-article-header">
                <h3 class="c-article-title">${escapeHTML(article.title)}</h3>
                <span class="c-article-status c-article-status--${status}">
                    <i class="fas fa-${getStatusIcon(status)}"></i>
                    ${status}
                </span>
            </div>
            
            <div class="c-article-meta">
                ${article.story_name ? `
                <span class="c-article-meta-item">
                    <i class="fas fa-book"></i>
                    ${escapeHTML(article.story_name)}
                </span>
                ` : ''}
                ${article.story_order !== undefined && article.story_order !== null ? `
                <span class="c-article-meta-item">
                    <i class="fas fa-hashtag"></i>
                    Order: ${article.story_order}
                </span>
                ` : ''}
                <span class="c-article-meta-item">
                    <i class="fas fa-user"></i>
                    ${escapeHTML(article.author)}
                </span>
                <span class="c-article-meta-item">
                    <i class="fas fa-calendar-alt"></i>
                    Written: ${article.date_written || 'Not specified'}
                </span>
                <span class="c-article-meta-item">
                    <i class="fas fa-calendar"></i>
                    Created: ${createdAt}
                </span>
                <span class="c-article-meta-item">
                    <i class="fas fa-edit"></i>
                    Updated: ${updatedAt}
                </span>
                ${article.category ? `
                <span class="c-article-meta-item">
                    <i class="fas fa-tag"></i>
                    ${escapeHTML(article.category)}
                </span>
                ` : ''}
                ${article.view_count !== undefined ? `
                <span class="c-article-meta-item">
                    <i class="fas fa-eye"></i>
                    ${article.view_count} views
                </span>
                ` : ''}
            </div>
            
            <div class="c-article-intro">${escapeHTML(intro)}</div>
            
            ${highlights ? `<div class="c-article-highlights">${highlights}</div>` : ''}
            
            <div class="c-article-actions">
                <button class="c-btn c-btn--edit js-edit-article" data-id="${article.id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="c-btn c-btn--primary js-view-article" data-id="${article.id}">
                    <i class="fas fa-eye"></i> View
                </button>
                ${status !== 'published' ? `
                    <button class="c-btn c-btn--primary js-publish-article" data-id="${article.id}">
                        <i class="fas fa-redo"></i> Republish
                    </button>
                ` : `
                    <button class="c-btn c-btn--warning js-unpublish-article" data-id="${article.id}">
                        <i class="fas fa-archive"></i> Archive
                    </button>
                `}
                <button class="c-btn c-btn--delete js-delete-article" data-id="${article.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
};

const renderArticleStats = () => {
    const stats = articlesState.stats;
    
    const totalEl = document.querySelector('.js-total-articles');
    const publishedEl = document.querySelector('.js-published-articles');
    const draftEl = document.querySelector('.js-draft-articles');
    
    if (totalEl) totalEl.textContent = stats.total_articles || 0;
    if (publishedEl) publishedEl.textContent = stats.active_articles || 0;
    if (draftEl) {
        // Calculate drafts as total minus active
        const drafts = (stats.total_articles || 0) - (stats.active_articles || 0);
        draftEl.textContent = drafts;
    }
};

const updatePagination = () => {
    const prevBtn = document.querySelector('.c-pagination__btn--prev');
    const nextBtn = document.querySelector('.c-pagination__btn--next');
    const pageInfo = document.querySelector('.c-pagination__info');
    
    if (prevBtn) {
        prevBtn.disabled = articlesState.currentPage === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = articlesState.currentPage >= articlesState.totalPages;
    }
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${articlesState.currentPage} of ${articlesState.totalPages}`;
    }
};

const showArticleModal = async (article = null) => {
    const modal = domAdmin.editModal;
    const modalTitle = modal.querySelector('.c-modal-title');
    const form = modal.querySelector('.c-edit-form');
    
    modalTitle.textContent = article ? 'Edit Article' : 'Create New Article';
    
    // Ensure stories are loaded for the dropdown
    if (!Array.isArray(articlesState.stories) || articlesState.stories.length === 0) {
        try {
            const stories = await fetchStories();
            if (Array.isArray(stories)) {
                articlesState.stories = stories;
            }
        } catch (e) {
            console.warn('Could not load stories for form:', e);
            articlesState.stories = [];
        }
    }
    
    // Parse article content if editing
    let contentData = {};
    let currentStatus = 'draft';
    
    if (article) {
        // Parse the JSON content
        try {
            contentData = typeof article.content === 'string' 
                ? JSON.parse(article.content) 
                : (article.content || {});
        } catch (e) {
            console.warn('Failed to parse article content JSON:', e);
            contentData = {};
        }
        
        // Determine current status
        currentStatus = article.is_active ? 'published' : 'draft';
    }
    
    form.innerHTML = `
        <div class="c-article-form">
            <!-- Basic Info Section -->
            <div class="c-article-form-section">
                <h3 class="c-article-form-section-title">
                    <i class="fas fa-info-circle"></i>
                    Basic Information
                </h3>
                <div class="c-form-grid c-form-grid--cols-2">
                    <div class="c-form-group">
                        <label for="article-title">Title *</label>
                        <input type="text" id="article-title" class="c-form-input" 
                               value="${article ? escapeHTML(article.title) : ''}" 
                               placeholder="Enter article title" required>
                    </div>
                    <div class="c-form-group">
                        <label for="article-author">Author</label>
                        <input type="text" id="article-author" class="c-form-input" 
                               value="${article ? escapeHTML(article.author) : ''}" 
                               placeholder="Article author">
                    </div>
                    <div class="c-form-group">
                        <label for="article-date">Date Written</label>
                        <input type="date" id="article-date" class="c-form-input" 
                               value="${article ? article.date_written : ''}" 
                               placeholder="YYYY-MM-DD">
                    </div>
                    <div class="c-form-group">
                        <label for="article-category">Category</label>
                        <input type="text" id="article-category" class="c-form-input" 
                               value="${article ? escapeHTML(article.category || '') : ''}" 
                               placeholder="Article category">
                    </div>
                    <div class="c-form-group">
                        <label for="article-tags">Tags</label>
                        <input type="text" id="article-tags" class="c-form-input" 
                               value="${article ? escapeHTML(article.tags || '') : ''}" 
                               placeholder="Comma-separated tags">
                    </div>
                    <div class="c-form-group">
                        <label for="article-story">Story</label>
                        <select id="article-story" class="c-form-input">
                            <option value="">No story (standalone article)</option>
                            ${articlesState.stories.map(story => 
                                `<option value="${story.id}" ${article && article.story_id == story.id ? 'selected' : ''}>
                                    ${escapeHTML(story.name)}
                                </option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="c-form-group">
                        <label for="article-story-order">Story Order</label>
                        <input type="number" id="article-story-order" class="c-form-input" 
                               value="${article ? (article.story_order || 0) : 0}" 
                               placeholder="0" min="0">
                    </div>
                    <div class="c-form-group">
                        <label for="article-excerpt">Excerpt</label>
                        <input type="text" id="article-excerpt" class="c-form-input" 
                               value="${article ? escapeHTML(article.excerpt || '') : ''}" 
                               placeholder="Brief article excerpt">
                    </div>
                </div>
                <div class="c-form-group">
                    <label for="article-intro">Introduction</label>
                    <textarea id="article-intro" class="c-form-textarea" 
                              placeholder="Brief introduction to the article">${contentData.intro || article?.story || ''}</textarea>
                </div>
            </div>

            <!-- Status Section -->
            <div class="c-article-form-section">
                <h3 class="c-article-form-section-title">
                    <i class="fas fa-toggle-on"></i>
                    Publication Status
                </h3>
                <div class="c-status-toggle">
                    <button type="button" class="c-status-toggle-option ${currentStatus === 'draft' ? 'active' : ''}" data-status="draft">
                        <i class="fas fa-edit"></i> Draft
                    </button>
                    <button type="button" class="c-status-toggle-option ${currentStatus === 'published' ? 'active' : ''}" data-status="published">
                        <i class="fas fa-globe"></i> Published
                    </button>
                    <button type="button" class="c-status-toggle-option ${currentStatus === 'archived' ? 'active' : ''}" data-status="archived">
                        <i class="fas fa-archive"></i> Archived
                    </button>
                </div>
            </div>

            <!-- Highlights Section -->
            <div class="c-article-form-section">
                <h3 class="c-article-form-section-title">
                    <i class="fas fa-star"></i>
                    Article Highlights
                </h3>
                <div id="highlights-container" class="c-dynamic-content">
                    ${renderHighlights(contentData.highlights || [])}
                </div>
                <button type="button" class="c-add-dynamic" onclick="addHighlight()">
                    <i class="fas fa-plus"></i> Add Highlight
                </button>
            </div>

            <!-- Cards Section -->
            <div class="c-article-form-section">
                <h3 class="c-article-form-section-title">
                    <i class="fas fa-th-large"></i>
                    Content Cards
                </h3>
                <div id="cards-container" class="c-dynamic-content">
                    ${renderCards(contentData.cards || [])}
                </div>
                <button type="button" class="c-add-dynamic" onclick="addCard()">
                    <i class="fas fa-plus"></i> Add Card
                </button>
            </div>

            <!-- Sections Section -->
            <div class="c-article-form-section">
                <h3 class="c-article-form-section-title">
                    <i class="fas fa-list"></i>
                    Article Sections
                </h3>
                <div id="sections-container" class="c-dynamic-content">
                    ${renderSections(contentData.sections || [])}
                </div>
                <button type="button" class="c-add-dynamic" onclick="addSection()">
                    <i class="fas fa-plus"></i> Add Section
                </button>
            </div>
        </div>

        <div class="c-form-actions">
            <button type="button" class="c-btn c-btn--cancel">Cancel</button>
            <button type="submit" class="c-btn c-btn--primary js-save-article" data-id="${article?.id || ''}">
                ${article ? 'Update Article' : 'Create Article'}
            </button>
        </div>
    `;

    // Set up event listeners
    setupArticleFormListeners();
    
    // Apply theme
    if (window.themeManager) {
        window.themeManager.applyTheme();
    }
    
    modal.style.display = 'block';
};

// #endregion

// #region ***  Form Helper Functions                    ***********

const renderHighlights = (highlights) => {
    if (!Array.isArray(highlights) || highlights.length === 0) {
        return '<p>No highlights added yet. Click "Add Highlight" to create one.</p>';
    }
    
    return highlights.map((highlight, index) => {
        // Handle both object format {title, content} and string format
        const title = typeof highlight === 'object' ? highlight.title : highlight;
        const content = typeof highlight === 'object' ? highlight.content : '';
        
        return `
            <div class="c-dynamic-item" data-index="${index}">
                <button class="c-dynamic-item-remove" onclick="removeHighlight(${index})">×</button>
                <div class="c-form-group">
                    <label>Highlight ${index + 1} Title</label>
                    <input type="text" class="c-form-input highlight-title" 
                           value="${escapeHTML(title || '')}" placeholder="Enter highlight title">
                </div>
                ${typeof highlight === 'object' ? `
                <div class="c-form-group">
                    <label>Highlight ${index + 1} Content</label>
                    <textarea class="c-form-textarea highlight-content" 
                              placeholder="Enter highlight content">${escapeHTML(content || '')}</textarea>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
};

const renderCards = (cards) => {
    if (!Array.isArray(cards) || cards.length === 0) {
        return '<p>No cards added yet. Click "Add Card" to create one.</p>';
    }
    
    return cards.map((card, index) => `
        <div class="c-dynamic-item" data-index="${index}">
            <button class="c-dynamic-item-remove" onclick="removeCard(${index})">×</button>
            <div class="c-form-grid c-form-grid--cols-2">
                <div class="c-form-group">
                    <label>Card ${index + 1} Title</label>
                    <input type="text" class="c-form-input card-title-input" 
                           value="${escapeHTML(card.title || '')}" placeholder="Card title">
                </div>
                <div class="c-form-group">
                    <label>Card ${index + 1} Image URL</label>
                    <input type="text" class="c-form-input card-image-input" 
                           value="${escapeHTML(card.image || '')}" placeholder="Image URL">
                </div>
            </div>
            <div class="c-form-group">
                <label>Card ${index + 1} Content</label>
                <textarea class="c-form-textarea card-content-input" 
                          placeholder="Card content">${escapeHTML(card.content || '')}</textarea>
            </div>
        </div>
    `).join('');
};

const renderSections = (sections) => {
    if (!Array.isArray(sections) || sections.length === 0) {
        return '<p>No sections added yet. Click "Add Section" to create one.</p>';
    }
    
    return sections.map((section, index) => `
        <div class="c-dynamic-item" data-index="${index}">
            <button class="c-dynamic-item-remove" onclick="removeSection(${index})">×</button>
            <div class="c-form-group">
                <label>Section ${index + 1} Title</label>
                <input type="text" class="c-form-input section-title-input" 
                       value="${escapeHTML(section.title || '')}" placeholder="Section title">
            </div>
            <div class="c-form-group">
                <label>Section ${index + 1} Content</label>
                <textarea class="c-form-textarea c-form-textarea--large section-content-input" 
                          placeholder="Section content">${escapeHTML(section.content || '')}</textarea>
            </div>
        </div>
    `).join('');
};

// Dynamic content management functions
window.addHighlight = () => {
    const container = document.getElementById('highlights-container');
    const count = container.querySelectorAll('.c-dynamic-item').length;
    
    const newHighlight = document.createElement('div');
    newHighlight.className = 'c-dynamic-item';
    newHighlight.dataset.index = count;
    newHighlight.innerHTML = `
        <button class="c-dynamic-item-remove" onclick="removeHighlight(${count})">×</button>
        <div class="c-form-group">
            <label>Highlight ${count + 1}</label>
            <input type="text" class="c-form-input highlight-input" 
                   placeholder="Enter highlight text">
        </div>
    `;
    
    // Insert before the "no highlights" message or add to the end
    const noItemsMsg = container.querySelector('p');
    if (noItemsMsg) {
        container.replaceChild(newHighlight, noItemsMsg);
    } else {
        container.appendChild(newHighlight);
    }
};

window.removeHighlight = (index) => {
    const container = document.getElementById('highlights-container');
    const item = container.querySelector(`[data-index="${index}"]`);
    if (item) item.remove();
    
    // If no highlights left, show message
    if (container.querySelectorAll('.c-dynamic-item').length === 0) {
        container.innerHTML = '<p>No highlights added yet. Click "Add Highlight" to create one.</p>';
    }
};

window.addCard = () => {
    const container = document.getElementById('cards-container');
    const count = container.querySelectorAll('.c-dynamic-item').length;
    
    const newCard = document.createElement('div');
    newCard.className = 'c-dynamic-item';
    newCard.dataset.index = count;
    newCard.innerHTML = `
        <button class="c-dynamic-item-remove" onclick="removeCard(${count})">×</button>
        <div class="c-form-grid c-form-grid--cols-2">
            <div class="c-form-group">
                <label>Card ${count + 1} Title</label>
                <input type="text" class="c-form-input card-title-input" placeholder="Card title">
            </div>
            <div class="c-form-group">
                <label>Card ${count + 1} Image URL</label>
                <input type="text" class="c-form-input card-image-input" placeholder="Image URL">
            </div>
        </div>
        <div class="c-form-group">
            <label>Card ${count + 1} Content</label>
            <textarea class="c-form-textarea card-content-input" placeholder="Card content"></textarea>
        </div>
    `;
    
    const noItemsMsg = container.querySelector('p');
    if (noItemsMsg) {
        container.replaceChild(newCard, noItemsMsg);
    } else {
        container.appendChild(newCard);
    }
};

window.removeCard = (index) => {
    const container = document.getElementById('cards-container');
    const item = container.querySelector(`[data-index="${index}"]`);
    if (item) item.remove();
    
    if (container.querySelectorAll('.c-dynamic-item').length === 0) {
        container.innerHTML = '<p>No cards added yet. Click "Add Card" to create one.</p>';
    }
};

window.addSection = () => {
    const container = document.getElementById('sections-container');
    const count = container.querySelectorAll('.c-dynamic-item').length;
    
    const newSection = document.createElement('div');
    newSection.className = 'c-dynamic-item';
    newSection.dataset.index = count;
    newSection.innerHTML = `
        <button class="c-dynamic-item-remove" onclick="removeSection(${count})">×</button>
        <div class="c-form-group">
            <label>Section ${count + 1} Title</label>
            <input type="text" class="c-form-input section-title-input" placeholder="Section title">
        </div>
        <div class="c-form-group">
            <label>Section ${count + 1} Content</label>
            <textarea class="c-form-textarea c-form-textarea--large section-content-input" placeholder="Section content"></textarea>
        </div>
    `;
    
    const noItemsMsg = container.querySelector('p');
    if (noItemsMsg) {
        container.replaceChild(newSection, noItemsMsg);
    } else {
        container.appendChild(newSection);
    }
};

window.removeSection = (index) => {
    const container = document.getElementById('sections-container');
    const item = container.querySelector(`[data-index="${index}"]`);
    if (item) item.remove();
    
    if (container.querySelectorAll('.c-dynamic-item').length === 0) {
        container.innerHTML = '<p>No sections added yet. Click "Add Section" to create one.</p>';
    }
};

const setupArticleFormListeners = () => {
    // Cancel button listener
    const cancelBtn = document.querySelector('.c-btn--cancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideEditModal);
    }
    
    // Status toggle listeners
    document.querySelectorAll('.c-status-toggle-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.c-status-toggle-option').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
    
    // Form submit listener
    const saveBtn = document.querySelector('.js-save-article');
    if (saveBtn) {
        saveBtn.addEventListener('click', handleArticleSave);
    }
};

// Helper functions for content analysis
const calculateWordCount = (intro, highlights, cards, sections) => {
    let totalWords = 0;
    
    // Count words in intro
    if (intro) {
        totalWords += intro.trim().split(/\s+/).length;
    }
    
    // Count words in highlights
    highlights.forEach(h => {
        if (typeof h === 'string') {
            totalWords += h.trim().split(/\s+/).length;
        } else if (h.title) {
            totalWords += h.title.trim().split(/\s+/).length;
            if (h.content) {
                totalWords += h.content.trim().split(/\s+/).length;
            }
        }
    });
    
    // Count words in cards
    cards.forEach(card => {
        if (card.title) {
            totalWords += card.title.trim().split(/\s+/).length;
        }
        if (card.content) {
            totalWords += card.content.trim().split(/\s+/).length;
        }
        if (Array.isArray(card.list)) {
            card.list.forEach(item => {
                totalWords += String(item).trim().split(/\s+/).length;
            });
        }
    });
    
    // Count words in sections
    sections.forEach(section => {
        if (section.title) {
            totalWords += section.title.trim().split(/\s+/).length;
        }
        if (section.content) {
            totalWords += section.content.trim().split(/\s+/).length;
        }
        if (Array.isArray(section.list)) {
            section.list.forEach(item => {
                totalWords += String(item).trim().split(/\s+/).length;
            });
        }
    });
    
    return totalWords;
};

const calculateReadingTime = (intro, highlights, cards, sections) => {
    const wordsPerMinute = 200; // Average reading speed
    const wordCount = calculateWordCount(intro, highlights, cards, sections);
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
};

const collectArticleFormData = () => {
    const title = document.getElementById('article-title').value.trim();
    const author = document.getElementById('article-author').value.trim();
    const intro = document.getElementById('article-intro').value.trim();
    const status = document.querySelector('.c-status-toggle-option.active').dataset.status;
    const dateWritten = document.getElementById('article-date').value;
    const category = document.getElementById('article-category').value.trim();
    const tags = document.getElementById('article-tags').value.trim();
    const excerpt = document.getElementById('article-excerpt').value.trim();
    const storyId = document.getElementById('article-story').value;
    const storyOrder = parseInt(document.getElementById('article-story-order').value) || 0;
    
    // Collect highlights
    const highlights = [];
    document.querySelectorAll('#highlights-container .c-dynamic-item').forEach(item => {
        const titleInput = item.querySelector('.highlight-title');
        const contentInput = item.querySelector('.highlight-content');
        
        if (titleInput && titleInput.value.trim()) {
            if (contentInput && contentInput.value.trim()) {
                // Complex highlight with title and content
                highlights.push({
                    title: titleInput.value.trim(),
                    content: contentInput.value.trim()
                });
            } else {
                // Simple highlight with just title
                highlights.push(titleInput.value.trim());
            }
        }
    });
    
    // Collect cards
    const cards = [];
    document.querySelectorAll('#cards-container .c-dynamic-item').forEach(item => {
        const titleInput = item.querySelector('.card-title-input');
        const imageInput = item.querySelector('.card-image-input');
        const contentInput = item.querySelector('.card-content-input');
        
        if (titleInput && (titleInput.value.trim() || contentInput?.value.trim())) {
            cards.push({
                title: titleInput.value.trim(),
                image: imageInput?.value.trim() || '',
                content: contentInput?.value.trim() || ''
            });
        }
    });
    
    // Collect sections
    const sections = [];
    document.querySelectorAll('#sections-container .c-dynamic-item').forEach(item => {
        const titleInput = item.querySelector('.section-title-input');
        const contentInput = item.querySelector('.section-content-input');
        
        if (titleInput && (titleInput.value.trim() || contentInput?.value.trim())) {
            sections.push({
                title: titleInput.value.trim(),
                content: contentInput?.value.trim() || ''
            });
        }
    });
    
    return {
        title,
        author,
        date_written: dateWritten,
        story: intro, // Use intro as story field
        story_id: storyId ? parseInt(storyId) : null,
        story_order: storyOrder,
        category,
        tags,
        excerpt,
        is_active: status === 'published',
        is_featured: false, // Default to false, can be enhanced later
        content: JSON.stringify({
            intro,
            highlights,
            cards,
            sections
        }),
        word_count: calculateWordCount(intro, highlights, cards, sections),
        reading_time_minutes: calculateReadingTime(intro, highlights, cards, sections)
    };
};

const handleArticleSave = async (event) => {
    event.preventDefault();
    
    const saveBtn = event.target;
    const articleId = saveBtn.dataset.id;
    
    try {
        const articleData = collectArticleFormData();
        
        if (!articleData.title) {
            showNotification('Please enter a title for the article', 'error');
            return;
        }
        
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        if (articleId) {
            await updateArticle(articleId, articleData);
        } else {
            await createArticle(articleData);
        }
        
        hideEditModal();
        await loadArticles(articlesState.currentPage);
        
    } catch (error) {
        console.error('Error saving article:', error);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = articleId ? 'Update Article' : 'Create Article';
    }
};

const attachArticleButtonListeners = (container) => {
    // Edit buttons
    container.querySelectorAll('.js-edit-article').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const articleId = parseInt(btn.dataset.id);
            let article = (articlesState.articles || []).find(a => a.id === articleId);
            if (!article) {
                try { article = await fetchArticleById(articleId); } catch {}
            }
            if (article) {
                await showArticleModal(article);
            }
        });
    });
    
    // View buttons
    container.querySelectorAll('.js-view-article').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const articleId = parseInt(btn.dataset.id);
            let article = (articlesState.articles || []).find(a => a.id === articleId);
            if (!article) {
                try { article = await fetchArticleById(articleId); } catch {}
            }
            if (article) {
                showArticleDetails(article);
            }
        });
    });
    
    // Publish buttons
    container.querySelectorAll('.js-publish-article').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const articleId = parseInt(btn.dataset.id);
            try {
                await updateArticleStatus(articleId, 'published');
                await loadArticles(articlesState.currentPage);
            } catch (error) {
                console.error('Error publishing article:', error);
            }
        });
    });
    
    // Unpublish buttons
    container.querySelectorAll('.js-unpublish-article').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const articleId = parseInt(btn.dataset.id);
            try {
                await updateArticleStatus(articleId, 'draft');
                await loadArticles(articlesState.currentPage);
            } catch (error) {
                console.error('Error unpublishing article:', error);
            }
        });
    });
    
    // Delete buttons
    container.querySelectorAll('.js-delete-article').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const articleId = parseInt(btn.dataset.id);
            const article = articlesState.articles.find(a => a.id === articleId);
            
            if (article) {
                showConfirmDialog(
                    `Are you sure you want to delete "${article.title}"? This action cannot be undone.`,
                    async () => {
                        try {
                            await deleteArticle(articleId);
                            await loadArticles(articlesState.currentPage);
                        } catch (error) {
                            console.error('Error deleting article:', error);
                        }
                    }
                );
            }
        });
    });
};

let _articlesListenersAttached = false;

const listenToArticles = () => {
    // Guard against duplicate initialization
    if (_articlesListenersAttached) return;
    _articlesListenersAttached = true;

    // Add article button
    document.addEventListener('click', async (e) => {
        if (e.target.closest('.js-add-article')) {
            await showArticleModal();
        }
        
        // Edit article
        if (e.target.closest('.js-edit-article')) {
            const articleId = parseInt(e.target.closest('.js-edit-article').dataset.id);
            let article = (articlesState.articles || []).find(a => a.id === articleId);
            if (!article) {
                try { article = await fetchArticleById(articleId); } catch {}
            }
            if (article) {
                await showArticleModal(article);
            }
        }
        
        // Delete article
        if (e.target.closest('.js-delete-article')) {
            const articleId = parseInt(e.target.closest('.js-delete-article').dataset.id);
            const article = articlesState.articles.find(a => a.id === articleId);
            
            if (article) {
                showConfirmDialog(
                    `Are you sure you want to delete "${article.title}"? This action cannot be undone.`,
                    async () => {
                        try {
                            await deleteArticle(articleId);
                            await loadArticles(articlesState.currentPage);
                        } catch (error) {
                            console.error('Error deleting article:', error);
                        }
                    }
                );
            }
        }
        
        // Publish/unpublish article
        if (e.target.closest('.js-publish-article')) {
            const articleId = parseInt(e.target.closest('.js-publish-article').dataset.id);
            try {
                await updateArticleStatus(articleId, 'published');
                await loadArticles(articlesState.currentPage);
            } catch (error) {
                console.error('Error publishing article:', error);
            }
        }
        
        if (e.target.closest('.js-unpublish-article')) {
            const articleId = parseInt(e.target.closest('.js-unpublish-article').dataset.id);
            try {
                await updateArticleStatus(articleId, 'draft');
                await loadArticles(articlesState.currentPage);
            } catch (error) {
                console.error('Error unpublishing article:', error);
            }
        }

        // View article (read-only modal)
        if (e.target.closest('.js-view-article')) {
            const articleId = parseInt(e.target.closest('.js-view-article').dataset.id);
            let article = (articlesState.articles || []).find(a => a.id === articleId);
            if (!article) {
                try { article = await fetchArticleById(articleId); } catch {}
            }
            if (article) {
                showArticleDetails(article);
            }
        }
    });
    
    // Search functionality
    const searchInput = document.querySelector('.js-article-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            articlesState.filters.search = searchInput.value.trim();
            loadArticles(1);
        }, 300));
    }
    
    // Filter functionality
    const statusFilter = document.querySelector('.js-status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            articlesState.filters.status = statusFilter.value;
            loadArticles(1);
        });
    }
    
    const sortFilter = document.querySelector('.js-sort-filter');
    if (sortFilter) {
        sortFilter.addEventListener('change', () => {
            articlesState.filters.sortBy = sortFilter.value;
            loadArticles(1);
        });
    }
};

// Helper to get single article when not in state (grouped view)
const fetchArticleById = async (articleId) => {
    try {
        const res = await fetch(`${lanIP}/api/v1/articles/${articleId}/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn('Failed to fetch article by id', articleId, e);
        return null;
    }
};

// Initialize articles listeners as early as possible
try { listenToArticles(); } catch (e) { console.warn('Articles listeners failed to init immediately:', e); }
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
        try { listenToArticles(); } catch (e) { console.warn('Articles listeners failed to init on DOMContentLoaded:', e); }
    });
}

// #endregion

// #region ***  Utility Functions                        ***********

const getStatusIcon = (status) => {
    switch (status) {
        case 'published': return 'globe';
        case 'draft': return 'edit';
        case 'archived': return 'archive';
        default: return 'file';
    }
};

// #endregion