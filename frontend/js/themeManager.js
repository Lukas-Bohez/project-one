// Dark Mode Toggle System for Quiz The Spire
// This script handles theme switching functionality across all pages

(function() {
    'use strict';
    
    // Theme management
    const THEME_KEY = 'spire-theme';
    const THEMES = {
        LIGHT: 'light',
        DARK: 'dark',
        SYSTEM: 'system'
    };
    
    class ThemeManager {
        constructor() {
            this.currentTheme = this.getStoredTheme();
            this.lastAppliedTheme = null;
            this.toggleButtonInitialized = false;
            this.boundToggle = null;
            this.init();
        }
        
        init() {
            // Initialize when DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.applyTheme(this.currentTheme);
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
                // DOM already loaded
                this.applyTheme(this.currentTheme);
                this.initToggleButton();
                // Load backgrounds immediately if DOM is already ready
                setTimeout(() => {
                    if (window.imageProvider) {
                        this.loadSpireBackgrounds();
                    }
                }, 100);
            }
            
            // Debug info
        }
        
        getStoredTheme() {
            try {
                const stored = localStorage.getItem(THEME_KEY);
                if (stored === THEMES.SYSTEM || !stored) {
                    return THEMES.DARK;
                }
                return stored === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
            } catch (e) {
                return THEMES.DARK;
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
            
            if (this.lastAppliedTheme === effectiveTheme) {
                return;
            }
            this.lastAppliedTheme = effectiveTheme;
            
            const html = document.documentElement;
            const body = document.body;

            // Drive the global theme selectors used across the site
            if (html) html.setAttribute('data-theme', effectiveTheme);
            if (body) body.setAttribute('data-theme', effectiveTheme);
            
            if (effectiveTheme === THEMES.DARK) {
                html.style.setProperty('--sentle-bg', '#121213');
                html.style.setProperty('--sentle-text', '#ffffff');
                html.style.setProperty('--sentle-border', '#3a3a3c');
                html.style.setProperty('--sentle-key-bg', '#818384');
                html.style.setProperty('--sentle-key-text', '#ffffff');
                html.style.setProperty('--color-input-bg', '#1e1e1e');
            } else {
                html.style.setProperty('--sentle-bg', '#ffffff');
                html.style.setProperty('--sentle-text', '#1a1a1b');
                html.style.setProperty('--sentle-border', '#d3d6da');
                html.style.setProperty('--sentle-key-bg', '#d3d6da');
                html.style.setProperty('--sentle-key-text', '#1a1a1b');
                html.style.setProperty('--color-input-bg', '#ffffff');
            }
            
            if (body) void body.offsetHeight;
            this.updateToggleButton();
            
            window.dispatchEvent(new CustomEvent('themeChanged', {
                detail: { theme: effectiveTheme }
            }));
            
            if (window.imageProvider) {
                this.loadSpireBackgrounds();
            }
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
            // Simple toggle: light <-> dark (no system mode)
            let newTheme;
            const effectiveTheme = this.getEffectiveTheme();
            
            if (effectiveTheme === THEMES.DARK) {
                newTheme = THEMES.LIGHT;
            } else {
                newTheme = THEMES.DARK;
            }
            
            this.setTheme(newTheme);
        }
        
        setTheme(theme) {
            this.currentTheme = theme;
            this.storeTheme(theme);
            this.applyTheme(theme);
        }
        
        // System theme change handler removed - no longer needed
        
        initToggleButton() {
            // Guard against multiple initializations
            if (this.toggleButtonInitialized) return;
            this.toggleButtonInitialized = true;
            
            // Find all theme toggle buttons
            const toggleBtns = [
                document.getElementById('servoTestBtn'),
                document.getElementById('servoTestBtn-mobile'),
                document.getElementById('theme-toggle'),
                document.getElementById('theme-toggle-mobile'),   // mobile support chat toggle
                document.getElementById('themeToggleBtn')
            ].filter(btn => btn !== null);
            
            if (toggleBtns.length === 0) {
                return;
            }
            
            // Update all buttons
            toggleBtns.forEach(btn => {
                this.updateToggleButton(btn);
                
                // Add single click listener
                btn.removeEventListener('click', this.boundToggle);
                this.boundToggle = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleTheme();
                };
                btn.addEventListener('click', this.boundToggle);
            });
        }
        
        updateToggleButton(specificBtn = null) {
            const toggleBtn = specificBtn || 
                             document.getElementById('servoTestBtn') || 
                             document.getElementById('servoTestBtn-mobile') ||
                             document.getElementById('theme-toggle') ||
                             document.getElementById('theme-toggle-mobile');
            if (!toggleBtn) return;
            
            const effectiveTheme = this.getEffectiveTheme();
            let title;
            
            if (effectiveTheme === THEMES.DARK) {
                title = 'Dark mode active. Click to switch to light mode.';
            } else {
                title = 'Light mode active. Click to switch to dark mode.';
            }
            
            // Only update title and aria-label, don't change the button content (keeps emoji)
            toggleBtn.title = title;
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