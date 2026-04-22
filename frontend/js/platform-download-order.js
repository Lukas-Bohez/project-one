(function PlatformDownloadOrder() {
  'use strict';

  function getPlatform() {
    var ua = navigator.userAgent || '';

    if (/android/i.test(ua)) return 'android';
    if (/linux/i.test(ua) && !/android/i.test(ua)) return 'linux';
    if (/macintosh|mac os x/i.test(ua)) return 'macos';
    return 'windows';
  }

  function reorderButtons() {
    var container = document.querySelector('.c-product-card__actions--platform');
    if (!container) return;

    var platformMap = {
      windows: '.c-btn--windows',
      android: '.c-btn--android',
      linux: '.c-btn--linux',
      macos: '.c-btn--macos'
    };

    var primaryButton = container.querySelector(platformMap[getPlatform()]);
    if (!primaryButton) return;

    if (primaryButton !== container.firstElementChild) {
      container.insertBefore(primaryButton, container.firstElementChild);
    }

    container.querySelectorAll('.platform-highlight').forEach(function (button) {
      button.classList.remove('platform-highlight');
    });

    primaryButton.classList.add('platform-highlight');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reorderButtons, { once: true });
  } else {
    reorderButtons();
  }
}());