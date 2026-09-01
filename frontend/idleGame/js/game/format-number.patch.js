/**
 * format-number.patch.js
 * -----------------------------------------------------------------------
 * Drop-in replacement for GameEngine.js's formatNumber() (currently
 * around line 4165). Same signature, same call sites (~15 places calling
 * this.formatNumber(...) — resource amounts, costs, floating
 * combat-text style popups) — this is a surgical fix, not a module
 * extraction, so it can be pasted in place of the existing method body
 * with nothing else in the file changing.
 *
 * Confirmed bugs in the current implementation:
 *   1. Nothing past 1 trillion: values >= 1e12 are still divided by
 *      1e12 and suffixed "T" forever (5e15 renders "5000.0T" instead of
 *      scaling further).
 *   2. Rounding rollover: 999,951 divides to 999.951, .toFixed(1) rounds
 *      that display value UP to "1000.0", so it renders "1000.0K"
 *      instead of rolling over to "1.0M". Reproduce today by setting
 *      this.state.resources.gold = 999951 and watching the HUD.
 *
 * Paste this in place of the existing method body inside the GameEngine
 * class — don't change the method name or signature, and every existing
 * caller keeps working unchanged.
 */
formatNumber(num) {
  if (num == null || Number.isNaN(num)) return '0';
  if (!Number.isFinite(num)) return num > 0 ? '∞' : '-∞';

  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);

  if (abs < 1000) return sign + Math.floor(abs).toString();

  // Same K/M/B/T tiers as before, extended with Qa/Qi/Sx/Sp/Oc/No/Dc
  // (standard short-scale names) instead of stopping dead at T.
  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  let tier = Math.min(Math.floor(Math.log10(abs) / 3), SUFFIXES.length - 1);
  let scaled = abs / Math.pow(1000, tier);

  // Fixes bug #2: check the ROUNDED value against 1000, not the raw
  // one — 999.951 rounds to "1000.0" at one decimal, so bump the tier
  // before that happens rather than after.
  if (Number(scaled.toFixed(1)) >= 1000 && tier < SUFFIXES.length - 1) {
    tier += 1;
    scaled = abs / Math.pow(1000, tier);
  }

  return sign + scaled.toFixed(1) + SUFFIXES[tier];
}

// Quick manual check after pasting this in (paste into the browser
// console with a live gameEngine instance):
//   window.app.gameEngine.formatNumber(999951)   -> "1.0M"  (was "1000.0K")
//   window.app.gameEngine.formatNumber(1500000)  -> "1.5M"  (unchanged)
//   window.app.gameEngine.formatNumber(5e15)     -> "5.0Qa" (was "5000.0T")
//   window.app.gameEngine.formatNumber(500)      -> "500"   (unchanged)
