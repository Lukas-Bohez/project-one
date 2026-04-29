/**
 * Branded Ad Fallback System
 * Replaces empty ad units with branded content for self-promotion
 * Priority: Convert The Spire → SpireAI → GitHub Sponsors
 */
(function () {
  'use strict';

  if (window.__ENABLE_AD_FALLBACK__ !== true) {
    return;
  }

  // Branded content definitions
  const BRANDED_CONTENT = {
    convert: {
      title: 'Convert The Spire',
      icon: 'fa-download',
      description: 'Fast local media conversion without cloud uploads',
      cta: 'Try Convert',
      href: 'https://github.com/Lukas-Bohez/ConvertTheSpireFlutter',
      color: '#2563eb'
    },
    spireai: {
      title: 'SpireAI',
      icon: 'fa-sparkles',
      description: 'AI-powered quiz generation with instant themes',
      cta: 'Generate Quizzes',
      href: '/pages/spire-ai/',
      color: '#8b5cf6'
    },
    sponsors: {
      title: 'Support My Work',
      icon: 'fa-heart',
      description: 'Sponsor development via GitHub Sponsors',
      cta: 'Become Sponsor',
      href: 'https://github.com/sponsors/Lukas-Bohez',
      color: '#ec4899'
    }
  };

  function createBrandedCard(content) {
    const card = document.createElement('div');
    card.className = 'branded-ad-card';
    card.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.5rem;
      border-radius: 12px;
      background: linear-gradient(135deg, ${content.color}15 0%, ${content.color}08 100%);
      border: 1.5px solid ${content.color}30;
      text-align: center;
      color: inherit;
      text-decoration: none;
      transition: all 0.3s ease;
      min-height: 180px;
      justify-content: center;
    `;

    const iconEl = document.createElement('div');
    iconEl.innerHTML = `<i class="fa-solid ${content.icon}" style="font-size: 2rem; color: ${content.color};"></i>`;
    iconEl.style.cssText = 'margin: 0 auto;';

    const titleEl = document.createElement('h3');
    titleEl.textContent = content.title;
    titleEl.style.cssText = 'margin: 0; font-size: 1.1rem; font-weight: 600;';

    const descEl = document.createElement('p');
    descEl.textContent = content.description;
    descEl.style.cssText = 'margin: 0; font-size: 0.9rem; opacity: 0.85;';

    const ctaEl = document.createElement('button');
    ctaEl.textContent = content.cta;
    ctaEl.style.cssText = `
      background: ${content.color};
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 0.5rem;
    `;
    ctaEl.onmouseover = () => {
      ctaEl.style.opacity = '0.9';
      ctaEl.style.transform = 'scale(1.05)';
    };
    ctaEl.onmouseout = () => {
      ctaEl.style.opacity = '1';
      ctaEl.style.transform = 'scale(1)';
    };
    ctaEl.onclick = () => {
      if (content.href) {
        window.location.href = content.href;
      }
    };

    card.appendChild(iconEl);
    card.appendChild(titleEl);
    card.appendChild(descEl);
    card.appendChild(ctaEl);

    return card;
  }

  function replaceAdUnit(wrapper, contentKey) {
    wrapper.innerHTML = '';
    const card = createBrandedCard(BRANDED_CONTENT[contentKey]);
    wrapper.appendChild(card);
    wrapper.classList.remove('ad-unit-wrapper--collapsed');
    wrapper.style.display = 'block';
  }

  function handleEmptyAds() {
    const wrappers = document.querySelectorAll('.ad-unit-wrapper');
    const slots = ['ad-slot-square', 'ad-slot-article', 'ad-slot-horizontal', 'ad-slot-multiplex'];
    const contentRotation = ['convert', 'spireai', 'sponsors'];
    let contentIndex = 0;

    wrappers.forEach(function (wrapper) {
      // Check if this is an empty ad unit
      const ins = wrapper.querySelector('ins.adsbygoogle');
      if (!ins) return;

      // Check if ad is rendered
      const hasIframe = ins.querySelector('iframe');
      const hasHeight = ins.getBoundingClientRect().height > 5;
      const hasContent = (ins.textContent || '').trim().length > 20;

      if (hasIframe || hasHeight || hasContent) {
        // Ad was rendered successfully, skip
        return;
      }

      // Ad is empty, replace with branded content
      const contentKey = contentRotation[contentIndex % contentRotation.length];
      replaceAdUnit(wrapper, contentKey);
      contentIndex++;
    });
  }

  function scheduleFallback() {
    // Wait for ads to load (1-2 seconds) then check for empty units
    window.setTimeout(handleEmptyAds, 1500);
  }

  if (document.readyState === 'complete') {
    scheduleFallback();
  } else {
    window.addEventListener('load', scheduleFallback, { once: true });
  }
})();
