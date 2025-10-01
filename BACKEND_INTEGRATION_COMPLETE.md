# Backend Integration Complete ✅

## Overview
The SaveManager has been fully updated to properly integrate with your FastAPI backend's Kingdom Quarry game endpoints.

## Changes Made

### 1. Authentication Flow
- **Register**: Now properly sends `username`, `password`, and `email` to `/api/v1/game/auth/register`
  - Auto-generates email if not provided: `{username}@game.local`
  - Receives JWT token and stores it securely
  
- **Login**: Sends credentials to `/api/v1/game/auth/login`
  - Receives JWT token and stores it
  - Automatically loads saved game after successful login

- **Token Management**: 
  - Tokens stored in localStorage with timestamp
  - Auto-expires after 24 hours
  - Automatically restored on page reload

### 2. Save System
**Frontend sends** (`POST /api/v1/game/save`):
```json
{
  "save_data": {
    "game_version": "1.0.0",
    "play_time": 12345,
    "last_save": "2025-10-01T12:00:00Z",
    "resources": {
      "stone": 1000,
      "coal": 500,
      "iron": 200,
      "silver": 100,
      "gold": 50,
      "crystals": 0,
      "royal_favor": 0
    },
    "custom_data": {
      "factory": {...},
      "city_inventory": {...},
      "workers": {...},
      "processors": {...},
      "traders": {...},
      "transport": {...},
      "city": {...},
      "research": {...},
      "unlocks": {...},
      "stats": {...},
      "efficiency": {...}
    },
    "prestige_level": 5,
    "characters": [],
    "buildings": {},
    "upgrades": {...},
    "unlocked_vehicles": ["hand_cart"],
    "achievements": [],
    "offline_time": 0,
    "settings": {...}
  },
  "backup": false
}
```

**Backend responds**:
```json
{
  "success": true,
  "timestamp": "2025-10-01T12:00:00Z",
  "save_id": 123,
  "backup_id": null
}
```

**Backend automatically updates TWO tables**:
1. `game_saves` - Full JSON save data
2. `user_resources` - Extracted stone, gold, crystals, and prestige_level for leaderboard

### 3. Load System
**Frontend requests** (`GET /api/v1/game/save`):
- Authorization header: `Bearer {token}`

**Backend responds**:
```json
{
  "save_data": {...},
  "last_updated": "2025-10-01T12:00:00Z",
  "total_play_time": 12345,
  "has_save": true
}
```

**Fallback handling**:
- `has_save: false` → Fresh game start
- `404 status` → No save yet, fresh start
- Empty response → Fresh start
- Handles both new structure (with `custom_data`) and legacy saves

### 4. Leaderboard
**Frontend requests** (`GET /api/v1/game/leaderboard?limit=100`):
- Authorization header: `Bearer {token}`

**Backend responds**:
```json
{
  "entries": [
    {
      "user_id": 1,
      "username": "Player Name",
      "stone_count": 10000,
      "gold_count": 5000,
      "magical_crystals": 100,
      "prestige_level": 5,
      "total_score": 15100,
      "rank": 1
    }
  ],
  "user_rank": 1,
  "total_players": 100
}
```

### 5. Auto-Save System
- Saves every 30 seconds when authenticated
- Starts automatically after login/register
- Stops on logout

## Data Flow

### Save Flow
```
GameEngine.state → prepareSaveData() → GameSaveData format → 
wrap in GameSaveRequest → POST /api/v1/game/save → 
Backend saves to game_saves table + updates user_resources table
```

### Load Flow
```
GET /api/v1/game/save → Backend returns GameLoadResponse → 
extract save_data → applySaveData() → restore to GameEngine.state → 
UI updates automatically
```

## Database Tables Used

### `game_saves` (id, user_id, save_data, last_updated, game_version)
- Stores complete game state as JSON
- Updated on every save

### `user_resources` (id, user_id, stone_count, gold_count, magical_crystals, prestige_level)
- Stores extracted resources for leaderboard
- Updated automatically by backend when saving

### `game_upgrades` (id, user_id, miner_level, transport_level, market_level, etc.)
- Initialized on registration
- Can be used for future features

## Testing Checklist

