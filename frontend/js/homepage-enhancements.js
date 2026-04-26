(function HomepageEnhancements() {
  'use strict';

  function animateCounter(counter) {
    var target = parseInt(counter.getAttribute('data-target') || '0', 10);
    var suffix = counter.getAttribute('data-suffix') || '';
    var duration = 1400;
    var startTime = null;

    if (isNaN(target)) return;

    var prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      counter.textContent = String(target) + suffix;
      return;
    }

    function tick(timestamp) {
      if (startTime === null) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = String(Math.round(eased * target)) + suffix;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        counter.textContent = String(target) + suffix;
      }
    }

    requestAnimationFrame(tick);
  }

  function initHeroCounters() {
    var counters = document.querySelectorAll('.hero-stat-number');
    var heroStats = document.querySelector('.hero-stats');
    if (!counters.length || !heroStats) return;

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          if (!entries[0] || !entries[0].isIntersecting) return;
          counters.forEach(function (counter) {
            animateCounter(counter);
          });
          observer.disconnect();
        },
        { threshold: 0.35 }
      );

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

    if (!button.querySelector('.back-to-top__ring')) {
      button.insertAdjacentHTML(
        'afterbegin',
        '<svg class="back-to-top__ring" viewBox="0 0 36 36" aria-hidden="true" focusable="false">\
          <circle class="back-to-top__ring-base" cx="18" cy="18" r="16"></circle>\
          <circle id="scroll-ring" class="back-to-top__ring-progress" cx="18" cy="18" r="16" stroke-dasharray="100" stroke-dashoffset="100"></circle>\
        </svg>'
      );
    }

    var ring = button.querySelector('#scroll-ring');
    Array.prototype.slice.call(button.childNodes).forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim()) {
        button.removeChild(node);
      }
    });

    if (!button.querySelector('.back-to-top__arrow')) {
      var arrow = document.createElement('span');
      arrow.className = 'back-to-top__arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↑';
      button.appendChild(arrow);
    }

    button.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    var onScroll = function () {
      var maxScroll = document.body.scrollHeight - window.innerHeight;
      var percent = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
      if (ring) {
        ring.style.strokeDashoffset = String(100 - percent * 100);
      }
      button.classList.toggle('visible', window.scrollY > 100);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
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
      } catch {
        // Ignore malformed href values
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      function () {
        // Counter animation is handled by stat-counter-animation.js
        initBackToTop();
        markCurrentNavLink();
      },
      { once: true }
    );
  } else {
    // Counter animation is handled by stat-counter-animation.js
    initBackToTop();
    markCurrentNavLink();
  }
})();
