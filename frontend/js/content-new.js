/**
 * Content Enhancement Script v2.0
 * Dynamically loads articles from database API
 * 
 * Usage: Simply include this script on any page with:
 * <script src="path/to/content.js"></script>
 * 
 * The script will automatically inject content from the database
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        apiBaseUrl: `https://${window.location.hostname}/api/v1`,
        cssPath: '../css/content-new.css',
        defaultStoryId: null, // null = show all stories
        autoLoadCSS: true
    };

    // State management
    let contentState = {
        stories: [],
        currentStory: null,
        currentArticles: [],
        currentArticleIndex: 0,
        isLoading: false
    };

    // DOM references
    let contentContainer = null;

    // Utility functions
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, (tag) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    }

    function showLoading() {
        if (contentContainer) {
            contentContainer.innerHTML = '<div class="content-loading">Loading articles...</div>';
        }
    }

    function showError(message) {
        if (contentContainer) {
            contentContainer.innerHTML = `<div class="content-error">Error: ${escapeHTML(message)}</div>`;
        }
    }

    // Cache utilities
    const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

    function getCache(key) {
        try {
            const cached = localStorage.getItem(key);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && typeof parsed.timestamp === 'number' && parsed.data !== undefined) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Cache read error:', e);
        }
        return null;
    }

    function setCache(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        } catch (e) {
            console.warn('Cache write error:', e);
        }
    }

    function isValid(cached, duration) {
        return Date.now() - cached.timestamp < duration;
    }

    // API functions
    async function fetchFreshStories() {
        const response = await fetch(`${CONFIG.apiBaseUrl}/stories/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    }

    async function fetchStories() {
        const CACHE_KEY = 'content_stories';
        const cached = getCache(CACHE_KEY);
        if (cached) {
            console.log('[Content Cache Hit] Using cached stories');
            if (!isValid(cached, CACHE_DURATION)) {
                fetchFreshStories().then(freshData => {
                    setCache(CACHE_KEY, freshData);
                    console.log('[Content Cache Update] Stories updated in background');
                    // Update global stories
                    contentState.stories = freshData;
                }).catch(err => console.error('Background stories fetch failed:', err));
            }
            return cached.data;
        } else {
            console.log('[Content Cache Miss] Fetching fresh stories');
            const data = await fetchFreshStories();
            setCache(CACHE_KEY, data);
            return data;
        }
    }

    async function fetchFreshArticlesByStory(storyId) {
        const response = await fetch(`${CONFIG.apiBaseUrl}/articles/by-story/${encodeURIComponent(storyId)}/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    async function fetchArticlesByStory(storyId) {
        const CACHE_KEY = `content_articles_${storyId}`;
        const cached = getCache(CACHE_KEY);
        if (cached) {
            console.log(`[Content Cache Hit] Using cached articles for story ${storyId}`);
            if (!isValid(cached, CACHE_DURATION)) {
                fetchFreshArticlesByStory(storyId).then(freshData => {
                    setCache(CACHE_KEY, freshData);
                    console.log(`[Content Cache Update] Articles updated in background for story ${storyId}`);
                    // Update if current story
                    if (contentState.currentStory && contentState.currentStory.id === storyId) {
                        contentState.currentArticles = freshData;
                    }
                }).catch(err => console.error('Background articles fetch failed:', err));
            }
            return cached.data;
        } else {
            console.log(`[Content Cache Miss] Fetching fresh articles for story ${storyId}`);
            const data = await fetchFreshArticlesByStory(storyId);
            setCache(CACHE_KEY, data);
            return data;
        }
    }

    async function fetchAllArticles() {
        try {
            // Get all stories first, then fetch articles for each story
            const stories = await fetchStories();
            let allArticles = [];
            
            for (const story of stories) {
                const storyArticles = await fetchArticlesByStory(story.id);
                allArticles = allArticles.concat(storyArticles);
            }
            
            return allArticles;
        } catch (error) {
            console.error('Failed to fetch all articles:', error);
            return [];
        }
    }

    // Content rendering functions
    function buildArticleHTML(article, articleIndex, totalArticles) {
        let contentData = {};
        try {
            contentData = typeof article.content === 'string' 
                ? JSON.parse(article.content) 
                : (article.content || {});
        } catch (e) {
            console.warn('Failed to parse article content JSON:', e);
            contentData = {};
        }

        const intro = contentData.intro || article.excerpt || article.story || '';
        const highlights = Array.isArray(contentData.highlights) ? contentData.highlights : [];
        const cards = Array.isArray(contentData.cards) ? contentData.cards : [];
        const sections = Array.isArray(contentData.sections) ? contentData.sections : [];

        return `
            <div class="content-article">
                ${buildNavigationHTML(articleIndex, totalArticles)}
                ${buildArticleHeaderHTML(article)}
                ${intro ? `<div class="content-article-intro">${escapeHTML(intro)}</div>` : ''}
                ${buildHighlightsHTML(highlights)}
                ${buildCardsHTML(cards)}
                ${buildSectionsHTML(sections)}
                ${buildFooterNavigationHTML(articleIndex, totalArticles)}
            </div>
        `;
    }

    function buildNavigationHTML(articleIndex, totalArticles) {
        const hasMultipleArticles = totalArticles > 1;
        const hasPrevious = articleIndex > 0;
        const hasNext = articleIndex < totalArticles - 1;
        
        let storyOptions = '<option value="">All Stories</option>';
        contentState.stories.forEach(story => {
            const selected = contentState.currentStory && contentState.currentStory.id === story.id ? 'selected' : '';
            storyOptions += `<option value="${story.id}" ${selected}>${escapeHTML(story.name)}</option>`;
        });

        // Build chapter selector options in the format: #<id or number> <title>
        let chapterOptions = '';
        contentState.currentArticles.forEach((a, i) => {
            const num = (a && a.id != null) ? a.id : (Number.isFinite(a?.story_order) ? (a.story_order + 1) : (i + 1));
            const selected = i === articleIndex ? 'selected' : '';
            chapterOptions += `<option value="${i}" ${selected}>#${num} ${escapeHTML(a?.title || '')}</option>`;
        });

        return `
            <div class="content-nav">
                <div class="content-nav-controls content-nav-row content-nav-row--selectors">
                    <select class="story-selector" id="story-selector">
                        ${storyOptions}
                    </select>
                    <select class="story-selector" id="article-selector" ${totalArticles ? '' : 'disabled'}>
                        ${chapterOptions}
                    </select>
                </div>
                ${hasMultipleArticles ? `
                <div class="content-nav-controls content-nav-row content-nav-row--nav">
                    <button class="content-nav-btn" id="prev-article" ${!hasPrevious ? 'disabled' : ''}>
                        ← Previous
                    </button>
                    <span class="content-article-counter">${articleIndex + 1} / ${totalArticles}</span>
                    <button class="content-nav-btn" id="next-article" ${!hasNext ? 'disabled' : ''}>
                        Next →
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    }

    function buildArticleHeaderHTML(article) {
        return `
            <div class="content-article-header">
                <h1 class="content-article-title">${escapeHTML(article.title)}</h1>
                <div class="content-article-meta">
                    <span class="content-meta-item">
                        <i class="fas fa-user"></i>
                        ${escapeHTML(article.author)}
                    </span>
                    <span class="content-meta-item">
                        <i class="fas fa-calendar"></i>
                        ${article.date_written || 'No date'}
                    </span>
                    ${article.category ? `
                        <span class="content-meta-item">
                            <i class="fas fa-tag"></i>
                            ${escapeHTML(article.category)}
                        </span>
                    ` : ''}
                    ${contentState.currentStory ? `
                        <span class="content-story-badge">
                            ${escapeHTML(contentState.currentStory.name)}
                            ${article.story_order !== undefined ? ` #${article.story_order + 1}` : ''}
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    }

    function buildHighlightsHTML(highlights) {
        if (!highlights.length) return '';

        const highlightItems = highlights.map(highlight => {
            const title = typeof highlight === 'object' ? highlight.title : highlight;
            const content = typeof highlight === 'object' ? highlight.content : '';
            
            return `
                <div class="content-highlight-item">
                    <div class="content-highlight-title">${escapeHTML(title)}</div>
                    ${content ? `<div class="content-highlight-content">${escapeHTML(content)}</div>` : ''}
                </div>
            `;
        }).join('');

        return `
            <div class="content-highlights">
                <h2 class="content-section-title">
                    <i class="fas fa-star"></i>
                    Key Highlights
                </h2>
                <div class="content-highlights-grid">
                    ${highlightItems}
                </div>
            </div>
        `;
    }

    function buildCardsHTML(cards) {
        if (!cards.length) return '';

        const cardItems = cards.map(card => {
            let listHTML = '';
            if (Array.isArray(card.list) && card.list.length > 0) {
                const listItems = card.list.map(item => `<li>${escapeHTML(item)}</li>`).join('');
                listHTML = `<ul class="content-card-list">${listItems}</ul>`;
            }

            return `
                <div class="content-card">
                    <h3 class="content-card-title">${escapeHTML(card.title || '')}</h3>
                    ${card.content ? `<div class="content-card-content">${escapeHTML(card.content)}</div>` : ''}
                    ${listHTML}
                </div>
            `;
        }).join('');

        return `
            <div class="content-cards">
                <h2 class="content-section-title">
                    <i class="fas fa-th-large"></i>
                    Detailed Information
                </h2>
                <div class="content-cards-grid">
                    ${cardItems}
                </div>
            </div>
        `;
    }

    function buildSectionsHTML(sections) {
        if (!sections.length) return '';

        const sectionItems = sections.map(section => {
            let listHTML = '';
            if (Array.isArray(section.list) && section.list.length > 0) {
                const listItems = section.list.map(item => `<li>${escapeHTML(item)}</li>`).join('');
                listHTML = `<ul class="content-section-list">${listItems}</ul>`;
            }

            return `
                <div class="content-section">
                    <h3 class="content-section-heading">${escapeHTML(section.title || '')}</h3>
                    ${section.content ? `<div class="content-section-text">${escapeHTML(section.content)}</div>` : ''}
                    ${listHTML}
                </div>
            `;
        }).join('');

        return `
            <div class="content-sections">
                <h2 class="content-section-title">
                    <i class="fas fa-list"></i>
                    Additional Sections
                </h2>
                ${sectionItems}
            </div>
        `;
    }

    function buildFooterNavigationHTML(articleIndex, totalArticles) {
        const hasMultipleArticles = totalArticles > 1;
        if (!hasMultipleArticles) return '';

        const hasPrevious = articleIndex > 0;
        const hasNext = articleIndex < totalArticles - 1;

        return `
            <div class="content-footer-nav">
                <button class="content-nav-btn" id="prev-article-footer" ${!hasPrevious ? 'disabled' : ''}>
                    ← Previous Article
                </button>
                <div class="content-footer-info">
                    Article ${articleIndex + 1} of ${totalArticles}
                    ${contentState.currentStory ? `in ${escapeHTML(contentState.currentStory.name)}` : ''}
                </div>
                <button class="content-nav-btn" id="next-article-footer" ${!hasNext ? 'disabled' : ''}>
                    Next Article →
                </button>
            </div>
        `;
    }

    // Event handlers
    function setupEventListeners() {
        // Story selector
        const storySelector = document.getElementById('story-selector');
        if (storySelector) {
            storySelector.addEventListener('change', async (e) => {
                const storyId = e.target.value;
                await loadContentByStory(storyId || null);
            });
        }

        // Chapter/article selector
        const articleSelector = document.getElementById('article-selector');
        if (articleSelector) {
            articleSelector.addEventListener('change', (e) => {
                const idx = Number(e.target.value);
                if (Number.isFinite(idx)) {
                    loadArticle(idx);
                }
            });
        }

        // Navigation buttons
        ['prev-article', 'prev-article-footer'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn && !btn.disabled) {
                btn.addEventListener('click', () => navigateArticle(-1));
            }
        });

        ['next-article', 'next-article-footer'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn && !btn.disabled) {
                btn.addEventListener('click', () => navigateArticle(1));
            }
        });
    }

    function navigateArticle(direction) {
        const newIndex = contentState.currentArticleIndex + direction;
        if (newIndex >= 0 && newIndex < contentState.currentArticles.length) {
            loadArticle(newIndex);
            contentContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // Main content loading functions
    async function loadContentByStory(storyId) {
        if (contentState.isLoading) return;
        
        contentState.isLoading = true;
        showLoading();

        try {
            if (storyId) {
                // Load specific story articles
                const story = contentState.stories.find(s => s.id == storyId);
                const articles = await fetchArticlesByStory(storyId);
                
                contentState.currentStory = story;
                contentState.currentArticles = articles;
            } else {
                // Load all articles
                const articles = await fetchAllArticles();
                
                contentState.currentStory = null;
                contentState.currentArticles = articles;
            }

            contentState.currentArticleIndex = 0;
            
            if (contentState.currentArticles.length > 0) {
                loadArticle(0);
            } else {
                showError('No articles found');
            }
        } catch (error) {
            console.error('Error loading content:', error);
            showError('Failed to load articles');
        } finally {
            contentState.isLoading = false;
        }
    }

    function loadArticle(index) {
        if (index < 0 || index >= contentState.currentArticles.length) {
            console.error('Invalid article index:', index);
            return;
        }

        contentState.currentArticleIndex = index;
        const article = contentState.currentArticles[index];
        
        contentContainer.innerHTML = buildArticleHTML(
            article, 
            index, 
            contentState.currentArticles.length
        );
        
        setupEventListeners();

        // Keep chapter selector in sync after rendering
        const articleSelector = document.getElementById('article-selector');
        if (articleSelector) {
            articleSelector.value = String(index);
        }
    }

    // CSS loading
    function loadCSS() {
        if (!CONFIG.autoLoadCSS) return;
        
        const existingLink = document.querySelector('link[href*="content.css"]');
        if (existingLink) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = CONFIG.cssPath;
        document.head.appendChild(link);
    }

    // Page insertion logic
    function findOptimalInsertionPoint() {
        // Try to find main content area
        const selectors = ['main', '#main', '.main', '#content', '.content', 'article'];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return { element, insertAfter: true };
            }
        }
        
        // Fallback to body
        return { element: document.body, insertAfter: false };
    }

    function ensureBelowViewport() {
        const currentScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        const viewportHeight = window.innerHeight;
        
        const contentTop = contentContainer.getBoundingClientRect().top + currentScrollPosition;
        const minimumTop = viewportHeight;
        
        if (contentTop < minimumTop) {
            const additionalSpace = minimumTop - contentTop + (viewportHeight * 0.5);
            const spacer = document.createElement('div');
            spacer.className = 'content-enhancement-spacer';
            spacer.style.height = `${additionalSpace}px`;
            contentContainer.parentNode.insertBefore(spacer, contentContainer);
        }
    }

    // Main initialization
    async function initContentEnhancement() {
        try {
            // Load CSS
            loadCSS();
            
            // Create container
            contentContainer = document.createElement('div');
            contentContainer.className = 'content-enhancement-container';
            contentContainer.id = 'auto-content-enhancement';
            
            // Find insertion point
            const insertionPoint = findOptimalInsertionPoint();
            
            if (insertionPoint.insertAfter) {
                const parent = insertionPoint.element.parentNode;
                parent.insertBefore(contentContainer, insertionPoint.element.nextSibling);
            } else {
                const footer = document.querySelector('footer');
                if (footer) {
                    footer.parentNode.insertBefore(contentContainer, footer);
                } else {
                    insertionPoint.element.appendChild(contentContainer);
                }
            }
            
            // Load data
            showLoading();
            
            // Fetch stories
            contentState.stories = await fetchStories();
            
            // Load initial content
            await loadContentByStory(CONFIG.defaultStoryId);
            
            // Ensure proper positioning
            setTimeout(ensureBelowViewport, 100);
            
            console.log('Content Enhancement: Successfully initialized with database content');
            
        } catch (error) {
            console.error('Content Enhancement initialization failed:', error);
            showError('Failed to initialize content system');
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initContentEnhancement);
    } else {
        initContentEnhancement();
    }

    // Expose API for external access
    window.ContentEnhancement = {
        loadStory: (storyId) => loadContentByStory(storyId),
        loadArticle: (index) => loadArticle(index),
        getState: () => ({ ...contentState }),
        reload: () => initContentEnhancement()
    };

})();