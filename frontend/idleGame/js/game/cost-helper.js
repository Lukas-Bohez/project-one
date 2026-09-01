/**
 * cost-helper.js
 * -----------------------------------------------------------------------
 * Extracts the cost-scaling formula currently duplicated across at
 * least 9 call sites in GameEngine.js (worker hires, police,
 * politicians, banks, markets, universities, sales dept, mining
 * academy, automation lab — lines 1251, 1352, 1370, 1388, 1406, 1424,
 * 1444, 1464, 1486), all of the exact shape:
 *
 *   Math.ceil(baseCost * Math.pow(growthRate, owned) * buildingDiscount)
 *
 * This doesn't change the formula, the rounding, or the discount
 * multiplier (called `bd` at most call sites) — it just gives the 9
 * near-identical blocks one implementation to share instead of nine
 * copies to keep in sync by hand.
 *
 * Written as a plain global function, matching how the rest of this
 * codebase works today (GameEngine, SaveManager, etc. are plain classes
 * loaded via <script src>, not ES modules) — add
 * <script src="js/game/cost-helper.js"> in idlegame.html right before
 * GameEngine.min.js, or fold these two functions directly into the top
 * of GameEngine.js if you'd rather not add another script tag.
 */

function nextCost(baseCost, growthRate, owned, buildingDiscount = 1) {
  return Math.ceil(baseCost * Math.pow(growthRate, owned) * buildingDiscount);
}

/**
 * Total cost for `quantity` more, summing nextCost() at each step (not
 * a closed-form shortcut) so it matches exactly what buying one at a
 * time would cost, Math.ceil rounding included at every step — useful
 * once a "buy 10" control exists. A loop is fine here: quantity will
 * realistically be single or low-double digits, nothing like the
 * "buy max against a huge balance" case that would actually need a
 * closed-form approach instead.
 */
function rangeCost(baseCost, growthRate, owned, quantity, buildingDiscount = 1) {
  let total = 0;
  for (let i = 0; i < quantity; i++) {
    total += nextCost(baseCost, growthRate, owned + i, buildingDiscount);
  }
  return total;
}

// Example — replacing the real call site at GameEngine.js ~line 1406:
//   BEFORE: const marketCost = Math.ceil(1000 * Math.pow(1.15, marketCount) * bd);
//   AFTER:  const marketCost = nextCost(1000, 1.15, marketCount, bd);
//
// And ~line 1352:
//   BEFORE: const policeCost = Math.ceil(5000 * Math.pow(1.25, policeCount) * bd);
//   AFTER:  const policeCost = nextCost(5000, 1.25, policeCount, bd);
//
// Swap the remaining 7 sites (politicians 1370, banks 1388,
// universities 1424, sales dept 1444, mining academy 1464, automation
// lab 1486, worker hire 1251) the same way, one at a time, checking the
// displayed cost against the pre-change value after each swap.
