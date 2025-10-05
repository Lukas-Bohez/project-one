# Support Chat - Quick Reference

## URLs
- **Support Chat Page**: `https://quizthespire.duckdns.org/html/support.html`
- **Quiz Main Page**: `https://quizthespire.duckdns.org/index.html`

## API Endpoints

### Support Chat (Use These!)
```
POST /api/v1/support/login          - Login without creating quiz session
POST /api/v1/support/register       - Register without creating quiz session
POST /api/v1/chat/support/messages  - Send support chat message
GET  /api/v1/chat/messages/999999   - Get support chat history
```

### Quiz (Don't Use for Support!)
```
POST /api/v1/login                  - Login (creates quiz session!)
POST /api/v1/register               - Register (creates quiz session!)
POST /api/v1/chat/messages          - Send quiz chat message
```

## Session Info
- **Support Session ID**: `999999` (hardcoded, never changes)
- **Support Session Status**: `1` (inactive - NEVER set to 2!)
- **Quiz Sessions**: `1, 2, 3, ...` (normal range, status 2 when active)

## Frontend Classes

### Support Chat Page
```javascript
authSystem = new SupportAuthSystem();     // NOT AuthSystem!
supportChatSystem = new SupportChatSystem();
```

### Quiz Page
```javascript
authSystem = new AuthSystem();
chatSystem = new ChatSystem();
```

## Database Quick Checks

```sql
-- Verify support session exists and is INACTIVE
SELECT id, name, sessionStatusId FROM quizSessions WHERE id = 999999;
-- Expected: id=999999, sessionStatusId=1

-- Check active quiz sessions (should NOT include 999999)
SELECT id, name FROM quizSessions WHERE sessionStatusId = 2;

-- View support chat messages
SELECT * FROM chatLog WHERE sessionId = 999999 ORDER BY created_at DESC LIMIT 20;
```

## Files to Edit

### If modifying support chat:
- `frontend/html/support.html` - Support page
- `frontend/js/supportLogin.js` - Support authentication
- `frontend/js/supportChat.js` - Support chat logic
- `backend/app.py` - Support endpoints (search for "support")

### If modifying quiz:
- `frontend/index.html` - Quiz page
- `frontend/js/quizlogin.js` - Quiz authentication
- `frontend/js/chat.js` - Quiz chat logic
- `backend/app.py` - Quiz endpoints

## Common Issues

### "Session is not active or does not exist"
- **Cause**: Using quiz endpoint for support
- **Fix**: Use `/api/v1/chat/support/messages` not `/api/v1/chat/messages`

### Quiz picks up session 999999
- **Cause**: Session 999999 status is 2 (active)
- **Fix**: `UPDATE quizSessions SET sessionStatusId = 1 WHERE id = 999999;`

### Support login creates quiz session
- **Cause**: Using quiz login endpoint
- **Fix**: Use `/api/v1/support/login` not `/api/v1/login`

### Support chat messages not showing
- **Check 1**: Session 999999 exists in database
- **Check 2**: User is logged in (check localStorage for `support_user_id`)
- **Check 3**: Socket.IO connected (check browser console)

## Important Rules

1. Session 999999 status MUST be `1` (inactive)
2. Support chat uses `/api/v1/support/*` endpoints
3. Quiz filters out session 999999 in all queries
4. Support page uses `SupportAuthSystem` class
5. Never mix support and quiz endpoints!

## LocalStorage Keys

### Support Chat
- `support_user_id`
- `support_first_name`
- `support_last_name`
- `support_password`

### Quiz
- `user_user_id`
- `user_first_name`
- `user_last_name`
- `user_password`

## Quick Test

```bash
# Test support login (should NOT create quiz session)
curl -X POST https://quizthespire.duckdns.org/api/v1/support/login \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Test","last_name":"User","password":"testpass123"}'

# Check no new quiz sessions were created
sudo mysql quizTheSpire -e "SELECT id, name, sessionStatusId FROM quizSessions ORDER BY id DESC LIMIT 5;"
```

## Emergency Reset

```sql
-- Reset support session to inactive
UPDATE quizSessions SET sessionStatusId = 1 WHERE id = 999999;

-- Clear all support chat messages (if needed)
DELETE FROM chatLog WHERE sessionId = 999999;
```

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│                     USER BROWSER                         │
├──────────────────────┬──────────────────────────────────┤
│   Quiz Page          │   Support Chat Page              │
│   (index.html)       │   (support.html)                 │
├──────────────────────┼──────────────────────────────────┤
│   AuthSystem         │   SupportAuthSystem              │
│   ChatSystem         │   SupportChatSystem              │
├──────────────────────┼──────────────────────────────────┤
│   POST /api/v1/login │   POST /api/v1/support/login     │
│   (creates session)  │   (no session creation)          │
├──────────────────────┼──────────────────────────────────┤
│   Session: 1,2,3...  │   Session: 999999                │
│   Status: 2 (active) │   Status: 1 (inactive)           │
└──────────────────────┴──────────────────────────────────┘
                       │
                       ▼
            ┌──────────────────┐
            │   MySQL Database │
            │   quizTheSpire   │
            └──────────────────┘
```

## Contact

- **Support Chat**: Visit `/html/support.html` and ask!
- **Email**: Via support chat (no direct email)
- **Documentation**: See `SUPPORT_CHAT_SETUP.md` for full details
