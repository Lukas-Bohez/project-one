// Articles Dynamic Loading System
// Automatically scans articles.json and generates article cards

class ArticlesManager {
    constructor() {
        this.articles = [];
        this.categories = {};
        this.tags = {};
        this.currentFilter = 'all';
        this.currentSort = 'date-desc';
        this.searchQuery = '';
        this.init();
    }

    async init() {
        try {
            await this.loadArticlesData();
            this.renderArticles();
            this.setupEventListeners();
            console.log('Articles system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize articles system:', error);
            this.renderError();
        }
    }

    async loadArticlesData() {
        const response = await fetch('articles.json');
        if (!response.ok) {
            throw new Error(`Failed to load articles: ${response.status}`);
        }
        
        const data = await response.json();
        this.articles = data.articles || [];
        this.categories = data.categories || {};
        this.tags = data.tags || {};
        
        console.log(`Loaded ${this.articles.length} articles`);
    }

    renderArticles() {
        const container = document.getElementById('articles-container');
        if (!container) {
            console.error('Articles container not found');
            return;
        }

        const filteredArticles = this.getFilteredAndSortedArticles();
        
        if (filteredArticles.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--ink-muted);">
                    <h3>No articles found</h3>
                    <p>Try adjusting your search or filter criteria.</p>
                </div>
            `;
            return;
        }

        const articlesHTML = filteredArticles.map(article => this.createArticleCard(article)).join('');
        container.innerHTML = `<div class="a-grid">${articlesHTML}</div>`;

        // After render, populate AI thumbnails if available
        if (window.imageProvider) {
            window.imageProvider.populateThumbnails(container);
        }
    }

    createArticleCard(article) {
        const formattedDate = this.formatDate(article.date);
        const tagsHTML = article.tags.slice(0, 3).map(tag => 
            `<span class="tag">${tag}</span>`
        ).join('');

        const hasImage = !!article.image;
        const aiQuery = article.imageQuery || this.generateContextualQuery(article);
        const thumbInner = hasImage
            ? `<img 
                    src="${article.image}"
                    alt="${article.title}"
                    loading="lazy"
                    class="a-card__img"
                    onerror="this.style.display='none'; this.closest('.a-card__thumb').classList.add('no-img'); this.closest('.a-card__thumb').innerHTML='${this.generateImagePlaceholder(article).replace(/"/g, '&quot;')}'"
               />`
            : this.generateImagePlaceholder(article);

        return `
            <article class="a-card" onclick="window.location.href='${article.htmlFile}'">
                <div class="a-card__thumb ${hasImage ? '' : 'no-img'}" style="background: ${this.generateGradientForArticle(article)};" data-ai-query="${aiQuery.replace(/"/g, '&quot;')}">
                    ${thumbInner}
                </div>
                <div class="a-card__body">
                    <h2 class="a-card__title">${article.title}</h2>
                    <div class="a-card__meta">
                        By ${article.author} • ${formattedDate} • ${article.readTime}
                    </div>
                    <p class="a-card__desc">${article.description}</p>
                    <div class="a-card__tags">
                        ${tagsHTML}
                        ${article.featured ? '<span class="tag" style="background: var(--accent); color: white;">Featured</span>' : ''}
                    </div>
                </div>
            </article>
        `;
    }

    generateGradientForArticle(article) {
        // Generate unique gradients based on article category and tags
        const gradients = {
            opinion: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            tech: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            society: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            default: 'linear-gradient(135deg, #059669, #047857)'
        };

        return gradients[article.category] || gradients.default;
    }

    generateContextualQuery(article) {
        // Enhanced query generation for better image relevance
        const conceptMap = {
            'wealth-inequality': 'economic inequality protest, rich vs poor, financial disparity, social justice',
            'economics': 'financial charts, money, economic data, business district, wall street',
            'politics': 'government building, political rally, voting, democracy, capitol',
            'opinion': 'editorial photo, thought-provoking image, social commentary',
            'society': 'diverse community, social issues, people gathering, cultural scene',
            'tech': 'technology innovation, digital world, computers, modern workplace'
        };

        // Extract visual concepts from tags and category
        let visualConcepts = [];
        
        if (Array.isArray(article.tags)) {
            article.tags.forEach(tag => {
                if (conceptMap[tag]) {
                    visualConcepts.push(conceptMap[tag]);
                }
            });
        }
        
        if (conceptMap[article.category] && !visualConcepts.length) {
            visualConcepts.push(conceptMap[article.category]);
        }

        // Build contextual query
        const titleKeywords = article.title
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .slice(0, 3)
            .join(' ');

        const styleKeywords = 'editorial photography, photojournalism, professional, high quality';
        
        if (visualConcepts.length > 0) {
            return `${visualConcepts[0]}, ${titleKeywords}, ${styleKeywords}`;
        } else {
            return `${titleKeywords} concept, ${styleKeywords}`;
        }
    }

    generateImagePlaceholder(article) {
        // Generate text-based placeholders for articles
        const icons = {
            opinion: '💭',
            tech: '⚡',
            society: '🌍',
            economics: '📊',
            politics: '🏛️',
            'wealth-inequality': '⚖️'
        };

        // Use first matching tag or category for icon
        const iconKey = article.tags.find(tag => icons[tag]) || article.category;
        const icon = icons[iconKey] || '📰';
        
        return `<span style="font-size: 2.5rem;">${icon}</span>`;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    getFilteredAndSortedArticles() {
        let filtered = [...this.articles];

        // Apply category filter
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(article => 
                article.category === this.currentFilter || 
                article.tags.includes(this.currentFilter)
            );
        }

        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(article =>
                article.title.toLowerCase().includes(query) ||
                article.description.toLowerCase().includes(query) ||
                article.tags.some(tag => tag.toLowerCase().includes(query)) ||
                article.author.toLowerCase().includes(query)
            );
        }

        // Apply sorting
        switch (this.currentSort) {
            case 'date-desc':
                filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
            case 'date-asc':
                filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
                break;
            case 'title':
                filtered.sort((a, b) => a.title.localeCompare(b.title));
                break;
        }

        return filtered;
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderArticles();
            });
        }

        // Category filter
        const categorySelect = document.getElementById('category-filter');
        if (categorySelect) {
            this.populateCategoryFilter(categorySelect);
            categorySelect.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                this.renderArticles();
            });
        }

        // Sort options
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.renderArticles();
            });
        }
    }

    populateCategoryFilter(selectElement) {
        const options = ['<option value="all">All Categories</option>'];
        
        Object.entries(this.categories).forEach(([key, category]) => {
            options.push(`<option value="${key}">${category.name}</option>`);
        });

        selectElement.innerHTML = options.join('');
    }

    renderError() {
        const container = document.getElementById('articles-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--ink-muted);">
                    <h3>Error Loading Articles</h3>
                    <p>Please try refreshing the page. If the problem persists, check the console for details.</p>
                </div>
            `;
        }
    }

    // Public methods for external use
    refreshArticles() {
        this.loadArticlesData().then(() => {
            this.renderArticles();
        });
    }

    addArticle(article) {
        this.articles.unshift(article); // Add to beginning
        this.renderArticles();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.articlesManager = new ArticlesManager();
});

// Fallback for immediate execution
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.articlesManager) {
            window.articlesManager = new ArticlesManager();
        }
    });
} else {
    window.articlesManager = new ArticlesManager();
}