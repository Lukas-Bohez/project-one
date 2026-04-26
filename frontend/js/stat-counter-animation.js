/**
 * Stat Counter Animation
 * Animates the hero stat numbers from 0 to their target values
 * Triggers on page load or when stats come into view
 */
(function () {
  'use strict';

  const ANIMATION_DURATION = 2000; // 2 seconds
  const ANIMATION_DELAY = 300; // 300ms delay before starting

  function animateCounter(element) {
    const target = parseInt(element.dataset.target, 10);
    const suffix = element.dataset.suffix || '';
    
    if (isNaN(target)) return;

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

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCounters);
  } else {
    initializeCounters();
  }
})();
