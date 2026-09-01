/**
 * public/idleGame/engine.js
 *
 * Delta-time engine for the tycoon idle game.
 *   - requestAnimationFrame drives ONLY the visible-tab render loop.
 *   - Date.now() timestamp diffing (on visibilitychange, focus, and page
 *     load) computes and awards offline progress. This is what actually
 *     survives a backgrounded tab, a closed tab, or a sleeping device —
 *     rAF runs in none of those cases, so it's the timestamp diff that
 *     does the real work here, not the render loop.
 *
 * Usage:
 *   GameEngine.start({
 *     renderFrame: (dtMs) => { ...update animations, redraw... },
 *     offlineProgress: (elapsedMs) => { ...award currency, show a toast... },
 *   });
 */

const GameEngine = (() => {
  const SAVE_KEY = "idleGame.lastTimestamp";
  // Ignore gaps shorter than this. It filters out ordinary tab-switches,
  // and it also stops visibilitychange + focus from both firing an
  // "offline progress" award for the same moment — the second check sees
  // a near-zero gap and is skipped.
  const MIN_OFFLINE_MS = 3000;

  let lastTick = 0; // performance.now() timestamp — foreground loop only
  let rafHandle = null;
  let onRenderFrame = () => {};
  let onOfflineProgress = () => {};

  function saveTimestamp() {
    try {
      localStorage.setItem(SAVE_KEY, String(Date.now()));
    } catch (e) {
      // Private browsing / storage quota / disabled storage — offline
      // progress just won't persist across reloads in that case.
      console.warn("GameEngine: could not persist timestamp", e);
    }
  }

  function consumeElapsedSinceLastSave() {
    let last;
    try {
      last = Number(localStorage.getItem(SAVE_KEY));
    } catch (e) {
      last = NaN;
    }
    const current = Date.now();
    saveTimestamp();
    if (!last || Number.isNaN(last) || last > current) {
      return 0; // first run ever, or the system clock moved backwards
    }
    return current - last;
  }

  function maybeAwardOffline() {
    const elapsed = consumeElapsedSinceLastSave();
    if (elapsed >= MIN_OFFLINE_MS) onOfflineProgress(elapsed);
  }

  function renderLoop(t) {
    const dt = t - lastTick;
    lastTick = t;
    onRenderFrame(dt);
    rafHandle = requestAnimationFrame(renderLoop);
  }

  function start({ renderFrame, offlineProgress } = {}) {
    onRenderFrame = renderFrame || onRenderFrame;
    onOfflineProgress = offlineProgress || onOfflineProgress;

    maybeAwardOffline(); // covers a full page reload / reopen

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) saveTimestamp();
      else maybeAwardOffline();
    });

    // Secondary signal: some browsers fire focus/blur more reliably than
    // visibilitychange for window-level (not tab-level) switches. The
    // MIN_OFFLINE_MS gate above keeps this from double-awarding when both
    // fire for the same event.
    window.addEventListener("blur", saveTimestamp);
    window.addEventListener("focus", maybeAwardOffline);
    window.addEventListener("beforeunload", saveTimestamp);

    lastTick = performance.now();
    rafHandle = requestAnimationFrame(renderLoop);
  }

  function stop() {
    if (rafHandle) cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }

  return { start, stop };
})();
