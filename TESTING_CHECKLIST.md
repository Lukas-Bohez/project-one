# 🧪 Game Bug Fix Testing Checklist

## Pre-Test Setup
- [ ] Clear browser cache (Ctrl+Shift+Delete)
- [ ] Open browser console (F12)
- [ ] Navigate to game URL
- [ ] Start fresh game or reset existing save

---

## Test 1: Coal Miner Unlock Requirements ⛏️

### Expected Behavior:
Coal miners should NOT be available until coal is unlocked.

### Steps:
1. **Start Game** - Check initial state
   - [ ] Stone miner button is **ENABLED**
   - [ ] Coal miner button is **DISABLED** (greyed out)
   - [ ] Hover over coal miner - button should not respond

2. **Mine Stone & Earn Gold**
   - [ ] Click "Mine Stone" 10+ times
   - [ ] Sell stone to earn ~1 gold
   - [ ] Repeat until you have 25+ gold

3. **Try to Hire Coal Miner (Before Unlock)**
   - [ ] Click coal miner button (should be disabled)
   - [ ] Button does nothing - no gold spent

4. **Unlock Coal**
   - [ ] Open **Research** tab
   - [ ] Click "Unlock Coal" button (costs 25 gold)
   - [ ] Notification: "Unlocked feature: unlock_coal"
   - [ ] Console log: "Unlocked feature: unlock_coal"

5. **Return to Workers Tab**
   - [ ] Coal miner button now **ENABLED**
   - [ ] Click "Hire Coal Miner" (costs 25 gold)
   - [ ] Success! Coal miner hired
   - [ ] Coal starts accumulating (check resource counter)

### Console Output:
```
✅ Expected:
"Unlocked feature: unlock_coal"
"Hired coalMiner for 25 gold"
```

---

## Test 2: Iron Miner Unlock Requirements 🔨

### Steps:
1. **Earn 100 Gold**
   - [ ] Continue mining and selling resources
   - [ ] Accumulate 100+ gold

2. **Check Iron Miner Button**
   - [ ] Iron miner button is **DISABLED**
   - [ ] Cannot hire iron miner yet

3. **Unlock Iron** (60 gold in Research tab)
   - [ ] Click "Unlock Iron" button
   - [ ] Console: "Unlocked feature: unlock_iron"

4. **Hire Iron Miner**
   - [ ] Iron miner button now **ENABLED**
   - [ ] Successfully hire iron miner (100 gold)
   - [ ] Iron resource starts accumulating

---

## Test 3: Silver Miner Unlock Requirements 💎

### Steps:
1. **Earn 500+ Gold**
   - [ ] Build processing chains (smelters, forges, etc.)
   - [ ] Accumulate 500+ gold

2. **Check Silver Miner Button**
   - [ ] Silver miner button is **DISABLED**

3. **Unlock Silver** (200 gold in Research tab)
   - [ ] Click "Unlock Silver" button
   - [ ] Console: "Unlocked feature: unlock_silver"

4. **Hire Silver Miner**
   - [ ] Silver miner button now **ENABLED**
   - [ ] Successfully hire silver miner (500 gold)
   - [ ] Silver resource starts accumulating

---

## Test 4: Rebirth Requirements 🔄

### Expected Behavior:
Cannot rebirth until city decay reaches exactly 100%.

### Steps:
1. **Play Until Decay Accumulates**
   - [ ] Build city infrastructure (police, banks, markets)
   - [ ] Let game run to accumulate decay
   - [ ] Watch decay counter in City Status panel

2. **Check Rebirth Button at 50% Decay**
   - [ ] Decay = 50/100
   - [ ] Rebirth button is **DISABLED**
   - [ ] Click rebirth button → Nothing happens

3. **Check Rebirth Button at 99% Decay**
   - [ ] Decay = 99/100
   - [ ] Rebirth button is **DISABLED**
   - [ ] Click rebirth button → Notification: "City must reach 100% decay before rebirth!"

4. **Wait for 100% Decay**
   - [ ] Decay = 100/100
   - [ ] Rebirth button now **ENABLED** ✅

5. **Execute Rebirth**
   - [ ] Click "Rebirth City" button
   - [ ] Notification: "City reborn! Efficiency bonuses applied. Rebirth #1"
   - [ ] Console: "City rebirth completed! Total rebirths: 1"
   - [ ] Game resets to starting state
   - [ ] Resources reset to initial values
   - [ ] Workers reset to 0
   - [ ] Efficiency bonuses retained (check stats)

### Console Output:
```
✅ Before 100%:
"Cannot rebirth: decay is 99/100"

✅ At 100%:
"City rebirth completed! Total rebirths: 1"
```

---

## Test 5: Unlock Progression Sequence 📈

### Expected Order:
Stone (free) → Coal (25g) → Iron (60g) → Silver (200g)

### Steps:
1. **Fresh Game Start**
   - [ ] Only stone miner available
   - [ ] All other miners disabled

2. **Unlock Coal First**
   - [ ] Earn 25 gold
   - [ ] Unlock coal
   - [ ] Coal miner available

3. **Try to Skip Iron** (if possible)
   - [ ] Earn 200 gold
   - [ ] Try to unlock silver
   - [ ] Silver unlocks (not dependent on iron)
   - [ ] But silver miner should be expensive to hire

4. **Verify All Unlocks Work**
   - [ ] Unlock processing (80g)
   - [ ] Unlock oil (150g)
   - [ ] Unlock electronics (800g)
   - [ ] Each unlock enables related buildings/features

---

## Test 6: Error Handling 🚨

### Test Invalid Actions:

1. **Click Locked Worker Button**
   - [ ] Click disabled coal miner button (before unlock)
   - [ ] Notification: "Unlock the resource first!"
   - [ ] Console: "Cannot hire coalMiner: resource not unlocked yet"

