/**
 * Lofi Download Page JavaScript
 * Handles modal functionality and theme synchronization
 */

// Modal functions
function openModal() {
    const modal = document.getElementById('infoModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
    }
}

function closeModal() {
    const modal = document.getElementById('infoModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('infoModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

// Theme synchronization
(function() {
    'use strict';

    function getCurrentTheme() {
        const t = document.documentElement.getAttribute('data-theme');
        if (t) return t;
        if (document.body.classList.contains('theme-dark')) return 'dark';
        if (document.body.classList.contains('theme-light')) return 'light';
        return localStorage.getItem('theme') || localStorage.getItem('quiz-theme-preference') || 'light';
    }

    function updateModals() {
        const theme = getCurrentTheme();
        const isDark = theme === 'dark';
        const infoModal = document.getElementById('infoModal');

        if (infoModal) {
            const content = infoModal.querySelector('.c-modal__content');
            const closeBtn = infoModal.querySelector('.close-btn');

            if (isDark) {
                infoModal.classList.add('qts-dark');
                if (content) {
                    content.style.background = '#0f1724';
                    content.style.color = '#e6eef9';
                    content.style.boxShadow = '0 10px 40px rgba(0,0,0,0.6)';
                    content.style.borderColor = 'rgba(255,255,255,0.1)';

                    // Update all text elements
                    const title = content.querySelector('.modal-title');
                    if (title) {
                        title.style.color = '#e6eef9';
                        title.style.borderBottomColor = 'rgba(255,255,255,0.1)';
                    }

                    content.querySelectorAll('.section-title').forEach(t => {
                        t.style.color = '#93c5fd';
                    });

                    content.querySelectorAll('.info-section p, .info-list li').forEach(el => {
                        el.style.color = '#cbd5e1';
                    });

                    content.querySelectorAll('.info-list li strong').forEach(strong => {
                        strong.style.color = '#93c5fd';
                    });
                }

                if (closeBtn) {
                    closeBtn.style.color = '#cbd5e1';
                }
            } else {
                infoModal.classList.remove('qts-dark');
                if (content) {
                    content.style.background = 'white';
                    content.style.color = '#2c3e50';
                    content.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';
                    content.style.borderColor = '#e9ecef';

                    const title = content.querySelector('.modal-title');
                    if (title) {
                        title.style.color = '#2c3e50';
                        title.style.borderBottomColor = '#e9ecef';
                    }

                    content.querySelectorAll('.section-title').forEach(t => {
                        t.style.color = '#2563eb';
                    });

                    content.querySelectorAll('.info-section p, .info-list li').forEach(el => {
                        el.style.color = '#555';
                    });

                    content.querySelectorAll('.info-list li strong').forEach(strong => {
                        strong.style.color = '#2563eb';
                    });
                }

                if (closeBtn) {
                    closeBtn.style.color = '#6c757d';
                }
            }
        }
    }

    // Listen for theme changes
    window.addEventListener('storage', function(e) {
        if ((e.key === 'theme' || e.key === 'quiz-theme-preference') && e.newValue) {
            setTimeout(updateModals, 50);
        }
    });

    window.addEventListener('themeChanged', function(e) {
        setTimeout(updateModals, 50);
    });

    // Observe DOM changes for theme updates
    const observer = new MutationObserver(function(mutations) {
        let themeChanged = false;
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'data-theme' || mutation.attributeName === 'class')) {
                themeChanged = true;
            }
        });
        if (themeChanged) {
            setTimeout(updateModals, 10);
        }
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class']
    });

    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
    });

    // Initial update
    setTimeout(updateModals, 100);
})();
