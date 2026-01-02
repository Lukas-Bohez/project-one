# Convert the Spire - Testing Guide

## Installation Steps

1. Open Firefox
2. Navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Select `/home/student/Project/project-one/Extension-Converter/convert-the-spire-firefox.zip`

## Testing YouTube Data Extraction

### Test 1: Single Video
1. Go to any YouTube video (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
2. Click the extension icon in the toolbar
3. The popup should show:
   - Video title
   - Duration
   - Format options (MP3/MP4)
   - Quality options

### Test 2: Playlist
1. Go to any YouTube playlist (e.g., `https://www.youtube.com/playlist?list=...`)
2. Click the extension icon
3. The popup should show:
   - Playlist name
   - List of all videos in the playlist
   - Batch conversion options

### Debugging Console Logs

To see what's happening:

1. Right-click the extension popup and select "Inspect"
2. Go to the Console tab
3. Look for messages starting with `[Content Script]` and `[Popup]`

Common log messages:
- `[Content Script] Starting YouTube data extraction` - Content script is running
- `[Content Script] Found ytInitialData` - Successfully found YouTube data
- `[Content Script] Data extraction successful` - Data was extracted properly
- `[Content Script] No YouTube data found` - Failed to find data (problem!)

### Testing Background Script

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Find "Convert the Spire" in the list
3. Click "Inspect" next to it
4. This opens the background script console
5. Look for conversion logs

### Common Issues

**Issue: "No YouTube data found"**
- Check if content script is injected (look for console logs)
- Try refreshing the YouTube page
- Make sure you're on a supported YouTube page (/watch, /playlist, etc.)

**Issue: Extension icon doesn't do anything**
- Check the background script console for errors
- Make sure the extension is properly loaded
- Try removing and re-adding the extension

**Issue: Can't convert videos**
- Check if the API endpoints are accessible
- Look for CORS errors in the console
- Verify download permissions are granted

## Browser API Compatibility

The extension uses a compatibility layer:
```javascript
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
```

This allows the code to work in both Firefox and Chrome, preferring Firefox's native `browser` API when available.

## Manifest V2 Features Used

- **content_scripts**: Automatically injected on YouTube pages
- **background.scripts**: Persistent background script for conversions
- **browser_action**: Shows popup when icon is clicked
- **permissions**: Full access to YouTube, cookies, storage, downloads

## Version Information

Check [version.json](version.json) for current version details.
