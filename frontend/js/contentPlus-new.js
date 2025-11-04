/**
 * contentPlus-new.js
 * Drop-in replacement for contentPlus.js that loads articles from the backend API
 * Compatible with content.html structure and existing content.css styles
 */

(function () {
  'use strict';

  // Config
  const API_BASE = `https://${window.location.hostname}/api/v1`;

  // State
  let stories = [];
  let currentStory = null;
  let articles = []; // current story's chapters

  // Utilities
  function escapeHTML(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[c] || c);
  }

  function byOrder(a, b) {
    // Prefer explicit story_order if present; fallback to title
    const ao = (a.story_order ?? a.order ?? 0);
    const bo = (b.story_order ?? b.order ?? 0);
    if (ao !== bo) return ao - bo;
    return String(a.title || '').localeCompare(String(b.title || ''));
  }

  // API calls
  async function apiGet(path) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GET ${path} failed: ${res.status} ${res.statusText} ${text}`);
    }
    return res.json();
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

  async function fetchFreshStories() {
    const data = await apiGet('/stories/');
    return Array.isArray(data) ? data : [];
  }

  async function fetchStories() {
    const CACHE_KEY = 'contentPlus_stories';
    const cached = getCache(CACHE_KEY);
    if (cached) {
      console.log('[ContentPlus Cache Hit] Using cached stories');
      if (!isValid(cached, CACHE_DURATION)) {
        fetchFreshStories().then(freshData => {
          setCache(CACHE_KEY, freshData);
          console.log('[ContentPlus Cache Update] Stories updated in background');
          // Update global stories
          stories = freshData;
        }).catch(err => console.error('Background stories fetch failed:', err));
      }
      return cached.data;
    } else {
      console.log('[ContentPlus Cache Miss] Fetching fresh stories');
      const data = await fetchFreshStories();
      setCache(CACHE_KEY, data);
      return data;
    }
  }

  async function fetchFreshArticlesByStory(storyId) {
    const data = await apiGet(`/articles/by-story/${encodeURIComponent(storyId)}/`);
    return Array.isArray(data) ? data : [];
  }

  async function fetchArticlesByStory(storyId) {
    const CACHE_KEY = `contentPlus_articles_${storyId}`;
    const cached = getCache(CACHE_KEY);
    if (cached) {
      console.log(`[ContentPlus Cache Hit] Using cached articles for story ${storyId}`);
      if (!isValid(cached, CACHE_DURATION)) {
        fetchFreshArticlesByStory(storyId).then(freshData => {
          setCache(CACHE_KEY, freshData);
          console.log(`[ContentPlus Cache Update] Articles updated in background for story ${storyId}`);
          // Update if current story
          if (currentStory && currentStory.id === storyId) {
            articles = freshData.map(normalizeArticle);
          }
        }).catch(err => console.error('Background articles fetch failed:', err));
      }
      return cached.data;
    } else {
      console.log(`[ContentPlus Cache Miss] Fetching fresh articles for story ${storyId}`);
      const data = await fetchFreshArticlesByStory(storyId);
      setCache(CACHE_KEY, data);
      return data;
    }
  }

  // Fetch and populate current story's articles
  async function fetchStoryArticles(storyId) {
    const list = await fetchArticlesByStory(storyId);
    // Attach story reference
    list.forEach(a => { a.__story = currentStory; });
    list.sort(byOrder);
    return list;
  }

  // Data normalization
  function normalizeArticle(apiArticle) {
    // content field may be JSON string or object
    let content = {};
    try {
      content = typeof apiArticle.content === 'string' ? JSON.parse(apiArticle.content) : (apiArticle.content || {});
    } catch (e) {
      console.warn('Failed to parse article.content JSON for', apiArticle?.title, e);
      content = {};
    }

    // accept both new content JSON shape and old flat props
    const intro = content.intro || apiArticle.excerpt || apiArticle.story || '';
    const highlights = Array.isArray(content.highlights) ? content.highlights : [];
    const sections = Array.isArray(content.sections) ? content.sections : [];

    return {
      title: apiArticle.title || 'Untitled',
      intro,
      highlights,
      sections,
      story_order: apiArticle.story_order ?? apiArticle.order ?? 0,
      __story: apiArticle.__story,
      _raw: apiArticle,
    };
  }

  // DOM helpers
  function el(id) { return document.getElementById(id); }

  function ensureChapterSelect() {
    // Create or return the chapter selector in the same container as the story selector
    let chap = el('chapter-select');
    if (chap) return chap;
    const container = document.querySelector('.article-selector') || el('article-display')?.parentElement;
    if (!container) return null;
    chap = document.createElement('select');
    chap.id = 'chapter-select';
    chap.className = 'story-selector'; // reuse existing select styling
    chap.disabled = true;
    chap.title = 'Select chapter';
    // Insert after the story select if present
    const storySel = el('article-select');
    if (storySel && storySel.parentNode === container) {
      storySel.insertAdjacentElement('afterend', chap);
    } else {
      container.appendChild(chap);
    }
    chap.addEventListener('change', (e) => {
      const idx = Number(e.target.value);
      if (Number.isFinite(idx)) loadArticle(idx);
    });
    return chap;
  }

  function renderDefaultMessage() {
    const articleDisplay = el('article-display');
    if (!articleDisplay) return;
    articleDisplay.innerHTML = `
      <div class="article">
        <div class="article-header">
          <h2 class="article-title">Welcome to Article The Spire</h2>
          <p class="article-intro">Select a story from the dropdown above to begin reading</p>
        </div>
        <div class="article-content">
          <p>Discover dark fantasy tales of cursed bloodlines, ancient powers, and the eternal struggle between light and darkness.</p>
          <p>Each story explores themes of redemption, sacrifice, and the heavy price of power in a world where magic comes at a cost.</p>
        </div>
      </div>
    `;
  }

  // Public: Initialize the dropdown with stories (story selector)
  async function initializeArticleSelector() {
    const select = el('article-select');
    if (!select) return;

    select.disabled = true;

    try {
      stories = await fetchStories();

      // Reset options, keep placeholder (index 0)
      while (select.options.length > 1) select.remove(1);

      stories.forEach((story) => {
        const option = document.createElement('option');
        option.value = String(story.id);
        option.textContent = story.name ?? story.title ?? `Story ${story.id}`;
        select.appendChild(option);
      });

      select.disabled = false;

      // Default: start at first story, chapter 1
      if (stories.length > 0) {
        const firstId = String(stories[0].id);
        select.value = firstId;
        loadStory(firstId);
      } else {
        renderDefaultMessage();
      }
    } catch (e) {
      console.error('Failed to initialize story selector', e);
      renderDefaultMessage();
      select.disabled = false;
    }
  }

  // Public: Load a story (populate chapters and show chapter 1)
  async function loadStory(storyId) {
    const select = el('article-select');
    if (!storyId) {
      renderDefaultMessage();
      return;
    }

    currentStory = stories.find(s => String(s.id) === String(storyId)) || null;
    try {
      const list = await fetchStoryArticles(storyId);
      articles = list.map(normalizeArticle);
      // Always start at chapter 1 (index 0)
      loadArticle(0);
      // Sync dropdown selection
      if (select) select.value = String(storyId);
      // Populate chapter selector
      const chap = ensureChapterSelect();
      if (chap) {
        chap.innerHTML = '';
        articles.forEach((a, i) => {
          const opt = document.createElement('option');
          const num = (a._raw && a._raw.id) ? a._raw.id : (Number.isFinite(a.story_order) ? (a.story_order + 1) : (i + 1));
          opt.value = String(i); // value is index for simple navigation
          opt.textContent = `#${num} ${a.title}`;
          chap.appendChild(opt);
        });
        chap.disabled = articles.length === 0;
        chap.value = '0';
      }
    } catch (e) {
      console.error('Failed to load story', storyId, e);
      renderDefaultMessage();
    }
  }

  // Public: Load and display the selected article (chapter within current story)
  function loadArticle(index) {
    const articleDisplay = el('article-display');
    const select = el('article-select');
    if (!articleDisplay) return;

    if (index === "" || index === null || index === undefined) {
      renderDefaultMessage();
      return;
    }

    const idx = Number(index);
    const article = articles[idx];
    if (!article) {
      renderDefaultMessage();
      return;
    }

    let highlightsHTML = '';
    if (article.highlights && Array.isArray(article.highlights)) {
      article.highlights.forEach((highlight) => {
        const hTitle = escapeHTML(highlight.title ?? '');
        const hContent = escapeHTML(highlight.content ?? '');
        highlightsHTML += `
          <div class="highlight">
            <h4>${hTitle}</h4>
            <p>${hContent}</p>
          </div>
        `;
      });
    }

    let sectionsHTML = '';
    if (article.sections && Array.isArray(article.sections)) {
      article.sections.forEach((section) => {
        const sTitle = escapeHTML(section.title ?? '');
        const sContent = escapeHTML(section.content ?? '');
        const listItems = Array.isArray(section.list) ? section.list.map((item) => `<li>${escapeHTML(item)}</li>`).join('') : '';
        sectionsHTML += `
          <div class="section">
            <h3>${sTitle}</h3>
            <p>${sContent}</p>
            ${listItems ? `<ul>${listItems}</ul>` : ''}
          </div>
        `;
      });
    }

    const prevIndex = idx - 1;
    const nextIndex = idx + 1;
    const hasMultipleArticles = articles.length > 1;
    const hasPrevious = prevIndex >= 0;
    const hasNext = nextIndex < articles.length;

    const prevButton = hasPrevious ?
      `<button class="nav-button prev-button" onclick="loadArticle(${prevIndex})">
        <span class="button-icon">←</span>
        Previous
      </button>` : '';

    const nextButton = hasNext ?
      `<button class="nav-button next-button" onclick="loadArticle(${nextIndex})">
        Next
        <span class="button-icon">→</span>
      </button>` : '';

    const navigationHTML = hasMultipleArticles ? `
      <div class="article-navigation top-navigation">
        <div class="nav-controls" style="display: flex; align-items: center; gap: 1rem;">
          ${prevButton}
          <span class="article-counter">${idx + 1} / ${articles.length}</span>
          ${nextButton}
        </div>
      </div>
    ` : '';

    const bottomNavigationHTML = hasMultipleArticles ? `
      <div class="article-navigation bottom-navigation">
        <div class="nav-controls" style="display: flex; align-items: center; gap: 1rem;">
          ${prevButton}
          <span class="article-counter">${idx + 1} / ${articles.length}</span>
          ${nextButton}
        </div>
      </div>
    ` : '';

    articleDisplay.innerHTML = `
      <div class="article">
        <div class="article-header">
          <h2 class="article-title">${escapeHTML(article.title)}</h2>
          ${article.__story ? `<p class="article-subtitle" style="margin-top:.5rem;opacity:.9">${escapeHTML(article.__story.name)}${Number.isFinite(article.story_order) ? ` — Chapter ${article.story_order + 1}` : ''}</p>` : ''}
          <p class="article-intro">${escapeHTML(article.intro)}</p>
        </div>
        ${navigationHTML}
        <div class="article-content">
          ${highlightsHTML ? `<div class="highlights">${highlightsHTML}</div>` : ''}
          ${sectionsHTML}
        </div>
        ${bottomNavigationHTML}
      </div>
    `;

    // Keep dropdown selection in sync with current story
    if (select && currentStory) select.value = String(currentStory.id);
    // Sync chapter selector selection
    const chap = el('chapter-select');
    if (chap) chap.value = String(idx);
    // Scroll to the top of the article (not the full page)
    const articleEl = articleDisplay.querySelector('.article');
    if (articleEl && typeof articleEl.scrollIntoView === 'function') {
      articleEl.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    }
  }

  // Public: Navigation between sections in content.html
  function showSection(sectionName) {
    document.querySelectorAll('.section-content').forEach((section) => {
      section.classList.remove('active');
    });

    document.querySelectorAll('.nav a').forEach((link) => {
      link.classList.remove('active');
    });

    const elTarget = document.getElementById(sectionName);
    if (elTarget) elTarget.classList.add('active');

    // Add active to clicked nav link if available
    if (window.event && window.event.target && window.event.target.matches('.nav a')) {
      window.event.target.classList.add('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Theme toggle binding (optional convenience)
  function bindThemeToggle() {
    const btn = document.getElementById('servoTestBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const root = document.documentElement;
      const current = root.getAttribute('data-theme');
      root.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    });
  }

  // Clear articles cache
  function clearArticlesCache() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('contentPlus_articles_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} articles cache entries`);
      alert(`Cleared ${keysToRemove.length} articles cache entries. Refresh the page to reload fresh data.`);
    } catch (e) {
      console.error('Error clearing articles cache:', e);
      alert('Error clearing articles cache. Check console for details.');
    }
  }

  // Auto-init on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    bindThemeToggle();
    initializeArticleSelector();
  });

  // Expose globals for compatibility with inline handlers
  window.initializeArticleSelector = initializeArticleSelector;
  window.loadStory = loadStory;
  window.loadArticle = loadArticle;
  window.showSection = showSection;
  window.clearArticlesCache = clearArticlesCache;

})();
