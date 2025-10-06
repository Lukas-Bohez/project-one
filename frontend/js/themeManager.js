// Dark Mode Toggle System for Quiz The Spire
// This script handles theme switching functionality across all pages

(function() {
    'use strict';
    
    // Theme management
    const THEME_KEY = 'quiz-theme-preference';
    const THEMES = {
        LIGHT: 'light',
        DARK: 'dark',
        SYSTEM: 'system'
    };
    
    class ThemeManager {
        constructor() {
            this.currentTheme = this.getStoredTheme();
            this.init();
        }
        
        init() {
            // Set initial theme
            this.applyTheme(this.currentTheme);
            
            // Initialize toggle button when DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.initToggleButton();
                    // Load spire backgrounds after DOM is ready
                    if (window.imageProvider) {
                        this.loadSpireBackgrounds();
                    } else {
                        // If imageProvider isn't loaded yet, wait for it
                        window.addEventListener('load', () => {
                            if (window.imageProvider) {
                                this.loadSpireBackgrounds();
                            }
                        });
                    }
                });
            } else {
                this.initToggleButton();
                // Load backgrounds immediately if DOM is already ready
                setTimeout(() => {
                    if (window.imageProvider) {
                        this.loadSpireBackgrounds();
                    }
                }, 100);
            }
            
            // Debug info
            console.log('Theme Manager initialized:', {
                currentTheme: this.currentTheme,
                effectiveTheme: this.getEffectiveTheme(),
                toggleFunctionExists: typeof window.toggleTheme,
                documentReady: document.readyState
            });
        }
        
        getStoredTheme() {
            try {
                const stored = localStorage.getItem(THEME_KEY);
                // Convert old system preference to light mode, or default to light
                if (stored === THEMES.SYSTEM || !stored) {
                    return THEMES.LIGHT;
                }
                return stored === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
            } catch (e) {
                return THEMES.LIGHT;
            }
        }
        
        storeTheme(theme) {
            try {
                localStorage.setItem(THEME_KEY, theme);
            } catch (e) {
                console.warn('Unable to store theme preference');
            }
        }
        
        getSystemTheme() {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return THEMES.DARK;
            }
            return THEMES.LIGHT;
        }
        
        getEffectiveTheme(theme = this.currentTheme) {
            // No more system theme - just return the actual theme
            return theme === THEMES.SYSTEM ? THEMES.LIGHT : theme;
        }
        
        applyTheme(theme) {
            const effectiveTheme = this.getEffectiveTheme(theme);
            const html = document.documentElement;
            const body = document.body;
            
            console.log('Applying theme:', { theme, effectiveTheme });
            
            // Safely remove existing theme classes and attributes
            if (html) {
                html.removeAttribute('data-theme');
            }
            if (body) {
                body.removeAttribute('data-theme');
                body.classList.remove('theme-light', 'theme-dark');
            }
            
            // Apply new theme with maximum coverage
            if (effectiveTheme === THEMES.DARK) {
                if (html) html.setAttribute('data-theme', 'dark');
                if (body) {
                    body.setAttribute('data-theme', 'dark');
                    body.classList.add('theme-dark');
                }
                console.log('Applied dark theme to html and body');
                
                // Also apply to main content areas for admin
                const adminContainer = document.querySelector('.c-admin-container');
                const adminContent = document.querySelector('.c-admin-content');
                if (adminContainer) adminContainer.setAttribute('data-theme', 'dark');
                if (adminContent) adminContent.setAttribute('data-theme', 'dark');
                
            } else {
                if (html) html.setAttribute('data-theme', 'light');
                if (body) {
                    body.setAttribute('data-theme', 'light');
                    body.classList.add('theme-light');
                }
                console.log('Applied light theme to html and body');
                
                // Also apply to main content areas for admin
                const adminContainer = document.querySelector('.c-admin-container');
                const adminContent = document.querySelector('.c-admin-content');
                if (adminContainer) adminContainer.setAttribute('data-theme', 'light');
                if (adminContent) adminContent.setAttribute('data-theme', 'light');
            }
            
            // Force a style recalculation
            if (document.body) document.body.offsetHeight;
            
            // Update button text if it exists
            this.updateToggleButton();
            
            // Dispatch theme change event for other scripts
            window.dispatchEvent(new CustomEvent('themeChanged', {
                detail: { theme: effectiveTheme, preference: theme }
            }));
            
            // Trigger spire background image loading if imageProvider is available
            if (window.imageProvider) {
                this.loadSpireBackgrounds();
            }
            
            console.log('Theme application complete. Current data-theme attributes:', {
                html: html ? html.getAttribute('data-theme') : null,
                body: body ? body.getAttribute('data-theme') : null
            });
        }
        
        loadSpireBackgrounds() {
            // Load AI-generated spire images for both light and dark mode
            const lightImg = document.querySelector('.spire-bg-light');
            const darkImg = document.querySelector('.spire-bg-dark');
            
            if (lightImg && !lightImg.src && window.imageProvider) {
                const lightQuery = lightImg.getAttribute('data-ai-query');
                if (lightQuery) {
                    window.imageProvider.applyToInlineImage(lightImg, lightQuery);
                }
            }
            
            if (darkImg && !darkImg.src && window.imageProvider) {
                const darkQuery = darkImg.getAttribute('data-ai-query');
                if (darkQuery) {
                    window.imageProvider.applyToInlineImage(darkImg, darkQuery);
                }
            }
        }
        
        toggleTheme() {
            console.log('=== THEME TOGGLE CALLED ===');
            // Simple toggle: light <-> dark (no system mode)
            let newTheme;
            const effectiveTheme = this.getEffectiveTheme();
            
            console.log('toggleTheme method called:', {
                currentTheme: this.currentTheme,
                effectiveTheme: effectiveTheme
            });
            
            if (effectiveTheme === THEMES.DARK) {
                newTheme = THEMES.LIGHT;
            } else {
                newTheme = THEMES.DARK;
            }
            
            console.log('Setting new theme to:', newTheme);
            this.setTheme(newTheme);
        }
        
        setTheme(theme) {
            this.currentTheme = theme;
            this.storeTheme(theme);
            this.applyTheme(theme);
        }
        
        // System theme change handler removed - no longer needed
        
        initToggleButton() {
            // Find the theme toggle button (support multiple IDs)
            const toggleBtn = document.getElementById('servoTestBtn') || 
                             document.getElementById('theme-toggle');
            if (!toggleBtn) {
                console.log('No theme toggle button found');
                return;
            }
            
            console.log('Found theme toggle button:', toggleBtn.id);
            
            // Update button text and functionality
            this.updateToggleButton();
            
            // Always add our event listener, but don't replace onclick if it exists
            // This ensures our themeManager works alongside any existing onclick
            toggleBtn.addEventListener('click', (e) => {
                console.log('Theme toggle button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.toggleTheme();
            });
            
            console.log('Theme toggle button initialized successfully');
        }
        
        updateToggleButton() {
            const toggleBtn = document.getElementById('servoTestBtn') || 
                             document.getElementById('theme-toggle');
            if (!toggleBtn) return;
            
            const effectiveTheme = this.getEffectiveTheme();
            let text, title, emoji;
            
            if (effectiveTheme === THEMES.DARK) {
                text = 'Dark Mode';
                emoji = '🌙';
                title = 'Dark mode active. Click to switch to light mode.';
            } else {
                text = 'Light Mode';
                emoji = '🌓';
                title = 'Light mode active. Click to switch to dark mode.';
            }
            
            // Update button - if it contains only emoji, keep emoji, otherwise use text
            if (toggleBtn.textContent === '🌓' || toggleBtn.textContent === '🌙' || toggleBtn.textContent.length <= 2) {
                toggleBtn.textContent = emoji;
            } else {
                toggleBtn.textContent = text;
            }
            
            toggleBtn.title = title;
            
            // Add accessibility attributes
            toggleBtn.setAttribute('aria-label', title);
        }
        
        // Public API
        getCurrentTheme() {
            return this.currentTheme;
        }
        
        getEffectiveCurrentTheme() {
            return this.getEffectiveTheme();
        }
        
        // Force apply current theme to newly created elements
        applyThemeToNewElements(container = document) {
            const currentEffectiveTheme = this.getEffectiveTheme();
            console.log('Applying theme to new elements:', currentEffectiveTheme);
            
            // Ensure the container and all its children have the correct theme applied
            if (container !== document) {
                // Apply theme classes to the container itself
                if (currentEffectiveTheme === THEMES.DARK) {
                    container.setAttribute('data-theme', 'dark');
                } else {
                    container.setAttribute('data-theme', 'light');
                }
            }
            
            // Force refresh of theme for any elements that might not have inherited properly
            this.applyTheme(this.currentTheme);
        }
    }
    
    // Initialize theme manager
    window.themeManager = new ThemeManager();
    
    // Expose theme control functions globally for backwards compatibility
    window.setTheme = (theme) => window.themeManager.setTheme(theme);
    window.toggleTheme = () => {
        console.log('toggleTheme called globally - checking if themeManager exists:', !!window.themeManager);
        if (window.themeManager) {
            return window.themeManager.toggleTheme();
        } else {
            console.error('ThemeManager not initialized!');
        }
    };
    window.getCurrentTheme = () => window.themeManager.getCurrentTheme();
    
})();

// Legacy support for existing radar.js functionality
// This ensures the theme system works with existing pulse/sonar effects
document.addEventListener('DOMContentLoaded', function() {
    // Listen for theme changes to update pulse colors
    window.addEventListener('themeChanged', function(event) {
        const effectiveTheme = event.detail.theme;
        
        // Update CSS custom properties for pulse effects
        const root = document.documentElement;
        if (effectiveTheme === 'dark') {
            root.style.setProperty('--pulse-color', '#60a5fa');
            root.style.setProperty('--pulse-glow', 'rgba(96, 165, 250, 0.7)');
        } else {
            root.style.setProperty('--pulse-color', '#4a86e8');
            root.style.setProperty('--pulse-glow', 'rgba(74, 134, 232, 0.7)');
        }
    });
});