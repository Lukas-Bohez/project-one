(function SpireAdFallback() {
  'use strict';

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
    window.setTimeout(handleEmptyAds, 2500);
  }

  if (document.readyState === 'complete') {
    scheduleFallback();
  } else {
    window.addEventListener('load', scheduleFallback, { once: true });
  }
})();
