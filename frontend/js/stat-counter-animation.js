/**
 * Stat Counter Animation
 * Animates the hero stat numbers from 0 to their target values
 * Triggers on page load and respects reduced-motion preferences
 */
(function () {
  'use strict';

  const ANIMATION_DURATION = 2000; // 2 seconds
  const ANIMATION_DELAY = 300; // 300ms delay before starting

  function animateCounter(element) {
    const target = parseInt(element.dataset.target, 10);
    const suffix = element.dataset.suffix || '';

    if (isNaN(target)) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      element.textContent = target + suffix;
      return;
    }

    const startValue = 0;
    const startTime = Date.now();

    function easeOutQuad(t) {
      return t * (2 - t); // Quadratic ease-out
    }

    function updateCounter() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      const eased = easeOutQuad(progress);
      const current = Math.floor(startValue + (target - startValue) * eased);

      element.textContent = current + suffix;

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = target + suffix; // Ensure final value is exact
      }
    }

    updateCounter();
  }

  function initializeCounters() {
    const counters = document.querySelectorAll('.hero-stat-number');

    if (counters.length === 0) return;

    // Add a small delay before starting animations for better UX
    setTimeout(() => {
      counters.forEach((counter, index) => {
        // Stagger animations slightly
        setTimeout(() => {
          animateCounter(counter);
        }, index * 100);
      });
    }, ANIMATION_DELAY);
  }

  // Schedule initialization during idle time, on first interaction, or when hero becomes visible
  function scheduleInitOnce() {
    if (window.__statCountersInitialized) return;
    window.__statCountersInitialized = true;

    if ('requestIdleCallback' in window) {
      requestIdleCallback(initializeCounters, { timeout: 2000 });
    } else {
      setTimeout(initializeCounters, 2000);
    }
  }

  function onFirstInteraction() {
    scheduleInitOnce();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // If hero is near viewport, initialize sooner
      const hero = document.querySelector('.hero') || document.querySelector('.c-header');
      if (hero && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries, obs) => {
          if (entries.some(e => e.isIntersecting)) {
            scheduleInitOnce();
            obs.disconnect();
          }
        }, { rootMargin: '200px' });
        io.observe(hero);
      } else {
        // Fallback: schedule on idle
        scheduleInitOnce();
      }
    });
  } else {
    scheduleInitOnce();
  }

  ['keydown', 'pointerdown', 'touchstart', 'mousemove'].forEach(evt =>
    window.addEventListener(evt, onFirstInteraction, { passive: true, once: true })
  );
})();
