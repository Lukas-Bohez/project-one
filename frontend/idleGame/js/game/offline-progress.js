/**
 * offline-progress.js
 * -----------------------------------------------------------------------
 * Calculates earnings for time elapsed while the game wasn't running
 * (tab closed / app not open) — NOT the same problem as game-loop.js's
 * frame-clamp, which handles a *backgrounded-but-still-open* tab. This
 * file handles the cold "player reopened the game after N hours" case.
 *
 * Assumes a constant income rate while away (true as long as nothing
 * purchases itself automatically offline). If a later feature lets
 * income change while away (e.g. an "auto-buy while offline" prestige
 * perk), this needs to move from a flat multiply to an integral of the
 * rate function over the elapsed time — flagged here so it isn't missed.
 */

export function calculateOfflineProgress({
  lastSeenTimestamp,
  now = Date.now(),
  incomePerSecond,
  capHours = 12,
}) {
  const rawElapsedMs = now - lastSeenTimestamp;

  // Clock rolled backward (system clock changed) or this is the very
  // first session — award nothing rather than a negative/nonsense value.
  if (!Number.isFinite(rawElapsedMs) || rawElapsedMs <= 0) {
    return { earned: 0, elapsedMs: 0, wasCapped: false, awayLabel: null };
  }

  const capMs = capHours * 3600 * 1000;
  const wasCapped = rawElapsedMs > capMs;
  const elapsedMs = wasCapped ? capMs : rawElapsedMs;
  const earned = incomePerSecond * (elapsedMs / 1000);

  return {
    earned,
    elapsedMs,
    wasCapped,
    awayLabel: humanizeDuration(rawElapsedMs),
  };
}

/** "3h 42m" style label for the away duration, uncapped — for UI copy. */
export function humanizeDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return 'less than a minute';
}

export function runSelfTest() {
  const results = [];
  const base = 1_700_000_000_000; // arbitrary fixed "now" for determinism

  // 1 hour away at 10/sec income -> 36000 earned, not capped.
  const oneHour = calculateOfflineProgress({
    lastSeenTimestamp: base - 3600_000,
    now: base,
    incomePerSecond: 10,
    capHours: 12,
  });
  results.push([oneHour.earned, 36000]);
  results.push([oneHour.wasCapped, false]);

  // 30 hours away with a 12h cap -> earnings clamp at 12h worth.
  const capped = calculateOfflineProgress({
    lastSeenTimestamp: base - 30 * 3600_000,
    now: base,
    incomePerSecond: 10,
    capHours: 12,
  });
  results.push([capped.earned, 10 * 12 * 3600]);
  results.push([capped.wasCapped, true]);

  // Clock rollback -> zero, not negative.
  const rollback = calculateOfflineProgress({
    lastSeenTimestamp: base + 1000,
    now: base,
    incomePerSecond: 10,
  });
  results.push([rollback.earned, 0]);

  let pass = 0;
  for (const [actual, expected] of results) {
    if (actual === expected) pass++;
    else console.warn(`[offline-progress] FAIL: got ${actual}, expected ${expected}`);
  }
  console.log(`[offline-progress] self-test: ${pass}/${results.length} passed`);
  return pass === results.length;
}