2. **Try to Rebirth Early**
   - [ ] Decay = 50/100
   - [ ] Click rebirth button (disabled)
   - [ ] Notification: "City must reach 100% decay before rebirth!"
   - [ ] Console: "Cannot rebirth: decay is 50/100"

3. **Insufficient Gold**
   - [ ] Have 10 gold
   - [ ] Try to unlock coal (25g cost)
   - [ ] Button disabled, nothing happens

---

## Test 7: Save/Load Persistence 💾

### Test Unlocks Persist:

1. **Unlock Coal and Iron**
   - [ ] Unlock coal
   - [ ] Unlock iron
   - [ ] Hire 2 coal miners

2. **Save Game**
   - [ ] Click "Save" button
   - [ ] Notification: "Game saved successfully"

3. **Reload Page**
   - [ ] Refresh browser (F5)
   - [ ] Login with same user

4. **Load Game**
   - [ ] Click "Load" button
   - [ ] Check unlock states:
     - [ ] Coal still unlocked
     - [ ] Iron still unlocked
     - [ ] 2 coal miners present
     - [ ] Coal miner button **ENABLED**
     - [ ] Iron miner button **ENABLED**
     - [ ] Silver miner button **DISABLED** (not unlocked)

---

## Test 8: UI State Consistency 🎨

### Check Button States:

1. **With 0 Gold**
   - [ ] All purchase buttons disabled (insufficient funds)
   - [ ] Locked miners also show lock icon/tooltip

2. **With 25 Gold (no coal unlock)**
   - [ ] Stone miner: **ENABLED**
   - [ ] Coal miner: **DISABLED** (locked)
   - [ ] Coal unlock button: **ENABLED**

3. **With 25 Gold + Coal Unlocked**
   - [ ] Stone miner: **ENABLED**
   - [ ] Coal miner: **ENABLED** ✅
   - [ ] Both can be purchased

4. **After Rebirth**
   - [ ] All miners reset to 0
   - [ ] Unlocks should be retained (or reset based on design)
   - [ ] Button states correct for post-rebirth state

---

## Test 9: Edge Cases 🔍

### Test Unusual Scenarios:

1. **Unlock Multiple Resources Quickly**
   - [ ] Earn 300 gold
   - [ ] Unlock coal, iron, silver in rapid succession
   - [ ] All miners become available
   - [ ] No race conditions or state issues

2. **Hire Workers Without Unlocks** (Manual Console Test)
   - Open console: `gameEngine.hireWorker('coalMiner')`
   - [ ] Should return `false`
   - [ ] Console: "Cannot hire coalMiner: resource not unlocked yet"
   - [ ] Gold not spent

3. **Force Rebirth Without Decay** (Manual Console Test)
   - Set decay to 50: `gameEngine.state.city.decay = 50`
   - Try rebirth: `gameEngine.rebirth()`
   - [ ] Should return `false`
   - [ ] Console: "Cannot rebirth: decay is 50/100"

4. **Negative Gold Prevention**
   - [ ] Have 10 gold
   - [ ] Try to hire stone miner (5g) twice
   - [ ] First hire: Success (5g remaining)
   - [ ] Second hire: Success (0g remaining)
   - [ ] Third hire: Fails (button disabled)
   - [ ] Gold never goes negative

---

## Expected Results Summary ✅

### Working Features:
- ✅ Stone miner always available
- ✅ Coal miner locked until coal unlocked
- ✅ Iron miner locked until iron unlocked
- ✅ Silver miner locked until silver unlocked
- ✅ Rebirth locked until 100% decay
- ✅ Buttons properly enabled/disabled
- ✅ Notifications show for invalid actions
- ✅ Console logs provide debug info
- ✅ Save/load preserves unlock state
- ✅ No negative resources
- ✅ No undefined errors

### Console Logs to Watch For:
```javascript
// Good logs:
"Unlocked feature: unlock_coal"
"Hired coalMiner for 25 gold"
"City rebirth completed! Total rebirths: 1"

// Expected error logs:
"Cannot hire coalMiner: resource not unlocked yet"
"Cannot rebirth: decay is 50/100"
```

---

## Bug Reporting Template 🐛

If you find issues, report with:

```markdown
**Bug**: [Short description]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected**: [What should happen]

**Actual**: [What actually happened]

**Console Errors**: [Any error messages]

**Browser**: [Chrome/Firefox/Safari + version]

**Screenshot**: [If applicable]
```

---

## Developer Testing Commands 🛠️

Open browser console and test functions directly:

```javascript
// Check unlock states
console.log(gameEngine.state.unlock_coal);
console.log(gameEngine.state.unlock_iron);
console.log(gameEngine.state.unlock_silver);

// Check workers
console.log(gameEngine.state.workers);

// Check decay
console.log(gameEngine.state.city.decay, '/', gameEngine.state.city.maxDecay);

// Force unlock (for testing)
gameEngine.state.unlock_coal = true;
gameEngine.updateUI();

// Force decay (for testing)
gameEngine.state.city.decay = 100;
gameEngine.updateUI();

// Test functions directly
gameEngine.hireWorker('coalMiner');  // Should fail if not unlocked
gameEngine.rebirth();  // Should fail if decay < 100
```

---

## Status: 🎮 READY FOR TESTING

All fixes implemented! Follow this checklist to verify everything works correctly.

**Test Priority**:
1. 🔴 High: Test 1, 3, 4 (Core unlock + rebirth mechanics)
2. 🟡 Medium: Test 5, 7 (Progression + persistence)
3. 🟢 Low: Test 8, 9 (UI consistency + edge cases)

**Estimated Testing Time**: 15-30 minutes for complete walkthrough
