/**
 * big-number.js
 * -----------------------------------------------------------------------
 * Formatting and safe helpers for large idle-game currency values.
 *
 * DESIGN NOTE — why this stays a plain JS `number` instead of a
 * mantissa/exponent BigNumber type (like break_infinity.js):
 *
 * Float64 gives ~15-17 significant decimal digits and a max finite value
 * of ~1.7976931348623157e+308. An idle game only ever *displays* 3-5
 * significant figures ("1.23M"), so precision loss above
 * Number.MAX_SAFE_INTEGER (2^53, ~9.007e15) is invisible to the player —
 * it would only matter if you needed an *exact* integer (a click
 * counter, an achievement count). Keep those as their own small
 * integers, separate from the main currency float, and this formatter
 * comfortably covers a currency curve all the way to float64's max.
 *
 * If a later prestige layer is explicitly designed to blow past ~1e33
 * with named units, extend SUFFIXES or switch the internals to a
 * mantissa/exponent pair — call sites that just do `format(value)` won't
 * need to change either way.
 */

// K through Dc (decillion, 1e33) — the standard short-scale names I'm
// confident are right. Past that, this falls back to scientific
// notation rather than guessing at less-common Latin numeral prefixes.
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
const LOG10_1000 = Math.log10(1000);

/**
 * Format a number for display.
 * @param {number} value
 * @param {{notation?: 'suffix'|'scientific', precision?: number}} [opts]
 */
export function format(value, opts = {}) {
  const { notation = 'suffix', precision = 2 } = opts;

  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs < 1000) {
    return sign + (Number.isInteger(abs) ? abs.toString() : abs.toFixed(precision));
  }

  if (notation === 'scientific') {
    return sign + abs.toExponential(precision).replace('e+', 'e');
  }

  let tier = Math.min(Math.floor(Math.log10(abs) / LOG10_1000), SUFFIXES.length - 1);
  let scaled = abs / Math.pow(1000, tier);

  // Rounding at `precision` digits can push e.g. 999.999K up to display
  // as "1000.00K" — check the ROUNDED value, not the raw one, and roll
  // over to the next tier so it reads "1.00M" instead.
  if (Number(scaled.toFixed(precision)) >= 1000 && tier < SUFFIXES.length - 1) {
    tier += 1;
    scaled = abs / Math.pow(1000, tier);
  }

  if (tier >= SUFFIXES.length - 1 && Number(scaled.toFixed(precision)) >= 1000) {
    // Past the last named suffix — fall back to scientific rather than
    // inventing more suffix names.
    return sign + abs.toExponential(precision).replace('e+', 'e');
  }

  return sign + scaled.toFixed(precision) + SUFFIXES[tier];
}

/** Order of magnitude — handy for "unlock this at 1e6" style gates. */
export function orderOfMagnitude(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(Math.log10(value));
}

export function canAfford(balance, cost) {
  return Number.isFinite(balance) && balance >= cost;
}

/** Manual smoke test — call `runSelfTest()` from the devtools console. */
export function runSelfTest() {
  const results = [
    [format(0), '0'],
    [format(999), '999'],
    [format(1000), '1.00K'],
    [format(1_500_000), '1.50M'],
    [format(-2500), '-2.50K'],
    [format(1e15), '1.00Qa'],
    [format(999_999), '1.00M'], // precision-rollover edge case
  ];
  let pass = 0;
  for (const [actual, expected] of results) {
    if (actual === expected) pass++;
    else console.warn(`[big-number] FAIL: got "${actual}", expected "${expected}"`);
  }
  console.log(`[big-number] self-test: ${pass}/${results.length} passed`);
  return pass === results.length;
}
