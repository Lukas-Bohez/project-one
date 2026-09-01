/**
 * public/js/converter_intent.js
 *
 * Hands a playlist/video URL off to the installed BitPlayer Android app
 * (which already does yt-dlp-based downloading natively), falling back to
 * this page's own web download flow if BitPlayer isn't installed, the
 * handoff doesn't fire, or the visitor isn't on Android at all.
 *
 * This is an Intent URL handoff, not "Android App Links" — App Links are
 * for making your own https://quizthespire.com/... URLs open directly in
 * your app via a verified assetlinks.json; they don't apply to handing a
 * third-party YouTube URL to an app. The intent:// scheme below is the
 * mechanism that actually does "try the app, fall back to the page."
 *
 * PLACEHOLDERS TO CONFIRM BEFORE SHIPPING:
 *   - BITPLAYER_PACKAGE must match `applicationId` in BitPlayer's
 *     android/app/build.gradle. "com.quizthespire.bitplayer" below is a
 *     guess, not a confirmed value.
 *   - BITPLAYER_SCHEME must match whatever custom scheme BitPlayer
 *     registers in its AndroidManifest.xml <intent-filter>, and BitPlayer
 *     needs an intent-filter for that scheme + a "download" host if it
 *     doesn't have one yet.
 *   - The DOM hookup at the bottom guesses at #download-btn /
 *     #playlist-url — adjust to converter.html's actual element IDs.
 */

const BITPLAYER_PACKAGE = "com.quizthespire.bitplayer"; // TODO confirm against build.gradle
const BITPLAYER_SCHEME = "bitplayer"; // TODO confirm against AndroidManifest.xml
const HANDOFF_TIMEOUT_MS = 1500;

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

/**
 * Attempts to hand `youtubeUrl` off to BitPlayer. Calls
 * `onWebDownload(youtubeUrl)` if the app isn't installed, the visitor
 * isn't on Android, or the handoff doesn't claim the page within
 * HANDOFF_TIMEOUT_MS.
 */
function handoffOrDownload(youtubeUrl, onWebDownload) {
  if (!isAndroid()) {
    onWebDownload(youtubeUrl);
    return;
  }

  const encodedUrl = encodeURIComponent(youtubeUrl);
  const fallbackUrl = encodeURIComponent(
    `${window.location.origin}${window.location.pathname}?url=${encodedUrl}&handoff=failed`
  );
  const intentUrl =
    `intent://download?url=${encodedUrl}` +
    `#Intent;scheme=${BITPLAYER_SCHEME};package=${BITPLAYER_PACKAGE};` +
    `S.browser_fallback_url=${fallbackUrl};end`;

  // Chrome for Android resolves S.browser_fallback_url itself when the app
  // isn't installed. Other Android browsers (Samsung Internet, Firefox,
  // etc.) don't always honor that, so this also watches for the page being
  // backgrounded — a sign the app actually opened — and falls back
  // manually on a timeout if that never happens.
  let handedOff = false;
  const onVisibilityChange = () => {
    if (document.hidden) handedOff = true;
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  window.location.href = intentUrl;

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (!handedOff) onWebDownload(youtubeUrl);
  }, HANDOFF_TIMEOUT_MS);
}

// Wire up to the existing download control. This assumes a #download-btn
// button, a #playlist-url input, and a startWebDownload(url) function
// already defined on the page for the pre-handoff web download flow —
// adjust the selectors/handler name to match converter.html's real markup.
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("download-btn");
  const urlInput = document.getElementById("playlist-url");
  if (!btn || !urlInput) return;

  btn.addEventListener("click", (e) => {
    const url = urlInput.value.trim();
    if (!url) return;
    e.preventDefault();
    handoffOrDownload(url, (u) => {
      if (typeof startWebDownload === "function") {
        startWebDownload(u);
      } else {
        console.warn(
          "startWebDownload() not found — wire this to the existing web download flow."
        );
      }
    });
  });
});