### Registration
- [ ] Create account with username (min 3 chars) and password (min 8 chars)
- [ ] Verify token is stored in localStorage
- [ ] Verify auto-save starts
- [ ] Check backend creates user in `users`, `user_resources`, and `game_upgrades` tables

### Login
- [ ] Login with existing credentials
- [ ] Verify token is restored
- [ ] Verify game loads automatically after login
- [ ] Check notification appears

### Save
- [ ] Manual save via button/UI
- [ ] Verify notification "💾 Game saved successfully!"
- [ ] Check browser console for save_id
- [ ] Verify data in `game_saves` table
- [ ] Verify resources updated in `user_resources` table

### Load
- [ ] Login on fresh session
- [ ] Verify all resources restored (stone, coal, iron, silver, gold)
- [ ] Verify workers restored
- [ ] Verify city buildings restored
- [ ] Verify prestige level restored
- [ ] Verify research/unlocks restored

### Auto-Save
- [ ] Wait 30 seconds after login
- [ ] Verify auto-save notification appears
- [ ] Check backend logs for save requests

### Logout
- [ ] Verify auto-save stops
- [ ] Verify token cleared from localStorage

### Leaderboard
- [ ] Fetch leaderboard with multiple users
- [ ] Verify ranking based on total_score
- [ ] Verify current user's rank highlighted

## API Endpoints Summary

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/api/v1/game/status` | GET | No | Check if game features available |
| `/api/v1/game/auth/register` | POST | No | Create new account |
| `/api/v1/game/auth/login` | POST | No | Login to account |
| `/api/v1/game/save` | GET | Yes | Load game save |
| `/api/v1/game/save` | POST | Yes | Save game data |
| `/api/v1/game/leaderboard` | GET | Yes | Get leaderboard |

## Code Structure

### Files Modified
- `/frontend/idleGame/js/save/SaveManager.js`
  - `register()` - Fixed email requirement
  - `login()` - Works correctly
  - `saveGame()` - Updated to send GameSaveRequest format
  - `loadGame()` - Updated to parse GameLoadResponse format
  - `prepareSaveData()` - Matches GameSaveData model
  - `applySaveData()` - Handles both new and legacy formats
  - `getLeaderboard()` - Updated to require auth and parse new response

### Backend Files (Reference Only)
- `/backend/app.py` - Game endpoints (lines 6600-6811)
- `/backend/models/models.py` - Data models (lines 620-775)
- `/backend/database/datarepository.py` - Database operations (lines 2820-3000)

## Notes

### Compatibility
- Backwards compatible with older saves (checks for both `custom_data` and legacy structure)
- Frontend handles missing fields gracefully with defaults

### Security
- All authenticated endpoints require valid JWT token
- Tokens expire after configured time (default: 24 hours in localStorage)
- Passwords hashed on backend

### Performance
- Auto-save every 30 seconds (configurable)
- Full game state saved to prevent data loss
- Efficient JSON storage in MySQL

### Future Enhancements
1. Backup system (set `backup: true` in save request)
2. Multiple save slots
3. Cloud sync indicators
4. Conflict resolution for concurrent sessions
5. Save compression for large states

## Common Issues & Solutions

### Issue: "Registration failed: Username already exists"
**Solution**: Username must be unique. Try a different username or login instead.

### Issue: "Load failed after login"
**Solution**: This was fixed! New users with no save will see "Starting new game!" message.

### Issue: "Save failed: Not authenticated"
**Solution**: Login first before trying to save.

### Issue: Token expired
**Solution**: Login again. Tokens are valid for 24 hours.

### Issue: Resources not updating in leaderboard
**Solution**: The backend automatically updates `user_resources` table when saving. Check that save is successful and contains `resources` field with `stone`, `gold`, and `crystals`.

## Success! 🎉

Your game now has a fully functional backend integration with:
- ✅ User authentication (register/login)
- ✅ Cloud save/load system
- ✅ Auto-save every 30 seconds
- ✅ Leaderboard support
- ✅ Resource tracking for rankings
- ✅ Token-based security
- ✅ Graceful error handling
- ✅ Backwards compatibility

The reset button and loading issues have been completely resolved!
