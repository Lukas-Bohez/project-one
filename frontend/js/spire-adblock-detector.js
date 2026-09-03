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

    overlay.innerHTML =
      '' +
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

    // Self-heal: if a real ad renders while the banner is up (the detection
    // was a false positive), dismiss the banner and remember that ads work.
    var healTimer = window.setInterval(function () {
      if (!overlay.parentNode) {
        window.clearInterval(healTimer);
        return;
      }
      if (findRenderedAd()) {
        window.clearInterval(healTimer);
        try {
          localStorage.setItem(
            'adblock-dismissed',
            JSON.stringify({
              timestamp: Date.now(),
              ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
            })
          );
        } catch (e) {
          // localStorage unavailable — just close the banner
        }
        closeNotice();
      }
    }, 1000);
  }

  var ADSENSE_URL =
    'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8418485814964449';
  var CANARY_STYLE =
    'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;';

  // True when the element is hidden from layout (the way ad blockers hide ads).
  function isElementHidden(el) {
    if (!el || !el.parentNode) return true;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return true;
    }
    return el.offsetWidth === 0 || el.offsetHeight === 0;
  }

  // Generic canary: appends a bait element and an identical control element.
  // The bait carries ad-typical class names so blockers hide it, the control
  // does not. Only when the bait is hidden AND the control is visible do we
  // conclude an ad blocker is active. If the control is hidden too, something
  // else in the environment is interfering and we stay quiet (fail open).
  function runCanaryCheck(baitClassName, waitMs) {
    return new Promise(function (resolve) {
      var bait = document.createElement('div');
      bait.className = baitClassName;
      bait.style.cssText = CANARY_STYLE;

      var control = document.createElement('div');
      control.style.cssText = CANARY_STYLE;

      document.body.appendChild(bait);
      document.body.appendChild(control);

      window.setTimeout(function () {
        var baitHidden = isElementHidden(bait);
        var controlHidden = isElementHidden(control);
        if (bait && bait.parentNode) bait.remove();
        if (control && control.parentNode) control.remove();

        // Return true if the ad blocker is DISABLED (bait not blocked).
        resolve(!(baitHidden && !controlHidden));
      }, waitMs);
    });
  }

  // ── Ground truth: did a real ad actually render on this page? ────────────
  // Heuristics (canary bait, network probes) can misfire. A rendered AdSense
  // creative is observable proof that ads are working for this visitor, so it
  // must always win over any heuristic.
  function findRenderedAd() {
    var slots = document.querySelectorAll('ins.adsbygoogle');
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (slot.getAttribute('data-ad-status') === 'filled') return slot;
      if (slot.querySelector('iframe')) return slot;
      if (slot.getBoundingClientRect().height > 5) return slot;
    }
    // AdSense places its creative iframe inside the ad wrappers.
    var wrappedIframes = document.querySelectorAll('.ad-unit-wrapper iframe');
    if (wrappedIframes.length > 0) return wrappedIframes[0];
    return null;
  }

  // Last gate before the banner may appear: ads can render a few seconds
  // after load, so observe briefly and only confirm "blocked" if no real ad
  // shows up in the meantime.
  var GROUND_TRUTH_OBSERVE_MS = 8000;
  function confirmBlockedThen(onConfirmedBlocked) {
    var started = Date.now();
    (function check() {
      if (findRenderedAd()) return; // Ads genuinely render — stay quiet
      if (Date.now() - started >= GROUND_TRUTH_OBSERVE_MS) {
        onConfirmedBlocked();
        return;
      }
      window.setTimeout(check, 600);
    })();
  }

  // Re-run adblock canary check
  function verifyWhitelistingAsync() {
    return runCanaryCheck('ad-banner adsbox doubleclick pub_300x250 text-ad', 400).then(
      function (whitelisted) {
        // Ads visibly rendering is definitive proof of whitelisting, even if
        // a leftover cosmetic rule still hides the canary bait.
        return whitelisted || !!findRenderedAd();
      }
    );
  }

  // Handle user claiming to have disabled adblocker
  function handleWhitelistClaim() {
    verificationAttempts++;
    whitelistButton.textContent = 'Checking...';
    whitelistButton.disabled = true;

    verifyWhitelistingAsync()
      .then(function (whitelisted) {
        if (whitelisted) {
          // Success: user genuinely disabled adblocker
          messageElement.textContent =
            'Thanks for supporting a solo dev! ❤️ This site is now whitelisted.';
          whitelistButton.textContent = '✓ Thanks!';

          // Set dismissed flag with 7-day TTL
          localStorage.setItem(
            'adblock-dismissed',
            JSON.stringify({
              timestamp: Date.now(),
              ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
            })
          );

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
          messageElement.textContent =
            'Still detecting an ad blocker. Please disable it for quizthespire.com and refresh the page, then click again.';
          whitelistButton.textContent = verificationAttempts > 1 ? 'Check again' : 'Try again';
          whitelistButton.disabled = false;
          // Do NOT set localStorage — user needs to actually disable it
        }
      })
      .catch(function (err) {
        console.error('Whitelist verification error:', err);
        whitelistButton.textContent = 'Check again';
        whitelistButton.disabled = false;
      });
  }

  // Detection methods
  function detectAdblockBait() {
    return runCanaryCheck('adsbox ad-banner ad-placement text-ad', 200);
  }

  // True when this page actually serves AdSense ads (so blocking is relevant).
  function pageUsesAdSense() {
    return !!(
      document.querySelector('script[src*="googlesyndication"], ins.adsbygoogle') ||
      window.adsbygoogle
    );
  }

  // True when the AdSense library actually made it through (ads can serve).
  function isAdSenseLoaded() {
    return !!(window.adsbygoogle && typeof window.adsbygoogle.push === 'function');
  }

  // Network-level check: try to reach the AdSense script. With mode 'no-cors'
  // a successful request resolves as an opaque response, while ad blockers,
  // DNS firewalls, etc. cause the request to fail. We retry once to rule out
  // transient network hiccups, and fail open on any error.
  function probeAdSenseNetwork(attempt) {
    return fetch(ADSENSE_URL, { mode: 'no-cors', cache: 'no-store' })
      .then(function () {
        return false; // Script reachable — not blocked
      })
      .catch(function () {
        if (attempt < 2) {
          return new Promise(function (resolve) {
            window.setTimeout(resolve, 400);
          }).then(function () {
            return probeAdSenseNetwork(attempt + 1);
          });
        }
        return true; // Still failing after retry — treat as blocked
      });
  }

  // Replaces the old "is window.adsbygoogle defined within 500ms" heuristic,
  // which flagged every visitor whose AdSense script simply took a moment to
  // load (slow connection, cold cache, mobile). Ad blockers do not reliably
  // remove the global, but they do reliably kill the network request — so we
  // probe the network instead of watching a timer.
  function detectNetworkBlocking() {
    // Old browsers without fetch: skip this check entirely (fail open).
    if (typeof window.fetch !== 'function') return Promise.resolve(false);
    // Offline: network failures prove nothing about ad blockers.
    if (window.navigator && navigator.onLine === false) return Promise.resolve(false);
    // Pages that never load ads should never see the banner.
    if (!pageUsesAdSense()) return Promise.resolve(false);
    // Ads already loaded and working — nothing is blocked.
    if (isAdSenseLoaded()) return Promise.resolve(false);

    return probeAdSenseNetwork(1);
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
          Promise.all([detectAdblockBait(), detectNetworkBlocking()])
            .then(function (results) {
              var blocked = results[0] || results[1];
              if (blocked) {
                // User re-enabled adblocker, show banner again — but only if
                // no real ad is actually rendering (ground truth wins).
                localStorage.removeItem('adblock-dismissed');
                confirmBlockedThen(showAdblockNotice);
              }
              // else: still genuinely whitelisted, stay quiet
            })
            .catch(function () {
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
    Promise.all([detectAdblockBait(), detectNetworkBlocking()])
      .then(function (results) {
        var blocked = results[0] || results[1];
        if (blocked) {
          // Heuristics say blocked, but a rendered ad is proof they are
          // wrong — observe briefly and only then show the banner.
          confirmBlockedThen(showAdblockNotice);
        }
      })
      .catch(function () {
        // If detection fails, assume not blocked (false positive prevention)
      });
  }

  // Run detection after the page has fully loaded (so the async AdSense script
  // had a fair chance to arrive) and the browser is idle, to avoid blocking
  // LCP/TBT and to avoid false positives from scripts still in flight.
  var GRACE_AFTER_LOAD_MS = 1500;

  var runDetectionWhenIdle = function () {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(detectAdblock, { timeout: 2000 });
    } else {
      // Fallback: delay detection so it doesn't run during initial render
      window.setTimeout(detectAdblock, 500);
    }
  };

  var scheduleDetection = function () {
    if (document.readyState === 'complete') {
      window.setTimeout(runDetectionWhenIdle, GRACE_AFTER_LOAD_MS);
    } else {
      window.addEventListener(
        'load',
        function () {
          window.setTimeout(runDetectionWhenIdle, GRACE_AFTER_LOAD_MS);
        },
        { once: true }
      );
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleDetection);
  } else {
    scheduleDetection();
  }
})();
