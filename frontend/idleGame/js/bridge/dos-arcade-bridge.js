/**
 * dos-arcade-bridge.js
 *
 * Generic event bus between WASM-recompiled DOS games (doomgeneric, digger,
 * SDLPoP, omnispeak) and Industrial Empire's resource/workforce state.
 *
 * A DOS game never touches Industrial Empire directly. It only knows about
 * `window.dosGameBridge.emit(eventName, payload)`. This file is the only
 * place that knows how the two sides actually connect — see
 * masterprompt_idle_dos_arcade_bridge.md and idle_dos_arcade_technical_reference.md
 * for the full plan this implements.
 *
 * Include this BEFORE the Retro Arcade section's own script in idlegame.html.
 */

class DosGameBridge {
  constructor() {
    this._listeners = {};
    this._lastFiredAt = {};

    // Minimum ms between two COUNTED firings of the same event type.
    // Conservative starting points — tune by feel, or replace with the
    // hourly-value-cap approach described in the masterprompt §6 once you
    // have real playtesting data across all four games.
    this.cooldownsMs = {
      'doom:kill': 200,
      'doom:level:complete': 2000,
      'digger:collect:emerald': 150,
      'digger:collect:gold': 200,
      'digger:kill': 250,
      'digger:level:complete': 2000,
      'pop:mine:tick': 500,
      'pop:pickup:gold': 200,
      'pop:pickup:potion': 300,
      'pop:level:complete': 2000,
      'keen:collect:item': 200,
      'keen:enemy:defeated': 400,
      'keen:level:complete': 2000,
      default: 100,
    };

    // TODO(balance): combined hourly cap on total DOS-sourced economic value
    // ACROSS all four games, not just per-game — four separate per-game caps
    // can still add up to too much in aggregate. Needs real playtesting
    // numbers from you — see masterprompt §6.

    this._sessionLog = []; // for the "connected" UI indicator (Phase 3/5/7/9)
  }

  on(eventType, handler) {
    (this._listeners[eventType] = this._listeners[eventType] || []).push(handler);
  }

  off(eventType, handler) {
    const list = this._listeners[eventType];
    if (!list) return;
    const i = list.indexOf(handler);
    if (i !== -1) list.splice(i, 1);
  }

  /**
   * Called by the WASM game hooks. Returns true if the event was actually
   * counted, false if it was dropped by the rate limiter — useful in the
   * test harness to make the limiter's behavior visible.
   */
  emit(eventType, payload = {}) {
    const now = Date.now();
    const cooldown = this.cooldownsMs[eventType] ?? this.cooldownsMs.default;
    const last = this._lastFiredAt[eventType] || 0;

    if (now - last < cooldown) {
      return false;
    }
    this._lastFiredAt[eventType] = now;
    this._sessionLog.push({ eventType, payload, at: now });

    (this._listeners[eventType] || []).forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('[DosGameBridge] handler error for', eventType, err);
      }
    });
    return true;
  }

  /** For the "connected" indicator — events fired this session. */
  getSessionSummary() {
    const counts = {};
    for (const { eventType } of this._sessionLog) {
      counts[eventType] = (counts[eventType] || 0) + 1;
    }
    return counts;
  }
}

window.dosGameBridge = window.dosGameBridge || new DosGameBridge();

// ---------------------------------------------------------------------------
// Small shared helper: grant one resource picked at random from a list, so a
// long session digging/exploring doesn't lopsidedly dump everything into a
// single resource. Used by Digger and Prince of Persia's "tick" events.
// ---------------------------------------------------------------------------
function addRandomResource(resourceList, amount = 1) {
  const pick = resourceList[Math.floor(Math.random() * resourceList.length)];
  window.IndustrialEmpire?.addResource?.(pick, amount);
}

// ---------------------------------------------------------------------------
// DOOM — monster-tier lookup.
//
// DO NOT trust this table until you've built it yourself — see masterprompt
// Phase 1 step 3. Kill a handful of different monster types in your patched
// build, log the `monsterTypeId` each emits, and fill this in from what you
// actually observe. The keys below are illustrative placeholders, not real
// mobjtype_t values.
// ---------------------------------------------------------------------------
const DOOM_KILL_TIER_MAP = {
  // 3: 'tier1',   // example shape — replace with real observed ids
  // 9: 'tier2',
  // 16: 'tier3',
  // 20: 'tier4',
};

function doomTierFor(monsterTypeId) {
  return DOOM_KILL_TIER_MAP[monsterTypeId] || 'tier1';
}

// ---------------------------------------------------------------------------
// Event → Industrial Empire effect wiring, one block per game.
//
// Every `window.IndustrialEmpire?.___?.()` call is a placeholder — that
// object almost certainly doesn't exist yet. Replace each with the real
// function found in idlegame.html during masterprompt Step 0. The optional
// chaining just means this file won't throw before that wiring is done.
// ---------------------------------------------------------------------------

// --- DOOM ---
window.dosGameBridge.on('doom:kill', (payload) => {
  switch (doomTierFor(payload.monsterTypeId)) {
    case 'tier1':
      window.IndustrialEmpire?.hireWorker?.('juniorDev', 1);
      break;
    case 'tier2':
      window.IndustrialEmpire?.hireWorker?.('devOpsEngineer', 1);
      break;
    case 'tier3':
      window.IndustrialEmpire?.hireWorker?.('growthHacker', 1);
      break;
    case 'tier4':
      window.IndustrialEmpire?.addResource?.('ventureCapital', 50);
      break;
  }
});

window.dosGameBridge.on('doom:level:complete', (payload) => {
  window.IndustrialEmpire?.addResource?.('gold', 20 * (payload.levelNumber || 1));
});

// --- Digger ---
window.dosGameBridge.on('digger:collect:emerald', () => {
  addRandomResource(['stone', 'coal'], 1);
});

window.dosGameBridge.on('digger:collect:gold', () => {
  window.IndustrialEmpire?.addResource?.('gold', 1);
});

window.dosGameBridge.on('digger:kill', () => {
  // Digger's monsters (nobbins/hobbins) are fodder-tier by nature of the
  // game — one tier only, unlike Doom's four.
  window.IndustrialEmpire?.hireWorker?.('juniorDev', 1);
});

window.dosGameBridge.on('digger:level:complete', (payload) => {
  window.IndustrialEmpire?.addResource?.('gold', 20 * (payload.levelNumber || 1));
});

// --- Prince of Persia ---
window.dosGameBridge.on('pop:mine:tick', () => {
  addRandomResource(['stone', 'coal', 'iron'], 1);
});

window.dosGameBridge.on('pop:pickup:gold', (payload) => {
  window.IndustrialEmpire?.addResource?.('gold', payload.amount || 5);
});

window.dosGameBridge.on('pop:pickup:potion', () => {
  window.IndustrialEmpire?.addResource?.('silver', 1);
});

window.dosGameBridge.on('pop:level:complete', (payload) => {
  window.IndustrialEmpire?.addResource?.('gold', 20 * (payload.levelNumber || 1));
});

// --- Commander Keen ---
window.dosGameBridge.on('keen:collect:item', () => {
  addRandomResource(['stone', 'iron'], 1);
});

window.dosGameBridge.on('keen:enemy:defeated', () => {
  window.IndustrialEmpire?.hireWorker?.('juniorDev', 1);
});

window.dosGameBridge.on('keen:level:complete', (payload) => {
  window.IndustrialEmpire?.addResource?.('gold', 20 * (payload.levelNumber || 1));
});
