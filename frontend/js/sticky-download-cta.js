/**
 * Sticky Download CTA
 * Shows a sticky bar with download link when user scrolls past the hero section
 * Dismissible for 24 hours with localStorage flag
 */
(function () {
  'use strict';

  const DISMISS_KEY = 'sticky-cta-dismissed';
  const DISMISS_TTL = 24 * 60 * 60 * 1000; // 24 hours

  function initStickyDownloadCTA() {
    // Check if user dismissed recently
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissTime = parseInt(dismissed, 10);
      if (Date.now() - dismissTime < DISMISS_TTL) {
        return; // Still dismissed, don't show
      }
      // TTL expired, remove flag
      localStorage.removeItem(DISMISS_KEY);
    }

    // Find the hero header element to observe
    const heroSection = document.querySelector('.c-header');
    if (!heroSection) return;

    // Create sticky bar
    const stickyBar = document.createElement('div');
    stickyBar.className = 'sticky-download-cta';
    stickyBar.id = 'sticky-download-bar';
    stickyBar.innerHTML = `
      <div class="sticky-download-cta__content">
        <a href="https://play.google.com/store/apps/details?id=com.torrentspire.ai" 
           class="sticky-download-cta__link"
           target="_blank"
           rel="noopener noreferrer">
          <i class="fa-solid fa-download"></i>
          Get Convert The Spire Reborn on Google Play
        </a>
        <button class="sticky-download-cta__dismiss" 
                type="button" 
                aria-label="Dismiss download prompt"
                title="Dismiss for 24 hours">
          ×
        </button>
      </div>
    `;

    // Style the sticky bar
    stickyBar.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #fff;
      padding: 12px 16px;
      z-index: 999;
      box-shadow: 0 -2px 12px rgba(37, 99, 235, 0.2);
      transform: translateY(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 14px;
      line-height: 1.5;
    `;

    // Add to DOM
    document.body.appendChild(stickyBar);

    // Style link and dismiss button
    const link = stickyBar.querySelector('.sticky-download-cta__link');
    const dismissBtn = stickyBar.querySelector('.sticky-download-cta__dismiss');

    link.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #fff;
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.2s ease;
    `;

    link.addEventListener('mouseenter', () => {
      link.style.opacity = '0.9';
    });

    link.addEventListener('mouseleave', () => {
      link.style.opacity = '1';
    });

    dismissBtn.style.cssText = `
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: #fff;
      font-size: 24px;
      width: 32px;
      height: 32px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      padding: 0;
    `;

    dismissBtn.addEventListener('mouseenter', () => {
      dismissBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    });

    dismissBtn.addEventListener('mouseleave', () => {
      dismissBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    });

    // Handle dismiss
    dismissBtn.addEventListener('click', () => {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
      stickyBar.style.transform = 'translateY(100%)';
      setTimeout(() => {
        if (stickyBar.parentNode) stickyBar.remove();
      }, 300);
    });

    // Use IntersectionObserver to show/hide based on hero visibility
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show when hero is NOT visible (user scrolled past)
        // Hide when hero IS visible
        if (entry.isIntersecting) {
          stickyBar.style.transform = 'translateY(100%)'; // Hide
        } else {
          stickyBar.style.transform = 'translateY(0)'; // Show
        }
      },
      {
        threshold: 0, // Trigger when any part leaves view
        rootMargin: '0px 0px 0px 0px'
      }
    );

    observer.observe(heroSection);
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStickyDownloadCTA);
  } else {
    initStickyDownloadCTA();
  }
})();
