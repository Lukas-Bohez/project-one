(function HomepageEnhancements() {
  'use strict';

  function animateCounter(counter) {
    var target = parseInt(counter.getAttribute('data-target') || '0', 10);
    var duration = 1400;
    var startTime = null;

    function tick(timestamp) {
      if (startTime === null) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = Math.round(eased * target).toLocaleString();
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        counter.textContent = target.toLocaleString();
      }
    }

    requestAnimationFrame(tick);
  }

  function initHeroCounters() {
    var counters = document.querySelectorAll('.hero-stat-number');
    var heroStats = document.querySelector('.hero-stats');
    if (!counters.length || !heroStats) return;

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        if (!entries[0] || !entries[0].isIntersecting) return;
        counters.forEach(function (counter) {
          animateCounter(counter);
        });
        observer.disconnect();
      }, { threshold: 0.35 });

      observer.observe(heroStats);
      return;
    }

    counters.forEach(function (counter) {
      animateCounter(counter);
    });
  }

  function initBackToTop() {
    var button = document.getElementById('back-to-top');
    if (!button) return;

    var onScroll = function () {
      button.classList.toggle('visible', window.scrollY > 400);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function markCurrentNavLink() {
    var links = document.querySelectorAll('nav a[href]');
    if (!links.length) return;

    links.forEach(function (link) {
      try {
        var url = new URL(link.href, window.location.origin);
        if (
          url.href === window.location.href ||
          (url.pathname !== '/' && window.location.pathname.startsWith(url.pathname))
        ) {
          link.setAttribute('aria-current', 'page');
        }
      } catch (_) {
        // Ignore malformed href values
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initHeroCounters();
      initBackToTop();
      markCurrentNavLink();
    }, { once: true });
  } else {
    initHeroCounters();
    initBackToTop();
    markCurrentNavLink();
  }
}());