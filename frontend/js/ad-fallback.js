(function SpireAdFallback() {
  'use strict';

  var SELF_PROMO_TILES = [
    {
      label: 'Quiz The Spire',
      headline: 'Play Live Multiplayer Quizzes - Free',
      body: 'Real-time leaderboards, AI-powered themes, and classroom-ready quiz sessions.',
      cta: 'Play Now →',
      href: '/pages/spire-ai/',
      icon: '🧠'
    },
    {
      label: 'Convert The Spire',
      headline: 'Download YouTube Playlists in 4K - Free',
      body: 'Open-source, no ads, and built for Windows, Android, Linux, and macOS.',
      cta: 'Get It Free →',
      href: '/pages/conversion/',
      icon: '⬇️'
    },
    {
      label: 'Developer Portfolio',
      headline: 'Built by One Developer',
      body: 'See the full portfolio and release history behind the project.',
      cta: 'View Portfolio →',
      href: '/portfolio/',
      icon: '💼'
    },
    {
      label: 'Articles',
      headline: 'Guides and Developer Articles',
      body: 'Read release notes, tutorials, and deeper breakdowns of the builds.',
      cta: 'Read Articles →',
      href: '/articles/articlepagenew.html',
      icon: '📖'
    }
  ];

  function getFallbackMode() {
    return 'promo';
  }

  function isRenderedAd(insEl) {
    if (!insEl) return false;
    if (insEl.querySelector('iframe')) return true;
    if (insEl.getBoundingClientRect().height > 5) return true;
    if ((insEl.textContent || '').trim().length > 20) return true;
    return false;
  }

  function buildSelfPromoTile(tile) {
    var anchor = document.createElement('a');
    anchor.href = tile.href;
    anchor.className = 'ad-self-promo';
    anchor.setAttribute('aria-label', tile.headline);
    anchor.innerHTML = [
      '<div class="ad-self-promo-inner">',
        '<span class="ad-self-promo-icon" aria-hidden="true">' + tile.icon + '</span>',
        '<div class="ad-self-promo-content">',
          '<p class="ad-self-promo-label">' + tile.label + '</p>',
          '<p class="ad-self-promo-headline">' + tile.headline + '</p>',
          '<p class="ad-self-promo-body">' + tile.body + '</p>',
        '</div>',
        '<span class="ad-self-promo-cta">' + tile.cta + '</span>',
      '</div>'
    ].join('');
    return anchor;
  }

  function collapseWrapper(wrapper) {
    wrapper.classList.add('ad-unit-wrapper--collapsed');
    window.setTimeout(function () {
      wrapper.innerHTML = '';
      wrapper.style.display = 'none';
    }, 320);
  }

  function replaceWithPromo(wrapper, tile) {
    wrapper.classList.add('ad-unit-wrapper--fading');
    window.setTimeout(function () {
      wrapper.innerHTML = '';
      wrapper.appendChild(buildSelfPromoTile(tile));
      wrapper.classList.remove('ad-unit-wrapper--fading');
    }, 260);
  }

  function handleEmptyAds() {
    var mode = getFallbackMode();
    var wrappers = document.querySelectorAll('.ad-unit-wrapper');

    wrappers.forEach(function (wrapper, index) {
      var ins = wrapper.querySelector('ins.adsbygoogle');
      if (!ins || isRenderedAd(ins)) return;

      if (mode === 'promo') {
        replaceWithPromo(wrapper, SELF_PROMO_TILES[index % SELF_PROMO_TILES.length]);
      } else {
        collapseWrapper(wrapper);
      }
    });
  }

  function scheduleFallback() {
    window.setTimeout(handleEmptyAds, 2200);
  }

  if (document.readyState === 'complete') {
    scheduleFallback();
  } else {
    window.addEventListener('load', scheduleFallback, { once: true });
  }
}());