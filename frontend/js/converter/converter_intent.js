/**
 * public/js/converter_intent.js
 *
 * Enhances the "Google Play" download button on the converter page:
 *   - On Android, opens the Play Store *app* directly via market://
 *     (instead of the browser), falling back to the https URL if the
 *     Play Store app isn't available.
 *   - On desktop/non-Android, the plain https link is used unchanged.
 *
 * Confirmed against the live AndroidManifest.xml (v13.2.1+):
 *   - applicationId = com.torrentspire.ai
 *   - BitPlayer has NO custom URL scheme (no bitplayer://). It only
 *     handles .torrent files via file:// and content://, so a YouTube
 *     URL handoff via intent://scheme= would not resolve. The Play
 *     Store link is the correct install/update path.
 */

const BITPLAYER_PACKAGE = "com.torrentspire.ai";
const PLAY_STORE_HREF =
  "https://play.google.com/store/apps/details?id=" + BITPLAYER_PACKAGE;
const MARKET_HREF = "market://details?id=" + BITPLAYER_PACKAGE;
const HANDOFF_TIMEOUT_MS = 1500;

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

/**
 * Opens the Play Store app directly on Android via market://, with a
 * visibility-change fallback to the https URL if the app isn't present.
 */
function openPlayStore() {
  if (!isAndroid()) {
    window.location.href = PLAY_STORE_HREF;
    return;
  }

  let handedOff = false;
  const onVisibilityChange = () => {
    if (document.hidden) handedOff = true;
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  window.location.href = MARKET_HREF;

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (!handedOff) window.location.href = PLAY_STORE_HREF;
  }, HANDOFF_TIMEOUT_MS);
}

// Wire up the Google Play button (data-download-android).
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector("[data-download-android]");
  if (!btn) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    openPlayStore();
  });
});
