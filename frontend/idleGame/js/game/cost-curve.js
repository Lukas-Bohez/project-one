/**
 * cost-curve.js
 * -----------------------------------------------------------------------
 * Pure math for exponential upgrade-cost scaling. No DOM, no state —
 * safe to unit test and reuse for any purchasable (buildings, upgrades,
 * managers...).
 *
 * Standard idle-game cost model:
 *   cost(n) = baseCost * growthRate ^ n
 * where n = number of this item already owned.
 */

/** Cost of the (owned+1)-th item. */
export function costForNext(baseCost, growthRate, owned) {
  return baseCost * Math.pow(growthRate, owned);
}

/**
 * Total cost to go from `owned` to `owned + quantity`, using the
 * closed-form geometric series sum instead of looping — matters once
 * "buy 100" or "buy max" is on the table.
 *
 *   sum_{i=0}^{quantity-1} baseCost * growthRate^(owned+i)
 *     = baseCost * growthRate^owned * (growthRate^quantity - 1) / (growthRate - 1)
 */
export function costForRange(baseCost, growthRate, owned, quantity) {
  if (quantity <= 0) return 0;
  if (growthRate === 1) return baseCost * quantity;
  const c = baseCost * Math.pow(growthRate, owned);
  return (c * (Math.pow(growthRate, quantity) - 1)) / (growthRate - 1);
}

/**
 * Max quantity affordable with `balance`, given `owned` already
 * purchased. Inverts the geometric series in O(1) via logarithms instead
 * of looping balance/cost times — matters once balances hit the
 * trillions.
 *
 * Derivation:
 *   balance >= C * (r^k - 1) / (r - 1),  where C = baseCost * r^owned
 *   => k <= log_r( 1 + balance*(r-1)/C )
 */
export function maxAffordable(baseCost, growthRate, owned, balance) {
  if (balance <= 0) return 0;
  const c = baseCost * Math.pow(growthRate, owned);
  if (growthRate === 1) return Math.floor(balance / baseCost);

  const raw = Math.log(1 + (balance * (growthRate - 1)) / c) / Math.log(growthRate);
  let k = Math.max(0, Math.floor(raw));

  // log()/pow() float error can land k off-by-one at the boundary —
  // nudge it back onto the true affordability line either direction.
  while (k > 0 && costForRange(baseCost, growthRate, owned, k) > balance) k--;
  while (costForRange(baseCost, growthRate, owned, k + 1) <= balance) k++;

  return k;
}

export function runSelfTest() {
  const results = [];

  // 10 base cost, 1.15 growth, nothing owned yet -> first item costs 10.
  results.push([costForNext(10, 1.15, 0), 10]);

  // Buying items 0..2 (3 items) should equal the sum of the individual costs.
  const sumCheck =
    costForNext(10, 1.15, 0) + costForNext(10, 1.15, 1) + costForNext(10, 1.15, 2);
  results.push([Math.abs(costForRange(10, 1.15, 0, 3) - sumCheck) < 1e-6, true]);

  // maxAffordable should never let costForRange exceed balance, and k+1 should.
  const bal = 10000;
  const k = maxAffordable(10, 1.15, 0, bal);
  results.push([costForRange(10, 1.15, 0, k) <= bal, true]);
  results.push([costForRange(10, 1.15, 0, k + 1) > bal, true]);

  let pass = 0;
  for (const [actual, expected] of results) {
    const ok =
      typeof expected === 'number' ? Math.abs(actual - expected) < 1e-6 : actual === expected;
    if (ok) pass++;
    else console.warn(`[cost-curve] FAIL: got ${actual}, expected ${expected}`);
  }
  console.log(`[cost-curve] self-test: ${pass}/${results.length} passed`);
  return pass === results.length;
}
