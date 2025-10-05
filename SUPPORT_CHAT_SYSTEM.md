# Support Chat System - Privacy Update

## ✅ FIXED VERSION

The support chat has been completely rewritten to match your website's design patterns and use Socket.IO correctly!

### What's Fixed:
- ✅ **Socket.IO integration** - Uses your existing Socket.IO setup, not WebSockets
- ✅ **Theme support** - Respects your dark/light theme system
- ✅ **Proper styling** - Matches your website's design language
- ✅ **Click header to go back** - Header is clickable to return to main site
- ✅ **Real-time messaging** - Actually sends and receives messages via Socket.IO
- ✅ **Chat history loading** - Loads previous messages from `/api/chat/${sessionId}/messages`
- ✅ **Connection status** - Shows actual connection state with color indicators

## Overview
Instead of using port 25 for email (which is blocked by ISP), we've created a community support chat system that allows users to contact you directly through the website without exposing personal information.

## What Was Changed

### 1. **New Support Chat Page Created**
- **Location**: `/frontend/html/support.html`
- **Features**:
  - Real-time WebSocket chat using chat ID `999999`
  - Public community chat where anyone can ask questions
  - Persistent message history
  - Optional username (defaults to "Guest")
  - Connection status indicator
  - Mobile responsive design
  - Beautiful modern UI matching the QuizTheSpire theme

### 2. **Email References Removed**
All references to `lukasbohez@gmail.com` have been replaced with links to the support chat page:

**Files Updated:**
- `converter.html`
- `converter-about.html`
- `converter-privacy.html`
- `converter-terms.html`
- `conversion.html`
- `content.html`
- `privacy.html`

**Changes Made:**
- Email links (`mailto:lukasbohez@gmail.com`) → Support chat links (`/html/support.html`)
- Email text references → "our support chat"
- Meta tags updated to use `support@quizthespire.duckdns.org`
- JSON-LD schema email fields updated

### 3. **Personal Name References Updated**
- "Lukas Bohez" → "QuizTheSpire Team"
- "Created by Lukas Bohez" → "Created with ❤️ by the QuizTheSpire Team"
- Author meta tags updated to "QuizTheSpire Team"

### 4. **Contact Buttons Updated**
- "Email Me" → "Chat with Support"
- "Send Email" → "Start a Chat"
- Icons changed from envelope to chat bubbles

## How It Works

### User Experience:
1. User clicks any "Contact" or "Support" link on the website
2. Redirected to `/html/support.html`
3. Can optionally enter their name (saved in localStorage)
4. Types messages in real-time chat
5. All messages visible to everyone in the community chat
6. You receive messages immediately through the WebSocket server

### Technical Details:
- **Chat ID**: `999999` (very high number to avoid conflicts with game chats)
- **WebSocket**: Connects to `ws://quizthespire.duckdns.org:8001`
- **Message Storage**: Uses existing chat.js backend with MySQL database
- **Auto-reconnect**: Automatically reconnects if connection drops
- **Message History**: Loads recent messages when page opens

## Accessing Support Messages

### Option 1: Support Chat Page
Visit `https://quizthespire.duckdns.org/html/support.html` directly

### Option 2: Backend Database
```sql
-- View all support chat messages
SELECT * FROM chat_messages WHERE chat_id = 999999 ORDER BY timestamp DESC;

-- View recent support messages
SELECT username, message, timestamp 
FROM chat_messages 
WHERE chat_id = 999999 
ORDER BY timestamp DESC 
LIMIT 50;
```

### Option 3: WebSocket Monitoring
Connect to the WebSocket server and join chat room 999999:
```javascript
ws.send(JSON.stringify({
    type: 'join',
    chat_id: 999999
}));
```

## Privacy Benefits

✅ **No personal email exposed**
- Users can't see your personal email address
- No email harvesting by bots/scrapers

✅ **No personal name exposed**
- Generic team branding instead of personal identity
- Professional appearance

✅ **Public accountability**
- Community can see questions and answers
- Builds knowledge base naturally
- Other users can help each other

✅ **No external email dependency**
- Don't need port 25 or mail server
- Everything self-hosted on your Pi
- No reliance on Gmail

## Additional Features

### For Users:
- 💬 **Real-time chat** - Instant messaging
- 📱 **Mobile friendly** - Works on all devices
- 🔄 **Auto-reconnect** - Handles connection drops
- 💾 **Message history** - See previous conversations
- 👤 **Optional identity** - Use real name or stay anonymous

### For You:
- 📊 **All messages in database** - Easy to query/analyze
- 🔔 **Real-time notifications** - See messages as they arrive
- 📝 **Persistent storage** - Messages saved forever
- 🌐 **Web-based** - No email client needed
- 🔒 **Full control** - Your server, your data

## Future Enhancements

Possible improvements:
1. Add email notifications when new support messages arrive
2. Add admin panel to manage/archive support chats
3. Add file upload for screenshots/logs
4. Add typing indicators
5. Add read receipts
6. Add chat search functionality
7. Add automated responses for common questions

## Backup Files

All modified HTML files have `.bak` backups in case you need to revert:
- `converter.html.bak`
- `converter-about.html.bak`
- `converter-privacy.html.bak`
- `converter-terms.html.bak`
- `conversion.html.bak`
- `content.html.bak`
- `privacy.html.bak`

## Testing

To test the support chat:
1. Visit `https://quizthespire.duckdns.org/html/support.html`
2. Enter a test username
3. Send a test message
4. Open in another browser/tab to see it appear
5. Check the database: `SELECT * FROM chat_messages WHERE chat_id = 999999;`

## Summary

✨ **No port 25 needed!**
✨ **No email server needed!**
✨ **Personal information protected!**
✨ **Better user experience!**
✨ **Community building feature!**

The support chat system replaces traditional email contact with a modern, real-time communication channel that's more engaging, transparent, and privacy-conscious.
