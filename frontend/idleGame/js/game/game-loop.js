/**
 * game-loop.js
 * -----------------------------------------------------------------------
 * Fixed-timestep simulation driven by requestAnimationFrame. Keeps game
 * *logic* running at a constant rate (so balances/costs feel the same on
 * a 60Hz and a 144Hz display) while still rendering every frame.
 *
 * This solves a DIFFERENT problem than offline-progress.js: this is
 * about a tab that's open but backgrounded (rAF throttles, then fires
 * with a huge `dt` when the tab regains focus) — offline-progress is
 * about the game having been fully closed. Both matter; don't conflate
 * them.
 */

export function createGameLoop({ update, render, tickRateHz = 20, maxFrameMs = 250 }) {
  const tickMs = 1000 / tickRateHz;
  let accumulator = 0;
  let lastTime = null;
  let rafId = null;
  let running = false;

  function frame(time) {
    if (!running) return;
    if (lastTime === null) lastTime = time;

    // Clamp the per-frame delta. Without this, resuming a backgrounded
    // tab after 10 minutes would try to run ~12,000 ticks in one frame
    // and freeze the page (the "spiral of death"). offline-progress.js
    // is what should account for genuinely long gaps, via the saved
    // timestamp — this clamp just protects the live loop.
    const rawDelta = time - lastTime;
    const delta = Math.min(rawDelta, maxFrameMs);
    lastTime = time;
    accumulator += delta;

    let steps = 0;
    const maxStepsPerFrame = 10; // belt-and-suspenders alongside maxFrameMs
    while (accumulator >= tickMs && steps < maxStepsPerFrame) {
      update(tickMs / 1000); // seconds, so gameplay math reads naturally
      accumulator -= tickMs;
      steps += 1;
    }

    render(accumulator / tickMs); // fractional tick, for interpolation if you want it
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = null;
    accumulator = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  return {
    start,
    stop,
    get isRunning() {
      return running;
    },
  };
}

/**
 * Manual QA checklist (timing logic isn't meaningfully unit-testable
 * without mocking rAF):
 *  - Throttle CPU in DevTools (Performance panel > CPU 6x slowdown) and
 *    confirm currency still increases at the correct rate — just choppier
 *    rendering, not a wrong rate.
 *  - Switch tabs for 30s, switch back, confirm no visible "catch-up burst".
 *  - Add a temporary console.assert(dt <= tickMs/1000) inside `update` and
 *    confirm it never fires during normal play.
 */
