(function SpireAdFallback() {
  'use strict';

  var INIT_RETRY_LIMIT = 10;
  var INIT_RETRY_MS = 600;
  var COLLAPSE_DELAY_MS = 7000;

  function initializeAdsSlots() {
    if (!window.adsbygoogle) return false;

    var initializedAny = false;
    document.querySelectorAll('.js-adsbygoogle').forEach(function (slot) {
      try {
        (adsbygoogle = window.adsbygoogle || []).push({});
        slot.classList.remove('js-adsbygoogle');
        initializedAny = true;
      } catch (_) {
        // Ignore blocked/duplicate push errors and keep page usable.
      }
    });

    return initializedAny;
  }

  function scheduleAdInitialization() {
    var attempts = 0;

    (function tryInit() {
      attempts += 1;
      initializeAdsSlots();

      if (attempts < INIT_RETRY_LIMIT && document.querySelector('.js-adsbygoogle')) {
        window.setTimeout(tryInit, INIT_RETRY_MS);
      }
    })();
  }

  function isRenderedAd(insEl) {
    if (!insEl) return false;
    if (insEl.querySelector('iframe')) return true;
    if (insEl.getBoundingClientRect().height > 5) return true;
    if ((insEl.textContent || '').trim().length > 20) return true;
    return false;
  }

  function collapseWrapper(wrapper) {
    wrapper.classList.add('ad-unit-wrapper--collapsed');
    window.setTimeout(function () {
      wrapper.setAttribute('aria-hidden', 'true');
      wrapper.innerHTML = '';
      wrapper.style.display = 'none';
    }, 320);
  }

  function handleEmptyAds() {
    var wrappers = document.querySelectorAll('.ad-unit-wrapper');

    wrappers.forEach(function (wrapper) {
      var ins = wrapper.querySelector('ins.adsbygoogle');
      if (!ins || isRenderedAd(ins)) return;

      collapseWrapper(wrapper);
    });
  }

  function scheduleFallback() {
    scheduleAdInitialization();
    window.setTimeout(handleEmptyAds, COLLAPSE_DELAY_MS);
  }

  if (document.readyState === 'complete') {
    scheduleFallback();
  } else {
    window.addEventListener('load', scheduleFallback, { once: true });
  }
})();
