(function () {
  'use strict';

  var bannerElement = null;
  var messageElement = null;
  var whitelistButton = null;
  var verificationAttempts = 0;

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
      '  <p class="adblock-softwall__message">If you enjoy the platform, please disable your ad blocker for this site. We use lightweight ad placements to fund servers and updates.</p>' +
      '  <div class="adblock-softwall__actions">' +
      '    <button type="button" class="adblock-softwall__primary">I disabled my ad blocker</button>' +
      '    <button type="button" class="adblock-softwall__secondary">Continue anyway</button>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(overlay);
    bannerElement = overlay;
    messageElement = overlay.querySelector('.adblock-softwall__message');
    whitelistButton = overlay.querySelector('.adblock-softwall__primary');

    function closeNotice() {
      overlay.classList.add('is-leaving');
      window.setTimeout(function () {
        if (overlay.parentNode) overlay.remove();
        bannerElement = null;
      }, 220);
    }

    overlay.querySelector('.adblock-softwall__close').addEventListener('click', closeNotice);
    overlay.querySelector('.adblock-softwall__secondary').addEventListener('click', closeNotice);
    
    whitelistButton.addEventListener('click', handleWhitelistClaim);
  }

  // Re-run adblock canary check
  function verifyWhitelistingAsync() {
    return new Promise(function (resolve) {
      var canary = document.createElement('div');
      canary.className = 'ad-banner adsbox doubleclick pub_300x250 text-ad';
      canary.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;';
      document.body.appendChild(canary);

      window.setTimeout(function () {
        var blocked = false;
        if (canary && canary.parentNode) {
          var display = window.getComputedStyle(canary).display;
          var visibility = window.getComputedStyle(canary).visibility;
          var height = canary.offsetHeight;
          
          blocked = display === 'none' || visibility === 'hidden' || height === 0;
          canary.remove();
        }
        // Return true if adblock is DISABLED (not blocked)
        resolve(!blocked);
      }, 400);
    });
  }

  // Handle user claiming to have disabled adblocker
  function handleWhitelistClaim() {
    verificationAttempts++;
    whitelistButton.textContent = 'Checking...';
    whitelistButton.disabled = true;

    verifyWhitelistingAsync().then(function (whitelisted) {
      if (whitelisted) {
        // Success: user genuinely disabled adblocker
        messageElement.textContent = 'Thanks for supporting a solo dev! ❤️ This site is now whitelisted.';
        whitelistButton.textContent = '✓ Thanks!';
        
        // Set dismissed flag with 7-day TTL
        localStorage.setItem('adblock-dismissed', JSON.stringify({
          timestamp: Date.now(),
          ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
        }));

        // Hide banner after 3 seconds
        window.setTimeout(function () {
          if (bannerElement && bannerElement.parentNode) {
            bannerElement.classList.add('is-leaving');
            window.setTimeout(function () {
              if (bannerElement && bannerElement.parentNode) bannerElement.remove();
              bannerElement = null;
            }, 220);
          }
        }, 3000);
      } else {
        // Still blocked: show error message
        messageElement.textContent = 'Still detecting an ad blocker. Please disable it for quizthespire.com and refresh the page, then click again.';
        whitelistButton.textContent = verificationAttempts > 1 ? 'Check again' : 'Try again';
        whitelistButton.disabled = false;
        // Do NOT set localStorage — user needs to actually disable it
      }
    }).catch(function (err) {
      console.error('Whitelist verification error:', err);
      whitelistButton.textContent = 'Check again';
      whitelistButton.disabled = false;
    });
  }

  // Detection methods
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

  function detectAdblockFallback() {
    return new Promise(function (resolve) {
      var scriptLoaded = !!window.adsbygoogle;
      
      if (!scriptLoaded) {
        var iframeCheckTimeout = window.setTimeout(function () {
          var frames = document.querySelectorAll('iframe');
          for (var i = 0; i < frames.length; i++) {
            try {
              if (frames[i].src && frames[i].src.indexOf('googlesyndication') !== -1) {
                scriptLoaded = true;
                break;
              }
            } catch (e) {
              // Cross-origin iframe, skip
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
    // Check if user dismissed recently with valid TTL
    var dismissedData = localStorage.getItem('adblock-dismissed');
    if (dismissedData) {
      try {
        var data = JSON.parse(dismissedData);
        var age = Date.now() - data.timestamp;
        if (age < data.ttl) {
          // Still within TTL, but re-verify in case user re-enabled adblocker
          Promise.all([
            detectAdblockBait(),
            detectAdblockFallback()
          ]).then(function (results) {
            var blocked = results[0] || results[1];
            if (blocked) {
              // User re-enabled adblocker, show banner again
              localStorage.removeItem('adblock-dismissed');
              showAdblockNotice();
            }
            // else: still genuinely whitelisted, stay quiet
          }).catch(function () {
            // Detection error, stay quiet
          });
          return;
        }
      } catch (e) {
        // Parse error, continue to detection
        localStorage.removeItem('adblock-dismissed');
      }
    }

    // No valid dismissal, run full detection
    Promise.all([
      detectAdblockBait(),
      detectAdblockFallback()
    ]).then(function (results) {
      var blocked = results[0] || results[1];
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
