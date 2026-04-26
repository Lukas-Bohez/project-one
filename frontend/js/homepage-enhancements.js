(function HomepageEnhancements() {
  'use strict';

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
