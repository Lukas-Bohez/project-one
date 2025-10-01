# Testing Load Save Functionality

## Steps to Test Load Feature

### 1. Open the Game
- Open the game in your browser: `http://localhost:5500/frontend/idleGame/index.html` (or your server address)
- Open Browser DevTools Console (F12)

### 2. Login
- Click "Login" button
- Enter your credentials (username: your username, password: your password)
- Check console for authentication success

### 3. Test Load
- Click the "Load" button
- **Watch the Console** for these log messages:
  ```
  === APPLYING SAVE DATA ===
  Raw save data: {...}
  Using custom data: {...}
  Restoring resources: {...}
  === SAVE DATA APPLIED SUCCESSFULLY ===
  Final game state: {...}
  Calling updateUI()
  ```

### 4. Verify Data Loaded
After clicking Load, check:
- ✅ Resources displayed (Stone: 103, Gold: 1, etc.)
- ✅ Game time shows 40 seconds
- ✅ UI reflects loaded values
- ✅ Green notification: "📂 Game loaded successfully!"

### 5. Test Save
- Play the game a bit (mine some resources)
- Click "Save" button
- Check console for save success
- Reload page and login again
- Click "Load" - your new progress should appear

## Expected Console Output

### Good Load (with data):
```
Loading save data from server: {game_version: "1.0.0", play_time: 40, ...}
=== APPLYING SAVE DATA ===
Raw save data: {game_version: "1.0.0", ...}
Using custom data: {game_version: "1.0.0", ...}
Restoring resources: {stone: 103, coal: 0, iron: 0, silver: 0, gold: 1}
=== SAVE DATA APPLIED SUCCESSFULLY ===
Final game state: {resources: {stone: 103, gold: 1, ...}, ...}
Calling updateUI()
Load successful - game state restored
```

### No Save (new player):
```
No save file found - starting new game
```

## Troubleshooting

### If Load Button Does Nothing:
1. Check console for errors
2. Verify you're logged in (check localStorage: `localStorage.getItem('game_auth_token')`)
3. Check network tab (F12 → Network) for API calls to `/api/v1/game/save`

### If Resources Don't Show:
1. Check console logs - is `applySaveData` being called?
2. Is `updateUI()` being called?
3. Check the HTML elements exist: inspect element on resource display

### If Save Data Structure is Wrong:
Your old save has this structure:
```json
{
  "game_version": "1.0.0",
  "resources": {"stone": 103, "gold": 1, ...},
  "upgrades": {...},
  "buildings": {},
  "characters": []
}
```

New saves will have:
```json
{
  "game_version": "1.0.0",
  "resources": {...},
  "custom_data": {
    "factory": {...},
    "workers": {...},
    "transport": {...},
    ...
  }
}
```

Both formats are supported! The code handles legacy flat format and new nested format.

## What Changed

### SaveManager.js Changes:
1. **Added detailed logging** in `applySaveData()` to track data restoration
2. **Force UI update** after loading data with `this.gameEngine.updateUI()`
3. **Better structure handling** for both flat and nested save formats
4. **Console debugging** to help diagnose any issues

### Key Points:
- Old saves (flat structure) will load resources but may have empty workers/transport
- This is OKAY! The game will use default values for missing data
- After you save again, the full structure will be saved
- UI now updates immediately after load

## Quick Test Commands

Open browser console and try:
```javascript
// Check if authenticated
localStorage.getItem('game_auth_token')

// Check game state
gameEngine.state.resources

// Force save
saveManager.saveGame()

// Force load  
saveManager.loadGame()
```

## Success Criteria
✅ Click Load → Console shows detailed logs  
✅ Resources display updated values (Stone: 103, Gold: 1)  
✅ No JavaScript errors in console  
✅ Green success notification appears  
✅ Game time shows 40 (from your save)
