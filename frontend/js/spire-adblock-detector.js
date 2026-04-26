(function () {
  function showAdblockNotice() {
    if (document.getElementById('adblock-softwall')) return;

    var overlay = document.createElement('div');
    overlay.id = 'adblock-softwall';
    overlay.className = 'adblock-softwall';

    overlay.innerHTML = '' +
      '<div class="adblock-softwall__panel" role="dialog" aria-modal="true" aria-labelledby="adblock-title">' +
      '  <button class="adblock-softwall__close" type="button" aria-label="Close notice">\u00d7</button>' +
      '  <p class="adblock-softwall__kicker">Ads keep Quiz The Spire free</p>' +
      '  <h2 id="adblock-title">Ad blocker detected</h2>' +
      '  <p>If you enjoy the platform, please whitelist this site. We use lightweight ad placements to fund servers and updates.</p>' +
      '  <div class="adblock-softwall__actions">' +
      '    <button type="button" class="adblock-softwall__primary">I whitelisted Quiz The Spire</button>' +
      '    <button type="button" class="adblock-softwall__secondary">Continue with ad blocker</button>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(overlay);

    function closeNotice() {
      overlay.classList.add('is-leaving');
      window.setTimeout(function () {
        overlay.remove();
      }, 220);
    }

    overlay.querySelector('.adblock-softwall__close').addEventListener('click', closeNotice);
    overlay.querySelector('.adblock-softwall__secondary').addEventListener('click', closeNotice);
    overlay.querySelector('.adblock-softwall__primary').addEventListener('click', function () {
      localStorage.setItem('spireAdblockAcknowledged', 'true');
      closeNotice();
    });
  }

  // 3.1: Detect adblock with first-party fallback
  // Method 1: Check for bait element (standard approach)
  function detectAdblockBait() {
    var bait = document.createElement('div');
    bait.className = 'adsbox ad-banner ad-placement text-ad';
    bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(bait);

    return new Promise(function (resolve) {
      window.setTimeout(function () {
        var blocked = false;
        if (bait && bait.parentNode) {
          blocked = bait.offsetHeight === 0 || 
                   bait.clientHeight === 0 || 
                   window.getComputedStyle(bait).display === 'none';
          bait.remove();
        }
        resolve(blocked);
      }, 120);
    });
  }

  // Method 2: First-party fallback - check if ad scripts loaded
  function detectAdblockFallback() {
    return new Promise(function (resolve) {
      var scriptLoaded = !!window.adsbygoogle;
      
      // Additional fallback: check if Google Ads iframe exists
      if (!scriptLoaded) {
        var iframeCheckTimeout = window.setTimeout(function () {
          var frames = document.querySelectorAll('iframe');
          for (var i = 0; i < frames.length; i++) {
            if (frames[i].src.indexOf('googlesyndication') !== -1) {
              scriptLoaded = true;
              break;
            }
          }
          resolve(!scriptLoaded);
        }, 500);
      } else {
        resolve(false);
      }
    });
  }

  function detectAdblock() {
    if (localStorage.getItem('spireAdblockAcknowledged') === 'true') return;

    // Run both detection methods and use the more conservative result
    Promise.all([
      detectAdblockBait(),
      detectAdblockFallback()
    ]).then(function (results) {
      var blocked = results[0] || results[1]; // Blocked if either method detects it
      if (blocked) {
        showAdblockNotice();
      }
    }).catch(function () {
      // If detection fails, assume not blocked (false positive prevention)
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectAdblock);
  } else {
    detectAdblock();
  }
})();
