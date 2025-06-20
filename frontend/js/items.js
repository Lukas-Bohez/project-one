class CompliantAdSystem {
    constructor() {
        this.adContainers = [];
        this.adInterval = null;
        this.adDurationTimeout = null;
        this.isActive = false;
        this.adIndex = 0;
        
        // Compliant ad configuration
        this.adConfig = {
            refreshRate: 30000, // 30 seconds between rotations
            displayDuration: 60000, // 1 minute total display
            maxAdsPerPage: 3,
            adClientId: 'ca-pub-8418485814964449',
            adSlot: '7822007431'
        };
        
        this.adPlacements = [
            {
                id: 'ad-between-header-question',
                insertAfter: '.c-quiz-header',
                insertBefore: '.c-question-container'
            },
            {
                id: 'ad-between-question-answers',
                insertAfter: '.c-question-container',
                insertBefore: '.c-answers-container'
            },
            {
                id: 'ad-between-answers-sidebar',
                insertAfter: '.c-answers-container',
                insertBefore: '.c-game-sidebar'
            }
        ];
    }

    async activate() {
        if (this.isActive) return;
        
        console.log('Initializing compliant ad system...');
        this.isActive = true;
        
        // Load Google AdSense script if not already loaded
        await this.loadAdScript();
        
        // Create ad containers in designated positions
        this.createAdContainers();
        
        // Start ad rotation
        this.startAdRotation();
        
        // Set duration timeout
        this.adDurationTimeout = setTimeout(() => {
            this.deactivate();
        }, this.adConfig.displayDuration);
        
        console.log(`Ad system activated for ${this.adConfig.displayDuration/1000} seconds`);
    }

    async loadAdScript() {
        return new Promise((resolve) => {
            // Check if already loaded
            if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
                resolve(true);
                return;
            }

            const script = document.createElement('script');
            script.async = true;
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.adConfig.adClientId}`;
            script.crossOrigin = 'anonymous';
            
            script.onload = () => {
                console.log('Google AdSense script loaded successfully');
                resolve(true);
            };
            
            script.onerror = () => {
                console.warn('AdSense script failed to load, using fallback ads');
                resolve(false);
            };
            
            document.head.appendChild(script);
        });
    }

    createAdContainers() {
        this.adPlacements.forEach((placement, index) => {
            const targetElement = document.querySelector(placement.insertAfter);
            if (!targetElement) return;

            const adContainer = document.createElement('div');
            adContainer.id = placement.id;
            adContainer.className = 'integrated-ad-container';
            adContainer.style.cssText = `
                margin: 20px 0;
                padding: 15px;
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                text-align: center;
                min-height: 100px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                transition: all 0.3s ease;
                position: relative;
            `;

            // Add ad label for transparency
            const label = document.createElement('div');
            label.textContent = 'Advertisement';
            label.style.cssText = `
                position: absolute;
                top: 5px;
                left: 10px;
                font-size: 10px;
                color: #6c757d;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            `;
            adContainer.appendChild(label);

            // Insert after target element
            targetElement.parentNode.insertBefore(adContainer, targetElement.nextSibling);
            this.adContainers.push({
                element: adContainer,
                id: placement.id,
                loaded: false
            });
        });
    }

    startAdRotation() {
        // Load initial ads
        this.loadAdsInContainers();
        
        // Set up rotation interval
        this.adInterval = setInterval(() => {
            this.rotateAds();
        }, this.adConfig.refreshRate);
    }

    loadAdsInContainers() {
        this.adContainers.forEach((container, index) => {
            if (container.loaded) return;
            
            this.loadAdInContainer(container, index);
        });
    }

    loadAdInContainer(container, index) {
        const adContent = document.createElement('div');
        adContent.className = 'ad-content';
        adContent.style.cssText = `
            width: 100%;
            min-height: 90px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        try {
            // Create Google AdSense ad
            const adIns = document.createElement('ins');
            adIns.className = 'adsbygoogle';
            adIns.style.cssText = `
                display: block;
                width: 100%;
                height: 90px;
            `;
            adIns.setAttribute('data-ad-client', this.adConfig.adClientId);
            adIns.setAttribute('data-ad-slot', this.adConfig.adSlot);
            adIns.setAttribute('data-ad-format', 'horizontal');
            adIns.setAttribute('data-full-width-responsive', 'false');

            adContent.appendChild(adIns);
            
            // Clear container and add new content
            const existingContent = container.element.querySelector('.ad-content');
            if (existingContent) {
                existingContent.remove();
            }
            
            container.element.appendChild(adContent);

            // Push to AdSense
            if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
                window.adsbygoogle.push({});
                container.loaded = true;
            } else {
                this.showFallbackAd(adContent, index);
            }

        } catch (error) {
            console.warn('Error loading ad:', error);
            this.showFallbackAd(adContent, index);
        }
    }

    showFallbackAd(container, index) {
        const fallbackAds = [
            {
                title: "Support Our Quiz Platform",
                description: "Help us keep this quiz platform free and ad-supported!",
                cta: "Learn More",
                link: "#support"
            },
            {
                title: "Premium Quiz Features",
                description: "Unlock advanced quiz creation tools and analytics.",
                cta: "Upgrade Now",
                link: "#premium"
            },
            {
                title: "Create Your Own Quiz",
                description: "Build engaging quizzes for your audience in minutes.",
                cta: "Get Started",
                link: "#create"
            }
        ];

        const ad = fallbackAds[index % fallbackAds.length];
        
        container.innerHTML = `
            <div style="text-align: center; padding: 10px;">
                <h4 style="color: #007bff; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
                    ${ad.title}
                </h4>
                <p style="color: #6c757d; margin: 0 0 12px 0; font-size: 14px; line-height: 1.4;">
                    ${ad.description}
                </p>
                <a href="${ad.link}" style="
                    display: inline-block;
                    padding: 8px 16px;
                    background: #007bff;
                    color: white;
                    text-decoration: none;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: 500;
                    transition: background 0.2s;
                " onmouseover="this.style.background='#0056b3'" 
                   onmouseout="this.style.background='#007bff'">
                    ${ad.cta}
                </a>
            </div>
        `;
    }

    rotateAds() {
        // Rotate ads by refreshing content
        this.adContainers.forEach((container, index) => {
            if (Math.random() > 0.5) { // 50% chance to refresh each ad
                container.loaded = false;
                this.loadAdInContainer(container, (index + this.adIndex) % this.adContainers.length);
            }
        });
        this.adIndex++;
    }

    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // Clear intervals and timeouts
        if (this.adInterval) {
            clearInterval(this.adInterval);
            this.adInterval = null;
        }
        
        if (this.adDurationTimeout) {
            clearTimeout(this.adDurationTimeout);
            this.adDurationTimeout = null;
        }
        
        // Remove ad containers
        this.adContainers.forEach(container => {
            if (container.element && container.element.parentNode) {
                container.element.parentNode.removeChild(container.element);
            }
        });
        
        this.adContainers = [];
        this.adIndex = 0;
        
        console.log('Ad system deactivated');
    }

    // Public method to manually refresh ads
    refreshAds() {
        if (!this.isActive) return;
        
        this.adContainers.forEach(container => {
            container.loaded = false;
        });
        
        this.loadAdsInContainers();
    }

    // Check if ad blocker is present
    async checkAdBlocker() {
        try {
            const testElement = document.createElement('div');
            testElement.innerHTML = '&nbsp;';
            testElement.className = 'adsbox';
            testElement.style.cssText = 'position: absolute; left: -9999px;';
            document.body.appendChild(testElement);
            
            setTimeout(() => {
                const isBlocked = testElement.offsetHeight === 0;
                document.body.removeChild(testElement);
                return isBlocked;
            }, 100);
            
            return false;
        } catch (e) {
            return true;
        }
    }
}

// Initialize the system
window.CompliantAdSystem = CompliantAdSystem;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.adSystem = new CompliantAdSystem();
    });
} else {
    window.adSystem = new CompliantAdSystem();
}

// Expose activation method globally
window.activateAds = function() {
    if (window.adSystem) {
        window.adSystem.activate();
    } else {
        console.warn('Ad system not initialized');
    }
};

// Optional: Auto-activate after page load (remove if you want manual control)
window.addEventListener('load', () => {
    setTimeout(() => {
        if (window.adSystem && !window.adSystem.isActive) {
            // Uncomment the next line to auto-activate
            // window.adSystem.activate();
        }
    }, 2000);
});