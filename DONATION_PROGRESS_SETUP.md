# Donation Progress Management System

## Overview
The donation progress is now managed through the **UserServer** idle game account, allowing you to update donation goals from the converter page without editing any Python files.

## How It Works

### Backend Storage
- Donation progress is stored in the idle game backend using the `UserServer` account
- Data is saved in the game save's `donationProgress` field:
  ```json
  {
    "donationProgress": {
      "currentAmount": 114,
      "goalAmount": 150,
      "lastUpdated": "2025-11-21T..."
    }
  }
  ```

### Frontend Integration
- `donationProgress.js` fetches the latest values from the UserServer account on page load
- The admin interface (top-left corner) allows updates via password authentication
- No Python files are modified - everything uses existing API endpoints

## Setup Instructions

### 1. Create UserServer Account (One-time setup)
Create the UserServer account in the idle game:

1. Go to `/frontend/idleGame/idlegame.html`
2. Register a new account:
   - Username: `UserServer`
   - Password: `[your secure password]`
   - Email: (optional)
3. The account will be created and ready to store donation progress

**Important**: Save your password securely - you'll need it to update donation progress!

### 2. Update Donation Progress

#### From Converter Page:
1. Visit `/frontend/html/converter.html`
2. Click the **"💰 Update Goal"** panel in the top-left corner
3. Enter:
   - **Password**: Your UserServer password
   - **Current Amount**: Current donation amount (e.g., 114)
   - **Goal Amount**: Target donation goal (e.g., 150)
4. Click **"Update Progress"**
5. The page will reload and show the new values

#### Password Storage:
- Your password is saved in localStorage for convenience
- It's only used to authenticate with the idle game API
- You only need to enter it once per browser

## Features

### Admin Interface
- **Location**: Top-left corner of converter page
- **Collapsed by default**: Click to expand
- **Auto-saves password**: No need to re-enter
- **Real-time updates**: Changes reflect immediately

### Security
- Password required for all updates
- Uses existing authentication system
- No new backend endpoints needed
- Stored securely in game save data

### Fallback Values
If the system can't fetch data:
- Default current: $114
- Default goal: $150
- Progress bar still displays correctly

## API Endpoints Used

The system uses existing idle game endpoints:
- `POST /api/v1/login` - Authenticate as UserServer
- `GET /api/v1/game/load` - Fetch donation progress
- `POST /api/v1/game/save` - Update donation progress

## Troubleshooting

### "Login failed" Error
- Verify UserServer account exists
- Check password is correct
- Ensure idle game backend is running

### Progress Not Updating
1. Open browser console (F12)
2. Check for error messages
3. Verify UserServer account has save data
4. Try clearing localStorage and re-entering password

### Fallback to Old Values
- System automatically falls back to hardcoded values if API fails
- Check network tab for failed requests
- Ensure backend is accessible

## Technical Details

### File Changes Made
1. **donationProgress.js**
   - Added API integration with idle game backend
   - Fetches progress on page load
   - Exposes `window.DonationProgress` API

2. **converter.html**
   - Added admin interface CSS
   - Added collapsible admin panel HTML
   - Added update script functions

### No Backend Changes
- ✅ No modifications to `app.py`
- ✅ No new Python files created
- ✅ Uses existing API infrastructure
- ✅ No database schema changes

## Future Enhancements

Possible improvements:
- Auto-refresh progress every X minutes
- Multiple admin accounts
- Progress history/analytics
- Email notifications on updates
- Integration with payment processors

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify UserServer account credentials
3. Test idle game login directly
4. Contact support via the converter page

---

**Last Updated**: November 21, 2025
**System Version**: 1.0
**Compatible with**: Kingdom Quarry Idle Game Backend v1.0+
