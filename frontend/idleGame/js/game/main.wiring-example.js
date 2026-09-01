/**
 * main.wiring-example.js
 * -----------------------------------------------------------------------
 * Illustrates how the other reference/ modules compose. This is NOT meant
 * to be dropped in verbatim — your actual state shape and render()
 * functions are project-specific — but the wiring order and the
 * responsibility each piece owns should carry over directly.
 */

import { saveGame, loadGame, createAutosave } from './save-system.js';
import { calculateOfflineProgress } from './offline-progress.js';
import { createGameLoop } from './game-loop.js';
import { maxAffordable, costForRange } from './cost-curve.js';

function createInitialState() {
  return {
    coins: 0,
    incomePerSecond: 0,
    owned: {}, // { [upgradeId]: countOwned }
    lastSeenTimestamp: Date.now(),
  };
}

// 1. Load or create state.
const saved = loadGame();
const state = saved ?? createInitialState();

// 2. Resolve offline progress BEFORE the live loop starts, using the
//    timestamp from the save (not "now") as lastSeenTimestamp.
if (saved) {
  const offline = calculateOfflineProgress({
    lastSeenTimestamp: saved.lastSeenTimestamp,
    incomePerSecond: state.incomePerSecond,
    capHours: 12,
  });
  if (offline.earned > 0) {
    state.coins += offline.earned;
    showWelcomeBackModal(offline); // project-specific UI function — not defined here
  }
}

// 3. Wire the fixed-timestep loop: `update` mutates state, `render` only reads it.
const loop = createGameLoop({
  update(dtSeconds) {
    state.coins += state.incomePerSecond * dtSeconds;
  },
  render() {
    renderHud(state); // project-specific UI function — not defined here
    renderUpgradeList(state); // project-specific UI function — not defined here
  },
  tickRateHz: 20,
});

// 4. Autosave: interval + tab-hide, always stamping lastSeenTimestamp
//    right before writing.
const autosave = createAutosave(() => ({ ...state, lastSeenTimestamp: Date.now() }), {
  intervalMs: 10000,
});

loop.start();
autosave.start();

// 5. A buy handler showing cost-curve tied to state mutation.
function buyUpgrade(upgradeDef, quantityRequested) {
  const owned = state.owned[upgradeDef.id] ?? 0;
  const affordable = maxAffordable(upgradeDef.baseCost, upgradeDef.costGrowth, owned, state.coins);
  const quantity = quantityRequested === 'max' ? affordable : Math.min(quantityRequested, affordable);

  if (quantity <= 0) return false;

  const cost = costForRange(upgradeDef.baseCost, upgradeDef.costGrowth, owned, quantity);
  state.coins -= cost;
  state.owned[upgradeDef.id] = owned + quantity;
  state.incomePerSecond += upgradeDef.effectValue * quantity;
  return true;
}

// Elsewhere in the UI layer, format a button label with big-number.js, e.g.:
//   import { format } from './big-number.js';
//   buyButton.textContent = `Buy — ${format(costForRange(baseCost, growth, owned, qty))}`;
