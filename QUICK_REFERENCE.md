# Quick Reference - Backend Integration

## 🚀 Quick Start

### 1. Open Test Page
Navigate to: `https://your-domain.com/frontend/test-backend-integration.html`

### 2. Test Authentication
1. Enter username (min 3 chars) and password (min 8 chars)
2. Click "Register" to create a new account
3. Or click "Login" if you already have an account

### 3. Test Save/Load
1. Click "Test Save" to save random game data
2. Click "Test Load" to verify data persists
3. Logout and login again to verify persistence

### 4. Test Leaderboard
1. Click "Get Leaderboard" to see rankings
2. Save multiple times with different resource amounts to see leaderboard update

---

## 📝 Developer Console Commands

### Quick Test in Browser Console
```javascript
// Initialize SaveManager (assuming GameEngine exists)
const saveManager = new SaveManager(gameEngine);

// Register
await saveManager.register('testuser', 'password123', 'test@example.com');

// Login
await saveManager.login('testuser', 'password123');

// Save
await saveManager.saveGame();

// Load
await saveManager.loadGame();

// Get Leaderboard
const leaderboard = await saveManager.getLeaderboard(100);
console.log(leaderboard);

// Logout
saveManager.logout();
```

---

## 🔧 Troubleshooting

### Problem: "Failed to fetch" errors
**Solution**: 
- Verify backend is running: `curl https://your-domain.com/api/v1/game/status`
- Check browser console for CORS errors
- Ensure API endpoint is correct in SaveManager.js

### Problem: Registration returns "Username already exists"
**Solution**:
- Try a different username
- Or login with existing credentials instead

### Problem: "Invalid token" or "Unauthorized" errors
**Solution**:
- Token may have expired (24 hour limit in localStorage)
- Logout and login again
- Clear localStorage: `localStorage.clear()`

### Problem: Save works but resources don't show in leaderboard
**Solution**:
- Verify `resources` object contains `stone`, `gold`, and `crystals` fields
- Check backend logs for SQL errors
- Verify `user_resources` table exists

### Problem: Load returns empty/no data
**Solution**:
- This is normal for new users with no saves
- Save first, then load
- Check notification: "🎮 Starting new game!"

---

## 📊 Database Verification

### Check if user was created
```sql
SELECT * FROM users WHERE first_name = 'your_username';
```

### Check if resources were initialized
```sql
SELECT * FROM user_resources WHERE user_id = YOUR_USER_ID;
```

### Check if save exists
```sql
SELECT id, user_id, game_version, last_updated 
FROM game_saves 
WHERE user_id = YOUR_USER_ID;
```

### View full save data
```sql
SELECT save_data 
FROM game_saves 
WHERE user_id = YOUR_USER_ID;
```

### Check leaderboard calculation
```sql
SELECT 
    u.id as user_id,
    u.first_name,
    ur.stone_count,
    ur.gold_count,
    ur.magical_crystals,
    ur.prestige_level,
    (ur.stone_count + ur.gold_count + ur.magical_crystals) as total_score
FROM users u
JOIN user_resources ur ON u.id = ur.user_id
ORDER BY total_score DESC
LIMIT 10;
```

---

## 🎯 Key Files

### Frontend
- `frontend/idleGame/js/save/SaveManager.js` - Main save/load logic
- `frontend/test-backend-integration.html` - Test interface

### Backend (Reference Only)
- `backend/app.py` (lines 6600-6811) - Game endpoints
- `backend/models/models.py` (lines 620-775) - Data models
- `backend/database/datarepository.py` (lines 2820-3000) - Database operations

---

## ✅ Success Indicators

### Authentication Success
- ✓ Notification: "✅ Account created successfully!" or "✅ Welcome back!"
- ✓ Browser console: JWT token logged
- ✓ localStorage key `industrialEmpire_auth` created
- ✓ Auto-save starts (notification every 30 seconds)

### Save Success
- ✓ Notification: "💾 Game saved successfully!"
- ✓ Browser console: `save_id` logged
- ✓ Database: New row in `game_saves` table
- ✓ Database: Resources updated in `user_resources` table

### Load Success
- ✓ Notification: "📂 Game loaded successfully!"
- ✓ Browser console: "Save data applied successfully"
- ✓ UI updates with loaded resources
- ✓ All game state restored (workers, buildings, etc.)

### Leaderboard Success
- ✓ Returns array of player entries
- ✓ Shows `user_rank` for current player
- ✓ Entries sorted by `total_score` descending
- ✓ `total_score` = stone_count + gold_count + magical_crystals

---

## 🔐 Security Notes

- Passwords are hashed on backend (never stored in plain text)
- JWT tokens expire after configured time
- All authenticated endpoints require `Authorization: Bearer {token}` header
- Tokens stored in localStorage (client-side only)
- Use HTTPS in production for secure token transmission

---

## 📈 Monitoring

### Backend Logs
Check backend logs for API requests:
```bash
tail -f /path/to/backend/app.log
```

Look for:
- `POST /api/v1/game/auth/register` - Registrations
- `POST /api/v1/game/auth/login` - Logins
- `POST /api/v1/game/save` - Saves
- `GET /api/v1/game/save` - Loads
- `GET /api/v1/game/leaderboard` - Leaderboard requests

### Browser Console
Enable verbose logging:
```javascript
// In browser console
localStorage.setItem('debug', 'true');
```

---

## 🎮 Integration Complete!

Your Industrial Empire game now has:
- ✅ Full backend integration
- ✅ User authentication
- ✅ Cloud saves
- ✅ Auto-save system
- ✅ Leaderboard support
- ✅ Secure token management

**Next Steps:**
1. Test using `test-backend-integration.html`
2. Verify database tables are populated
3. Test save/load cycle with real game data
4. Monitor auto-save behavior
5. Check leaderboard rankings

Happy coding! 🚀
