/**
 * save-system.js
 * -----------------------------------------------------------------------
 * Versioned localStorage save/load with migrations, corruption recovery,
 * portable export/import, and a debounced autosave helper.
 */

const SAVE_KEY = 'idleGame.save';
export const CURRENT_VERSION = 1;

/**
 * Add an entry here every time the save shape changes. Each migration
 * takes the save at version N and returns it upgraded to version N+1.
 * They run in order, so a save from version 1 run against a
 * CURRENT_VERSION of 3 passes through migrations[1] then migrations[2].
 *
 * Example (uncomment and adapt when you actually rename a field):
 *   1: (save) => ({ ...save, gold: save.coins, coins: undefined }),
 */
const migrations = {
  // 1: (save) => save,
};

function runMigrations(save) {
  let current = save;
  let version = save.version ?? 0;
  while (version < CURRENT_VERSION && migrations[version]) {
    current = migrations[version](current);
    version += 1;
  }
  return { ...current, version };
}

export function saveGame(state) {
  const payload = JSON.stringify({ ...state, version: CURRENT_VERSION, savedAt: Date.now() });
  try {
    localStorage.setItem(SAVE_KEY, payload);
    return true;
  } catch (err) {
    // Most likely QuotaExceededError (storage full / private-browsing limits).
    console.error('[save-system] save failed:', err);
    return false;
  }
}

/** Returns the parsed save, or null if there's no valid save to load. */
export function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return runMigrations(parsed);
  } catch (err) {
    // Don't lose the player's data silently — keep the corrupt string
    // around under a timestamped key so it can be inspected/recovered,
    // then let the caller fall back to a fresh game.
    const backupKey = `${SAVE_KEY}.corrupt.${Date.now()}`;
    try {
      localStorage.setItem(backupKey, raw);
    } catch {
      /* best effort — don't let the backup attempt itself throw further */
    }
    console.error(`[save-system] corrupt save, backed up as "${backupKey}":`, err);
    return null;
  }
}

/**
 * Portable string for copy/paste or a downloaded .json — base64-wraps
 * the JSON so it survives being pasted into a plain text box. Uses the
 * encodeURIComponent/unescape dance because raw btoa() throws on any
 * character outside Latin-1 (accented characters, emoji in a
 * player-set name, etc.) — easy to miss until someone with a non-ASCII
 * name hits it.
 */
export function exportSave(state) {
  const json = JSON.stringify({ ...state, version: CURRENT_VERSION, savedAt: Date.now() });
  return btoa(unescape(encodeURIComponent(json)));
}

export function importSave(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded.trim())));
    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
    return { ok: true, save: runMigrations(parsed) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Debounced autosave. Saves on an interval AND on tab-hide, which is far
 * more reliable than beforeunload alone (mobile browsers frequently skip
 * beforeunload on tab close).
 */
export function createAutosave(getState, { intervalMs = 10000 } = {}) {
  let timer = null;

  function flush() {
    saveGame(getState());
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') flush();
  }

  function start() {
    timer = setInterval(flush, intervalMs);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', flush);
  }

  function stop() {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('beforeunload', flush);
  }

  return { start, stop, flush };
}

/** Manual smoke test for the pure (non-localStorage) parts — call from the console. */
export function runSelfTest() {
  const results = [];
  const sample = { coins: 42, name: 'Lukas ✓ äöü' };

  const exported = exportSave(sample);
  const imported = importSave(exported);
  results.push([imported.ok, true]);
  results.push([imported.save.coins, 42]);
  results.push([imported.save.name, 'Lukas ✓ äöü']);

  const badImport = importSave('not-valid-base64!!!');
  results.push([badImport.ok, false]);

  let pass = 0;
  for (const [actual, expected] of results) {
    if (actual === expected) pass++;
    else console.warn(`[save-system] FAIL: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
  console.log(`[save-system] self-test: ${pass}/${results.length} passed`);
  return pass === results.length;
}
