# game-loop.patch-notes.md

## What's there now (confirmed, `js/game/GameEngine.js` around line 300–330)

```js
this.tickRate = 60; // set in the constructor
...
this.tickInterval = setInterval(() => {
  this.tick();
}, 1000 / this.tickRate);
```

And `tick()` itself already computes a real elapsed-time delta and
passes it into the update functions:

```js
tick() {
  const now = Date.now();
  const deltaTime = (now - this.lastUpdate) / 1000;
  this.lastUpdate = now;
  this.state.gameTime += deltaTime;

  this.updateResources(deltaTime);
  this.updateMarkets(deltaTime);
  this.updateUpgrades(deltaTime);
  this.updateAdCooldowns();
  this.updateAutoSellFinished(now);
  // ...more after this — a "Random events & achievements" comment
  // appears here but I didn't read the rest of the method body.
}
```

This is actually a good position to refactor from: `deltaTime` is
already computed and threaded through, so this isn't "add a delta-time
system from scratch," it's "swap what drives the interval." **Don't
rewrite the body of `tick()`** — everything below only touches
`start()`/`stop()`.

## The problem

`setInterval` at ~16.67ms doesn't pause when the tab is backgrounded the
way `requestAnimationFrame` does, drifts against the actual display
refresh, and — more importantly — there's no clamp on `deltaTime`
anywhere visible in what was read. If the tab is backgrounded long
enough for the browser to throttle/suspend timers and then resume, the
next `tick()` could fire with a large `deltaTime` in one shot. Whether
that actually causes a visible glitch depends on what the unseen rest
of `tick()` does with it — worth a quick manual test (throttle CPU,
switch tabs for a minute, switch back) before deciding this is even
worth fixing.

## The change (only touches `start()` / `stop()`)

```js
// BEFORE
start() {
  // ...
  this.tickInterval = setInterval(() => {
    this.tick();
  }, 1000 / this.tickRate);
  // ...
}

stop() {
  if (!this.isRunning) return;
  this.isRunning = false;
  if (this.tickInterval) {
    clearInterval(this.tickInterval);
    this.tickInterval = null;
  }
}
```

```js
// AFTER
start() {
  // ...
  this._rafId = requestAnimationFrame(this._rafLoop.bind(this));
  // ...
}

_rafLoop(time) {
  if (!this.isRunning) return;
  // tick() already reads real elapsed time itself (Date.now() -
  // this.lastUpdate), so just call it every frame instead of on a
  // setInterval cadence — no separate accumulator needed, since tick()
  // doesn't assume a fixed dt per call.
  this.tick();
  this._rafId = requestAnimationFrame(this._rafLoop.bind(this));
}

stop() {
  if (!this.isRunning) return;
  this.isRunning = false;
  if (this._rafId) {
    cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }
}
```

This is a smaller change than set 1's original `game-loop.js` proposed
— that version assumed a fixed-timestep accumulator was needed because
it assumed a naive tick with no delta-time handling. The real `tick()`
already handles variable `deltaTime` correctly, so the fix here is just
"drive it from `requestAnimationFrame` instead of `setInterval`," not
"add an accumulator on top of what's already there." If `deltaTime`
spikes turn out to actually cause visible issues in the unseen part of
`tick()`, add a single clamp line at the top of `tick()` itself:

```js
const deltaTime = Math.min((now - this.lastUpdate) / 1000, 0.25); // cap at 250ms
```

## Definition of done

- Game runs at a comparable pace to before (rAF on a 60Hz-capable
  display should feel equivalent to the old ~60/sec setInterval)
- Switching tabs for 30s and returning doesn't cause a visible resource
  jump beyond what 30s of normal play would have earned
- `this.tickRate` becomes unused after this change — either remove it
  or repurpose it as a documented target, since rAF doesn't take a rate
  parameter the way `setInterval` did
