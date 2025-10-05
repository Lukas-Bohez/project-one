# Support Chat System Setup

## Overview
The support chat system uses a dedicated session (ID: 999999) that operates independently from the quiz system.

## Key Design Decisions

### Session 999999 - The Support Session
- **ID**: Fixed at `999999` (never changes)
- **Status**: Always `1` (INACTIVE) - **NEVER** set to active (status 2)
- **Purpose**: Community support chat that's always available
- **Independence**: Completely separate from quiz sessions

### Why Status Must Be INACTIVE (1)

The support session MUST remain inactive (status 1) because:

1. **Quiz System Isolation**: Active sessions (status 2) are picked up by the quiz system
2. **Session Selection**: `get_active_session_id()` filters for status 2 sessions
3. **Avoid Conflicts**: If 999999 were active, it could interfere with quiz functionality
4. **High ID Number**: ID 999999 would become the "latest" session, breaking quiz flow

### Backend Filtering

The following functions explicitly **exclude session 999999**:

1. **`get_active_session_id()`** - Line 4469
   - Returns first active quiz session
   - Filters out 999999 before returning

2. **`get_active_sessions()`** - Line 3452
   - Returns all active quiz sessions for API
   - Filters out 999999 from the list

3. **`create_chat_message()`** - Line 3498
   - Regular quiz chat endpoint
   - Filters out 999999 from active session validation

### Dedicated Support Endpoint

Support chat uses its own endpoint that bypasses session checks:

**Endpoint**: `POST /api/v1/chat/support/messages`

**Key Features**:
- ✅ No active session validation
- ✅ Forces session_id to 999999
- ✅ Same rate limiting as regular chat
- ✅ Emits Socket.IO events for real-time updates

**Regular Chat Endpoint** (for comparison):
- `POST /api/v1/chat/messages` - Requires active quiz session

### Dedicated Support Authentication

Support chat uses separate authentication endpoints that do NOT create quiz sessions:

**Login Endpoint**: `POST /api/v1/support/login`
**Register Endpoint**: `POST /api/v1/support/register`

**Key Differences from Quiz Auth**:
- ✅ Does NOT create quiz sessions when no active session exists
- ✅ Does NOT add users to active quiz sessions
- ✅ Does NOT send chat messages to quiz chat
- ✅ Only authenticates and logs IP address
- ✅ Prevents unwanted quiz session creation from support logins

**Regular Auth Endpoints** (for comparison):
- `POST /api/v1/login` - Creates quiz session if none exists
- `POST /api/v1/register` - Creates quiz session if none exists

## Database Setup

### Creating the Support Session

Run this SQL to ensure support session exists:

```sql
-- Run: backend/create_support_session.sql
INSERT INTO quizSessions (
    id, 
    session_date, 
    name, 
    description, 
    sessionStatusId, 
    themeId, 
    hostUserId, 
    start_time
) VALUES (
    999999,
    NOW(),
    'Support Chat',
    'Community support chat session - always available but NEVER active',
    1,  -- MUST be 1 (inactive)
    1,
    1,
    NOW()
) ON DUPLICATE KEY UPDATE 
    sessionStatusId = 1;  -- Keep inactive
```

### Verify Setup

```sql
-- Should show sessionStatusId = 1 (NOT 2!)
SELECT id, name, sessionStatusId, themeId 
FROM quizSessions 
WHERE id = 999999;
```

## Frontend Implementation

### Files
- `frontend/html/support.html` - Support chat page
- `frontend/js/supportChat.js` - Dedicated support chat system
- `frontend/js/supportLogin.js` - Dedicated support authentication (does NOT create quiz sessions)

### Key Features
1. **Separate Authentication**: Uses `SupportAuthSystem` instead of `AuthSystem`
2. **No Quiz Session Creation**: Login/register only authenticates, doesn't create quiz sessions
3. **Socket.IO Integration**: Real-time message updates
4. **Theme Support**: Respects user's theme preference
5. **Session Locked**: Always uses session 999999
6. **Independent Storage**: Uses separate localStorage keys (`support_*` prefix)

### Usage
```javascript
// Support auth system - does NOT create quiz sessions
const authSystem = new SupportAuthSystem();

// Support chat automatically initializes
const supportChatSystem = new SupportChatSystem();
// Session is hardcoded to 999999
// Messages use /api/v1/chat/support/messages endpoint
```

## Troubleshooting

### Issue: "Session is not active or does not exist"
**Solution**: Using wrong endpoint. Support chat must use `/api/v1/chat/support/messages`

### Issue: Quiz picks up session 999999
**Solution**: 
1. Ensure session status is 1 (not 2)
2. Verify `get_active_session_id()` filters out 999999
3. Check `get_active_sessions()` excludes 999999

### Issue: Support chat messages not appearing
**Solution**:
1. Verify session 999999 exists in database
2. Check user is logged in
3. Confirm Socket.IO connection is established

## Architecture Diagram

```
User Login (quizlogin.js)
    ↓
Support Chat Page (support.html)
    ↓
Support Chat System (supportChat.js)
    ↓ (Socket.IO)
    ↓
Backend (app.py)
    ↓
POST /api/v1/chat/support/messages
    ↓
Database: chatLog table
    ↓ (Foreign Key)
quizSessions (id: 999999, status: 1)
    ↓
Socket.IO Emit (message_sent)
    ↓
All Connected Clients Updated
```

## Important Rules

1. ✅ Session 999999 MUST have `sessionStatusId = 1` (inactive)
2. ✅ Support chat MUST use `/api/v1/chat/support/messages` endpoint
3. ✅ Quiz system MUST filter out session 999999 in all queries
4. ✅ Never manually change session 999999 status to 2 (active)
5. ✅ Support chat works independently from quiz state

## Testing

### Test Support Chat
1. Navigate to `/html/support.html`
2. Log in with credentials
3. Send a test message
4. Verify message appears in real-time

### Verify Quiz Isolation
1. Start a quiz session
2. Check that quiz uses a different session ID (not 999999)
3. Verify support chat still works during quiz
4. Confirm quiz doesn't pick up support messages

## Maintenance

### Daily Checks
- None required - system is self-contained

### After Database Restore
- Run `create_support_session.sql` to ensure session exists

### After Code Updates
- Verify filtering in `get_active_session_id()`
- Check support endpoint still bypasses validation
- Test Socket.IO connection

## Files Modified

### Backend
- `backend/app.py`:
  - Added `/api/v1/chat/support/messages` endpoint
  - Added `/api/v1/support/login` endpoint (no quiz session creation)
  - Added `/api/v1/support/register` endpoint (no quiz session creation)
  - Updated `get_active_session_id()` to filter 999999
  - Updated `get_active_sessions()` to filter 999999
  - Updated regular chat endpoint to exclude 999999

### Frontend
- `frontend/js/supportChat.js` - New dedicated support chat class
- `frontend/js/supportLogin.js` - New dedicated support authentication class
- `frontend/html/support.html` - Support chat page

### Database
- `backend/create_support_session.sql` - Setup script

## Summary

The support chat system is completely isolated from the quiz system through:
1. Dedicated session (999999) that's always inactive
2. Dedicated API endpoint that bypasses active session checks
3. Backend filtering that excludes 999999 from quiz operations
4. Frontend system that only uses session 999999

This ensures both systems can operate independently without conflicts.
